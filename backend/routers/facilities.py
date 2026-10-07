"""
Healthcare Facilities Router for GramCare AI
Provides verified nearby hospitals, PHCs, CHCs, clinics, pharmacies, and diagnostic centres
based on multi-source live queries (OpenStreetMap Overpass API + Google Places API when configured)
with graceful fallback and strict identity isolation.

Strict Production Standard:
- Never invents hospital names, addresses, phone numbers, or opening hours.
- Strict radius filtering: never returns facilities outside the requested radius.
- Strict identity isolation: never merges two facilities merely because coordinates are close.
- Google Places key in backend environment only; graceful fallback to OSM if key is missing.
"""
from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional, Dict, Any, Set
import math
import os
import re
import difflib
import httpx
import logging
import asyncio

from schemas import HealthcareFacilityResponse, FacilitySource

router = APIRouter()
logger = logging.getLogger("gramcare.facilities")

GENERIC_HEALTHCARE_WORDS = {
    "hospital", "hospitals", "clinic", "clinics", "centre", "center", 
    "chc", "phc", "subcentre", "subcenter", "sub-centre", "nursing", "home",
    "care", "healthcare", "health", "multi", "speciality", "multispeciality",
    "specialty", "superspeciality", "dr", "doctor", "dispensary", "community",
    "primary", "general", "government", "ggh", "ah", "dhh", "area"
}

def calculate_haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate Great Circle distance in km between two GPS coordinates using Haversine formula."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def classify_facility_type(name: str, amenity: str, healthcare: str, tags: dict) -> str:
    name_lower = (name or "").lower()
    if any(k in name_lower for k in ["phc", "primary health", "sub-centre", "sub centre", "subcenter", "health sub centre", "aarogya", "ayushman arogya"]):
        return "phc"
    if any(k in name_lower for k in ["chc", "community health"]):
        return "chc"
    if amenity == "pharmacy" or healthcare == "pharmacy" or "pharmacy" in name_lower or "chemist" in name_lower or "medical store" in name_lower:
        return "pharmacy"
    if amenity == "laboratory" or healthcare == "laboratory" or "diagnostic" in name_lower or "lab" in name_lower or "pathology" in name_lower:
        return "diagnostic"
    if amenity == "hospital" or healthcare == "hospital" or "hospital" in name_lower:
        return "hospital"
    if amenity in ["clinic", "doctors", "health_post"] or healthcare in ["clinic", "centre", "health_centre"]:
        return "clinic"
    return "hospital" if amenity == "hospital" else "clinic"

def normalize_facility_name(name: str) -> str:
    """Normalize facility name for strict identity comparison by stripping generic healthcare keywords."""
    if not name:
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", name.lower())
    tokens = [w for w in cleaned.split() if w and w not in GENERIC_HEALTHCARE_WORDS]
    return " ".join(tokens)

def calculate_name_similarity(name1: str, name2: str) -> float:
    """Calculates multi-metric similarity score (0.0 to 1.0) between two facility names."""
    n1 = normalize_facility_name(name1)
    n2 = normalize_facility_name(name2)
    if not n1 or not n2:
        return 0.0
    if n1 == n2:
        return 1.0

    seq_ratio = difflib.SequenceMatcher(None, n1, n2).ratio()
    tokens1 = set(n1.split())
    tokens2 = set(n2.split())
    jaccard = len(tokens1 & tokens2) / len(tokens1 | tokens2) if (tokens1 | tokens2) else 0.0

    # Substring check for distinct significant identifying tokens (length >= 5)
    token_sub = 0.0
    for t1 in tokens1:
        if len(t1) >= 5 and any(t1 in t2 or t2 in t1 for t2 in tokens2):
            token_sub = 0.85
            break

    return max(seq_ratio, jaccard, token_sub)

def are_same_physical_facility(f1: dict, f2: dict) -> bool:
    """
    STRICT IDENTITY ISOLATION:
    Two facilities can ONLY be matched if there is compelling multi-signal evidence
    that they are the exact same physical facility.
    Never merge two facilities merely because their coordinates are close.
    """
    # 1. Coordinate Proximity: Must be within 150 meters (0.15 km)
    dist_km = calculate_haversine_km(f1["latitude"], f1["longitude"], f2["latitude"], f2["longitude"])
    if dist_km > 0.15:
        return False

    # 2. Check Phone match if both have valid phones
    p1 = re.sub(r"\D", "", f1.get("phone") or "")
    p2 = re.sub(r"\D", "", f2.get("phone") or "")
    phone_match = bool(p1 and p2 and len(p1) >= 10 and len(p2) >= 10 and (p1[-10:] == p2[-10:]))

    # 3. Check Name similarity
    name_sim = calculate_name_similarity(f1.get("name", ""), f2.get("name", ""))

    if phone_match:
        # If phone numbers match exactly, require at least moderate name compatibility
        return name_sim >= 0.35

    # 4. Without phone match, require very strong name similarity (>= 0.75)
    # Example: 'Sathagna Hospital' and 'Sathagna Clinic' -> norm 'sathagna' == 'sathagna' -> sim 1.0 -> True
    # Example: 'CHC, Tallarevu' (norm: 'tallarevu') vs 'Haritha Multi Speciality Hospitals' (norm: 'haritha') -> sim 0.25 -> False!
    return name_sim >= 0.75

_OSM_CACHE: dict = {}

async def query_osm_facilities(lat: float, lon: float, radius_km: float, client: httpx.AsyncClient) -> List[dict]:
    """Query live healthcare facilities from OpenStreetMap Overpass API mirrors."""
    facilities: List[dict] = []
    radius_meters = int(radius_km * 1000)
    search_buffer_meters = min(radius_meters + 200, 50000)

    overpass_q = (
        f'[out:json][timeout:25];'
        f'('
        f'node["amenity"~"hospital|clinic|doctors|pharmacy|health_post"](around:{search_buffer_meters},{lat},{lon});'
        f'way["amenity"~"hospital|clinic|doctors|pharmacy|health_post"](around:{search_buffer_meters},{lat},{lon});'
        f'node["healthcare"~"hospital|clinic|centre|health_centre|doctor|pharmacy|laboratory"](around:{search_buffer_meters},{lat},{lon});'
        f'way["healthcare"~"hospital|clinic|centre|health_centre|doctor|pharmacy|laboratory"](around:{search_buffer_meters},{lat},{lon});'
        f');'
        f'out center 40;'
    )

    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter"
    ]

    elements = []
    for ep in endpoints:
        try:
            resp = await client.post(
                ep,
                data={"data": overpass_q},
                headers={"User-Agent": "GramCareAI/1.0", "Content-Type": "application/x-www-form-urlencoded"}
            )
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    elements = data.get("elements", [])
                    if elements:
                        break
                except Exception:
                    continue
        except Exception as ep_err:
            logger.debug(f"Overpass endpoint {ep} error: {ep_err}")

    seen_ids = set()
    for elem in elements:
        elem_id = f"osm_{elem.get('type', 'node')}_{elem.get('id')}"
        if elem_id in seen_ids:
            continue
        seen_ids.add(elem_id)

        f_lat = elem.get("lat") or (elem.get("center", {}).get("lat"))
        f_lon = elem.get("lon") or (elem.get("center", {}).get("lon"))
        if not f_lat or not f_lon:
            continue

        dist = calculate_haversine_km(lat, lon, f_lat, f_lon)
        if dist > radius_km:
            continue

        tags = elem.get("tags", {})
        raw_name = (
            tags.get("name") or 
            tags.get("name:en") or 
            tags.get("name:te") or 
            tags.get("name:hi") or 
            tags.get("official_name")
        )

        amenity = tags.get("amenity", "")
        healthcare = tags.get("healthcare", "")

        if not raw_name:
            raw_name = tags.get("operator") or (
                "Hospital" if amenity == "hospital" or healthcare == "hospital" else
                "Pharmacy" if amenity == "pharmacy" or healthcare == "pharmacy" else
                "Diagnostic Laboratory" if amenity == "laboratory" or healthcare == "laboratory" else
                "Clinic" if amenity in ["clinic", "doctors"] else
                "Primary Health Centre" if "phc" in (amenity + healthcare).lower() else
                "Healthcare Facility"
            )

        f_type = classify_facility_type(raw_name, amenity, healthcare, tags)

        full_address = tags.get("addr:full")
        if not full_address:
            addr_parts = [
                tags.get("addr:housenumber"),
                tags.get("addr:street"),
                tags.get("addr:suburb"),
                tags.get("addr:village"),
                tags.get("addr:neighbourhood"),
                tags.get("addr:city"),
                tags.get("addr:town"),
                tags.get("addr:postcode")
            ]
            full_address = ", ".join([p.strip() for p in addr_parts if p and p.strip()]) or None
        elif tags.get("addr:postcode") and tags.get("addr:postcode") not in full_address:
            full_address = f"{full_address}, {tags.get('addr:postcode')}"

        village_or_taluka = (
            tags.get("addr:village") or 
            tags.get("addr:subdistrict") or 
            tags.get("addr:suburb") or 
            tags.get("addr:neighbourhood") or 
            tags.get("addr:locality") or 
            tags.get("addr:place") or 
            tags.get("addr:hamlet") or 
            tags.get("addr:town") or 
            tags.get("addr:city") or 
            None
        )
        district = tags.get("addr:district") or tags.get("addr:state_district") or tags.get("addr:state") or None

        real_phone = tags.get("phone") or tags.get("contact:phone") or tags.get("contact:mobile") or None
        is_emergency_24x7 = True if (
            tags.get("emergency") == "yes" or 
            tags.get("opening_hours") == "24/7" or 
            "24/7" in (tags.get("opening_hours") or "")
        ) else (False if tags.get("emergency") == "no" else None)

        opening_hours = tags.get("opening_hours") or None
        spec_tag = tags.get("healthcare:speciality") or tags.get("medical_system:western") or tags.get("description")
        services = [s.strip() for s in spec_tag.split(";")] if spec_tag else []

        website = tags.get("website") or tags.get("contact:website") or None

        # Canonical Provider Attribution (Never mapper tags like 'local_knowledge' or 'survey')
        raw_source = (tags.get("source") or "").strip()
        if raw_source and any(k in raw_source.lower() for k in ["gov", "nrega", "data.gov", "mohfw", "nhm"]):
            source_attribution = "OpenStreetMap • OpenGovernmentData"
        else:
            source_attribution = "OpenStreetMap"

        facilities.append({
            "id": elem_id,
            "name": raw_name,
            "hindiName": tags.get("name:hi") or None,
            "type": f_type,
            "distanceKm": dist,
            "villageOrTaluka": village_or_taluka,
            "district": district,
            "address": full_address,
            "phone": real_phone,
            "emergency24x7": is_emergency_24x7,
            "servicesAvailable": services,
            "ashaWorkerName": None,
            "isOpenNow": None,
            "latitude": f_lat,
            "longitude": f_lon,
            "openingHours": opening_hours,
            "website": website,
            "source": source_attribution,
            "sources": [{"provider": source_attribution, "sourceId": elem_id}]
        })

    return facilities

async def query_google_places_facilities(lat: float, lon: float, radius_km: float, client: httpx.AsyncClient) -> List[dict]:
    """
    Query Google Places API Nearby Search if GOOGLE_PLACES_API_KEY is configured.
    Graceful fallback: returns empty list if key is missing, invalid, or API is unreachable.
    """
    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
    if not api_key:
        return []

    results: List[dict] = []
    radius_meters = int(min(radius_km * 1000, 50000))
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lon}",
        "radius": radius_meters,
        "type": "hospital",
        "key": api_key
    }

    try:
        resp = await client.get(url, params=params, timeout=10.0)
        if resp.status_code == 200:
            data = resp.json()
            places = data.get("results", [])
            for p in places:
                p_geom = p.get("geometry", {}).get("location", {})
                p_lat = p_geom.get("lat")
                p_lon = p_geom.get("lng")
                if p_lat is None or p_lon is None:
                    continue

                dist = calculate_haversine_km(lat, lon, p_lat, p_lon)
                if dist > radius_km:
                    continue

                p_name = p.get("name")
                if not p_name:
                    continue

                place_id = p.get("place_id")
                p_id = f"gplaces_{place_id}"
                f_type = classify_facility_type(p_name, "hospital", "", {})
                is_open = p.get("opening_hours", {}).get("open_now")

                results.append({
                    "id": p_id,
                    "name": p_name,
                    "hindiName": None,
                    "type": f_type,
                    "distanceKm": dist,
                    "villageOrTaluka": None,
                    "district": None,
                    "address": p.get("vicinity"),
                    "phone": None,
                    "emergency24x7": None,
                    "servicesAvailable": [],
                    "ashaWorkerName": None,
                    "isOpenNow": is_open,
                    "latitude": p_lat,
                    "longitude": p_lon,
                    "openingHours": None,
                    "website": None,
                    "source": "Google Places",
                    "sources": [{"provider": "Google Places", "sourceId": str(place_id)}]
                })
    except Exception as e:
        logger.warning(f"Google Places API query error (gracefully falling back to OSM): {e}")

    return results

def cross_check_and_deduplicate(osm_list: List[dict], gplaces_list: List[dict]) -> List[dict]:
    """
    Multi-source cross-checking with STRICT IDENTITY ISOLATION.
    - Confidently matched facilities (proximity <= 150m AND name similarity >= 0.75):
      Merge canonical identity + enrich missing attributes (phone, hours, address).
      Sources tagged as 'OpenStreetMap + Google Places'.
    - Disagreeing facilities (e.g. CHC Tallarevu vs Haritha Multi Speciality Hospitals):
      KEPT STRICTLY SEPARATE. Never overwrite a government facility identity.
    """
    merged_results: List[dict] = []
    matched_gplaces_indices: Set[int] = set()

    for osm_fac in osm_list:
        matched_gp = None
        matched_gp_idx = None

        for idx, gp_fac in enumerate(gplaces_list):
            if idx in matched_gplaces_indices:
                continue
            if are_same_physical_facility(osm_fac, gp_fac):
                matched_gp = gp_fac
                matched_gp_idx = idx
                matched_gplaces_indices.add(idx)
                break

        if matched_gp:
            # Confident match across both sources!
            enriched = dict(osm_fac)

            # If OSM name was generic (e.g. 'Hospital'), prefer specific Google Places name
            if osm_fac["name"] in ["Hospital", "Clinic", "Healthcare Facility"] and matched_gp.get("name"):
                enriched["name"] = matched_gp["name"]

            # Enrich missing fields from Google Places without overwriting valid data
            if not enriched.get("phone") and matched_gp.get("phone"):
                enriched["phone"] = matched_gp["phone"]
            if not enriched.get("address") and matched_gp.get("address"):
                enriched["address"] = matched_gp["address"]
            if enriched.get("isOpenNow") is None and matched_gp.get("isOpenNow") is not None:
                enriched["isOpenNow"] = matched_gp["isOpenNow"]

            # Combine source attributions
            existing_sources = osm_fac.get("sources") or [{"provider": osm_fac.get("source") or "OpenStreetMap", "sourceId": osm_fac["id"]}]
            gp_sources = matched_gp.get("sources") or [{"provider": "Google Places", "sourceId": matched_gp["id"]}]
            enriched["sources"] = existing_sources + gp_sources
            enriched["source"] = "OpenStreetMap • Google Places"
            merged_results.append(enriched)
        else:
            # Strictly independent OSM facility
            if not osm_fac.get("sources"):
                osm_fac["sources"] = [{"provider": osm_fac.get("source") or "OpenStreetMap", "sourceId": osm_fac["id"]}]
            merged_results.append(osm_fac)

    # Append unmerged Google Places facilities as distinct records (Strict Identity Isolation)
    for idx, gp_fac in enumerate(gplaces_list):
        if idx not in matched_gplaces_indices:
            if not gp_fac.get("sources"):
                gp_fac["sources"] = [{"provider": "Google Places", "sourceId": gp_fac["id"]}]
            merged_results.append(gp_fac)

    return merged_results

async def query_verified_facilities(
    lat: Optional[float],
    lon: Optional[float],
    radius_km: float = 5.0,
    category: Optional[str] = "all",
    query: Optional[str] = None
) -> List[dict]:
    """
    Core function to retrieve verified healthcare facilities queried live from OpenStreetMap Overpass API
    and Google Places API (when configured), cross-checked with strict identity isolation.
    """
    if lat is None or lon is None:
        raise HTTPException(
            status_code=400,
            detail="Latitude and longitude coordinates are required. No location fallback is permitted."
        )

    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        raise HTTPException(status_code=400, detail="Invalid coordinates: latitude must be [-90, 90] and longitude [-180, 180].")

    radius_km = max(0.5, float(radius_km))
    cache_key = f"{round(lat, 3)}_{round(lon, 3)}_{round(radius_km, 1)}"
    now_ts = asyncio.get_event_loop().time()

    if cache_key in _OSM_CACHE and (now_ts - _OSM_CACHE[cache_key]["ts"]) < 120.0:
        facilities = [dict(f) for f in _OSM_CACHE[cache_key]["facilities"]]
    else:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # 1. Query OpenStreetMap Overpass API
                osm_task = query_osm_facilities(lat, lon, radius_km, client)
                # 2. Query Google Places API (Graceful fallback if key not configured)
                gplaces_task = query_google_places_facilities(lat, lon, radius_km, client)

                osm_facilities, gplaces_facilities = await asyncio.gather(osm_task, gplaces_task)

            # 3. Multi-source cross-check and strict identity isolation
            facilities = cross_check_and_deduplicate(osm_facilities, gplaces_facilities)

            if cache_key and facilities:
                _OSM_CACHE[cache_key] = {"ts": now_ts, "facilities": list(facilities)}

        except Exception as e:
            logger.warning(f"Multi-source live query error: {e}")
            facilities = []

        # If live providers experienced momentary network timeout, fallback to cached verified facilities
        if not facilities and cache_key in _OSM_CACHE:
            facilities = [dict(f) for f in _OSM_CACHE[cache_key]["facilities"]]

    # Apply Category Filter if specified
    if isinstance(category, str) and category != "all":
        cat_lower = category.lower().strip()
        if cat_lower == "phc":
            facilities = [f for f in facilities if f["type"] in ["phc", "chc"]]
        elif cat_lower == "hospital":
            facilities = [f for f in facilities if f["type"] in ["hospital", "district_hospital"]]
        elif cat_lower == "clinic":
            facilities = [f for f in facilities if f["type"] in ["clinic", "phc", "chc"]]
        elif cat_lower == "emergency":
            facilities = [f for f in facilities if f.get("emergency24x7") is True]
        elif cat_lower == "pharmacy":
            facilities = [f for f in facilities if f["type"] == "pharmacy"]
        elif cat_lower == "diagnostic":
            facilities = [f for f in facilities if f["type"] == "diagnostic"]

    # Filter by text search query if specified
    if isinstance(query, str) and query.strip():
        q_lower = query.strip().lower()
        facilities = [
            f for f in facilities
            if q_lower in f["name"].lower() or 
               (f.get("villageOrTaluka") and q_lower in f["villageOrTaluka"].lower()) or 
               (f.get("district") and q_lower in f["district"].lower()) or
               (f.get("address") and q_lower in f["address"].lower())
        ]

    # FINAL STRICT RADIUS ENFORCEMENT: Never allow facilities outside the requested radius
    facilities = [f for f in facilities if f["distanceKm"] <= radius_km]

    # STRICT SORTING: Nearest -> Farthest
    facilities.sort(key=lambda item: item["distanceKm"])

    logger.info(f"[Facilities] Lat: {lat}, Lon: {lon}, Radius: {radius_km}km, Returned: {len(facilities)}")
    return facilities


@router.get("/facilities", response_model=List[HealthcareFacilityResponse], summary="List Real Nearby Healthcare Facilities")
async def get_facilities(
    lat: float = Query(..., description="User Latitude (-90 to 90)", ge=-90.0, le=90.0),
    lon: float = Query(..., description="User Longitude (-180 to 180)", ge=-180.0, le=180.0),
    radius_km: float = Query(5.0, description="Radius in kilometers (Default 5.0 km)", gt=0.0, le=100.0),
    category: Optional[str] = Query("all", description="all | phc | hospital | clinic | emergency | pharmacy | diagnostic"),
    query: Optional[str] = Query(None, description="Search term for village, city, PIN or facility name")
):
    """
    Returns real verified healthcare facilities queried live from OpenStreetMap and Google Places (when configured).
    Strictly filters within radius_km (default 5.0 km). Zero synthetic demo data.
    """
    return await query_verified_facilities(
        lat=lat,
        lon=lon,
        radius_km=radius_km,
        category=category,
        query=query
    )


@router.get("/nearby/healthcare", response_model=List[HealthcareFacilityResponse], summary="Get Nearby Healthcare Facilities by GPS Coordinates")
async def get_nearby_healthcare(
    latitude: float = Query(..., description="User GPS Latitude (-90 to 90)", ge=-90.0, le=90.0),
    longitude: float = Query(..., description="User GPS Longitude (-180 to 180)", ge=-180.0, le=180.0),
    radius: float = Query(5000.0, description="Radius in meters (e.g. 2000, 5000, 10000, 25000) or kilometers", gt=0.0),
    category: Optional[str] = Query("all", description="all | phc | hospital | clinic | emergency | pharmacy | diagnostic")
):
    """
    Standard GPS Nearby endpoint for GramCare AI.
    Accepts latitude, longitude, and radius (in meters or km).
    Returns real verified healthcare facilities within the radius, sorted strictly nearest to farthest.
    """
    radius_km = radius / 1000.0 if radius > 100.0 else radius
    return await query_verified_facilities(
        lat=latitude,
        lon=longitude,
        radius_km=radius_km,
        category=category
    )
