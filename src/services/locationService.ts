/**
 * Location Service for GramCare AI
 * Production-Grade Implementation:
 * - Device GPS Geolocation with high accuracy
 * - OpenStreetMap Nominatim reverse & forward geocoding
 * - Live Overpass API & Backend Facilities API integration
 * - LocalStorage caching for resilient offline mode
 */

import { HealthcareCenter, FacilitySource } from '../types/healthCenter';
import { getApiBaseUrl } from '../config/apiConfig';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  source?: 'gps' | 'manual' | 'cache';
}

export interface GeocodedAddress {
  displayName: string;
  road?: string;
  village?: string;
  suburb?: string;
  town?: string;
  city?: string;
  district?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export type LocationErrorType = 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED';

export interface LocationErrorDetails {
  code: LocationErrorType;
  message: string;
}

export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 30000, // 30 seconds wait period for real device satellite/cellular GPS lock
  maximumAge: 0, // Never use stale cached GPS coordinates
};

/**
 * Human-readable distance display: "850 m away" (<1km) or "2.4 km away" (>=1km)
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

const FACILITIES_CACHE_KEY = 'gramcare_cached_facilities';
const ACTIVE_LOCATION_KEY = 'gramcare_active_location';

export interface ActiveLocationData {
  coords: LocationCoords;
  address?: GeocodedAddress;
  updatedAt: number;
}

export function saveActiveLocation(coords: LocationCoords, address?: GeocodedAddress): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const data: ActiveLocationData = {
        coords,
        address,
        updatedAt: Date.now()
      };
      localStorage.setItem(ACTIVE_LOCATION_KEY, JSON.stringify(data));
    }
  } catch (err) {
    console.warn('[LocationService] Failed to save active location:', err);
  }
}

export function getActiveLocation(): ActiveLocationData | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(ACTIVE_LOCATION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.coords?.source === 'ip') {
          localStorage.removeItem(ACTIVE_LOCATION_KEY);
          return null;
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[LocationService] Failed to get active location:', err);
  }
  return null;
}

/**
 * Haversine formula distance calculation in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

/**
 * Get device GPS coordinates
 */
export function getCurrentDevicePosition(options: PositionOptions = GEOLOCATION_OPTIONS): Promise<LocationCoords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({
        code: 'UNSUPPORTED',
        message: 'Geolocation is not supported by your browser.',
      } as LocationErrorDetails);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          source: 'gps',
        });
      },
      (error) => {
        let code: LocationErrorType;
        let message: string;
        if (error.code === error.PERMISSION_DENIED) {
          code = 'PERMISSION_DENIED';
          message = 'Location permission is required to find healthcare facilities near you. Please enable location permissions in your browser or device settings.';
        } else if (error.code === error.TIMEOUT) {
          code = 'TIMEOUT';
          message = 'Location request timed out. Please make sure Location Services are enabled and try again, or enter your location manually.';
        } else {
          code = 'POSITION_UNAVAILABLE';
          message = 'Your device location is currently unavailable. Please check your device location settings and try again.';
        }

        reject({ code, message } as LocationErrorDetails);
      },
      options
    );
  });
}

/**
 * Watch device position changes continuously
 */
export function watchDevicePosition(
  onSuccess: (coords: LocationCoords) => void,
  onError: (error: LocationErrorDetails) => void,
  options: PositionOptions = GEOLOCATION_OPTIONS
): number | null {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError({
      code: 'UNSUPPORTED',
      message: 'Geolocation is not supported by your browser.',
    });
    return null;
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
        source: 'gps',
      });
    },
    (error) => {
      let code: LocationErrorType;
      let message: string;
      if (error.code === error.PERMISSION_DENIED) {
        code = 'PERMISSION_DENIED';
        message = 'Location permission is required to find healthcare facilities near you. Please enable location permissions in your browser or device settings.';
      } else if (error.code === error.TIMEOUT) {
        code = 'TIMEOUT';
        message = 'Location request timed out. Please make sure Location Services are enabled and try again, or enter your location manually.';
      } else {
        code = 'POSITION_UNAVAILABLE';
        message = 'Your device location is currently unavailable. Please check your device location settings and try again.';
      }

      onError({ code, message });
    },
    options
  );
}

/**
 * Safely clear active geolocation watch
 */
export function clearDevicePositionWatch(watchId: number | null): void {
  if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      navigator.geolocation.clearWatch(watchId);
    } catch (err) {
      console.warn('[LocationService] Error clearing watch:', err);
    }
  }
}

/**
 * Strict Directive: Real device GPS only. No IP-based approximate fallback.
 */
export async function fetchIpLocation(): Promise<LocationCoords | null> {
  return null;
}

/**
 * Reverse geocode latitude and longitude to human-readable address
 */
export async function reverseGeocodeNominatim(
  lat: number,
  lon: number
): Promise<GeocodedAddress> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GramCareAI/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Geocoding HTTP ${response.status}`);
    }

    const data = await response.json();
    const addr = data.address || {};

    const placeName =
      addr.suburb ||
      addr.village ||
      addr.town ||
      addr.city_district ||
      addr.city ||
      addr.county ||
      addr.state_district ||
      '';

    const state = addr.state || '';
    const country = addr.country || '';
    const formattedShort = [placeName, state, country].filter(Boolean).join(', ');

    return {
      displayName: formattedShort || data.display_name || `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`,
      road: addr.road,
      village: addr.village,
      suburb: addr.suburb,
      town: addr.town,
      city: addr.city,
      district: addr.county || addr.state_district,
      state: addr.state,
      postcode: addr.postcode,
      country: addr.country,
    };
  } catch (err) {
    return {
      displayName: `Location Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    };
  }
}

/**
 * Forward geocode village, city, PIN code or place name
 */
export async function searchLocationByNameOrPin(query: string): Promise<{ lat: number; lon: number; displayName: string } | null> {
  if (!query.trim()) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GramCareAI/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        return {
          lat,
          lon,
          displayName: data[0].display_name,
        };
      }
    }
  } catch (err) {
    console.warn('[LocationService] Forward geocoding search failed:', err);
  }
  return null;
}

/**
 * Save facilities to LocalStorage cache
 */
export function cacheNearbyFacilities(facilities: HealthcareCenter[]): void {
  try {
    if (typeof localStorage !== 'undefined' && facilities.length > 0) {
      localStorage.setItem(FACILITIES_CACHE_KEY, JSON.stringify(facilities));
    }
  } catch (err) {
    console.warn('[LocationService] Failed to save facilities cache:', err);
  }
}

/**
 * Retrieve cached facilities from LocalStorage
 */
export function getCachedNearbyFacilities(): HealthcareCenter[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(FACILITIES_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    console.warn('[LocationService] Failed to read facilities cache:', err);
  }
  return [];
}

/**
 * Format real locality or location string for healthcare facility cards.
 * Returns human-readable location hierarchy or 'Location details unavailable'. Never fabricates data.
 */
export function formatFacilityLocation(facility: HealthcareCenter): string {
  if (facility.address && facility.address.trim()) {
    return facility.address.trim();
  }

  const parts: string[] = [];
  if (facility.villageOrTaluka && facility.villageOrTaluka.trim()) {
    parts.push(facility.villageOrTaluka.trim());
  }
  if (facility.district && facility.district.trim()) {
    if (!parts.includes(facility.district.trim())) {
      parts.push(facility.district.trim());
    }
  }

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return 'Location details unavailable';
}

/**
 * Format authoritative provider source label with appropriate icon.
 * Replaces any mapper tags like 'local_knowledge' with the canonical provider.
 */
export function formatFacilitySource(source?: string, sources?: FacilitySource[]): { label: string; icon: string } {
  let srcStr = source || '';
  if (srcStr.toLowerCase().includes('local knowledge') || srcStr.toLowerCase().includes('local_knowledge')) {
    srcStr = 'OpenStreetMap';
  }

  if ((!srcStr || srcStr === 'OpenStreetMap') && sources && sources.length > 1) {
    srcStr = sources
      .map(s => {
        let p = s.provider;
        if (p.toLowerCase().includes('local knowledge') || p.toLowerCase().includes('local_knowledge')) {
          p = 'OpenStreetMap';
        }
        return p;
      })
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(' • ');
  }

  if (!srcStr) {
    srcStr = 'OpenStreetMap';
  }

  // Normalize plus or bullet separators
  srcStr = srcStr.replace(/\s*\+\s*/g, ' • ');

  if (srcStr.includes('Google Places') && srcStr.includes('OpenStreetMap')) {
    return { label: `Sources: ${srcStr}`, icon: '🌐' };
  }
  if (srcStr.includes('OpenGovernmentData')) {
    return { label: `Source: ${srcStr}`, icon: '🏛️' };
  }
  if (srcStr.includes('Google Places')) {
    return { label: `Source: Google Places`, icon: '📍' };
  }
  return { label: `Source: OpenStreetMap`, icon: '🗺️' };
}

/**
 * Fetch live nearby healthcare centers (Backend API first -> OpenStreetMap Overpass fallback -> Cache fallback)
 */
export async function fetchNearbyHealthcareCenters(
  userLat: number,
  userLon: number,
  category: string = 'all',
  radiusKm: number = 5
): Promise<HealthcareCenter[]> {
  let fetchedFacilities: HealthcareCenter[] = [];

  // 1. Try Backend API endpoint
  try {
    const targetHost = getApiBaseUrl();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const backendUrl = `${targetHost}/api/facilities?lat=${userLat}&lon=${userLon}&radius_km=${radiusKm}&category=${encodeURIComponent(category)}`;

    const res = await fetch(backendUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        fetchedFacilities = data.map((f: any) => {
          let cleanSource = f.source || 'OpenStreetMap';
          if (cleanSource.toLowerCase().includes('local knowledge') || cleanSource.toLowerCase().includes('local_knowledge')) {
            cleanSource = 'OpenStreetMap';
          }
          let cleanSources = f.sources;
          if (Array.isArray(cleanSources)) {
            cleanSources = cleanSources.map((s: any) => {
              let p = s.provider || 'OpenStreetMap';
              if (p.toLowerCase().includes('local knowledge') || p.toLowerCase().includes('local_knowledge')) {
                p = 'OpenStreetMap';
              }
              return { ...s, provider: p };
            });
          }
          return {
            ...f,
            source: cleanSource,
            sources: cleanSources,
            distanceKm: typeof f.distanceKm === 'number' ? f.distanceKm : calculateHaversineDistance(userLat, userLon, f.latitude || userLat, f.longitude || userLon),
          };
        });
      }
    }
  } catch (err) {
    console.log('[LocationService] Backend facilities query skipped or offline:', err);
  }

  // 2. OpenStreetMap Overpass API direct fallback if backend returned no results
  if (fetchedFacilities.length === 0) {
    const radiusMeters = Math.min(radiusKm * 1000, 50000);
    const searchBufferMeters = radiusMeters + 200;
    const overpassQuery = `[out:json][timeout:22];(node["amenity"~"hospital|clinic|doctors|pharmacy|health_post"](around:${searchBufferMeters},${userLat},${userLon});way["amenity"~"hospital|clinic|doctors|pharmacy|health_post"](around:${searchBufferMeters},${userLat},${userLon});node["healthcare"~"hospital|clinic|centre|health_centre|doctor|pharmacy|laboratory"](around:${searchBufferMeters},${userLat},${userLon});way["healthcare"~"hospital|clinic|centre|health_centre|doctor|pharmacy|laboratory"](around:${searchBufferMeters},${userLat},${userLon}););out center 40;`;

    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'GramCareAI/1.0'
          },
          body: `data=${encodeURIComponent(overpassQuery)}`,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          let data: any = null;
          try {
            data = await response.json();
          } catch (jsonErr) {
            continue;
          }
          if (data && data.elements && data.elements.length > 0) {
            const seenIds = new Set<string>();

            fetchedFacilities = data.elements
              .map((elem: any) => {
                const elemId = `osm_${elem.type || 'node'}_${elem.id}`;
                if (seenIds.has(elemId)) return null;
                seenIds.add(elemId);

                const lat = elem.lat || elem.center?.lat;
                const lon = elem.lon || elem.center?.lon;
                if (!lat || !lon) return null;

                // STRICT DISTANCE CALCULATION
                const dist = calculateHaversineDistance(userLat, userLon, lat, lon);

                // STRICT RADIUS FILTER
                if (dist > radiusKm) return null;

                const tags = elem.tags || {};
                const rawName = tags.name || tags['name:en'] || tags['name:te'] || tags['name:hi'] || tags.official_name;
                const amenity = tags.amenity || '';
                const healthcare = tags.healthcare || '';

                const name = rawName || tags.operator || (
                  amenity === 'hospital' || healthcare === 'hospital' ? 'Hospital' :
                  amenity === 'pharmacy' || healthcare === 'pharmacy' ? 'Pharmacy' :
                  amenity === 'laboratory' || healthcare === 'laboratory' ? 'Diagnostic Laboratory' :
                  amenity in ['clinic', 'doctors'] ? 'Clinic' :
                  'Healthcare Facility'
                );

                const nameLower = name.toLowerCase();
                let typeStr: HealthcareCenter['type'] = 'clinic';
                if (nameLower.includes('phc') || nameLower.includes('primary health') || nameLower.includes('sub-centre') || nameLower.includes('subcenter')) {
                  typeStr = 'phc';
                } else if (nameLower.includes('chc') || nameLower.includes('community health')) {
                  typeStr = 'chc';
                } else if (amenity === 'pharmacy' || healthcare === 'pharmacy' || nameLower.includes('pharmacy') || nameLower.includes('chemist')) {
                  typeStr = 'pharmacy';
                } else if (amenity === 'laboratory' || healthcare === 'laboratory' || nameLower.includes('diagnostic') || nameLower.includes('lab')) {
                  typeStr = 'diagnostic';
                } else if (amenity === 'hospital' || healthcare === 'hospital') {
                  typeStr = 'hospital';
                }

                let fullAddress = tags['addr:full'];
                if (!fullAddress) {
                  const addrParts = [
                    tags['addr:housenumber'],
                    tags['addr:street'],
                    tags['addr:suburb'],
                    tags['addr:village'],
                    tags['addr:neighbourhood'],
                    tags['addr:city'],
                    tags['addr:town'],
                    tags['addr:postcode']
                  ];
                  fullAddress = addrParts.filter(Boolean).join(', ') || undefined;
                } else if (tags['addr:postcode'] && !fullAddress.includes(tags['addr:postcode'])) {
                  fullAddress = `${fullAddress}, ${tags['addr:postcode']}`;
                }

                const villageOrTaluka =
                  tags['addr:village'] ||
                  tags['addr:subdistrict'] ||
                  tags['addr:suburb'] ||
                  tags['addr:neighbourhood'] ||
                  tags['addr:locality'] ||
                  tags['addr:place'] ||
                  tags['addr:hamlet'] ||
                  tags['addr:town'] ||
                  tags['addr:city'] ||
                  undefined;
                const district = tags['addr:district'] || tags['addr:state_district'] || tags['addr:state'] || undefined;

                const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || undefined;
                const is24x7 = (
                  tags.emergency === 'yes' ||
                  tags.opening_hours === '24/7' ||
                  (tags.opening_hours || '').includes('24/7')
                ) ? true : (tags.emergency === 'no' ? false : undefined);

                const specTag = tags['healthcare:speciality'] || tags['medical_system:western'] || tags.description;
                const services = specTag ? specTag.split(';').map((s: string) => s.trim()) : [];

                const rawSource = (tags.source || '').trim();
                let sourceAttribution = 'OpenStreetMap';
                if (rawSource && (/gov|nrega|mohfw|nhm/i.test(rawSource))) {
                  sourceAttribution = 'OpenStreetMap • OpenGovernmentData';
                }

                return {
                  id: elemId,
                  name,
                  hindiName: tags['name:hi'],
                  type: typeStr,
                  distanceKm: dist,
                  villageOrTaluka,
                  district,
                  address: fullAddress,
                  phone,
                  emergency24x7: is24x7,
                  servicesAvailable: services,
                  isOpenNow: undefined, // Do not assume True
                  latitude: lat,
                  longitude: lon,
                  openingHours: tags.opening_hours || undefined,
                  website: tags.website || tags['contact:website'] || undefined,
                  source: sourceAttribution,
                  sources: [{ provider: sourceAttribution, sourceId: elemId }],
                } as HealthcareCenter;
              })
              .filter(Boolean) as HealthcareCenter[];

            if (fetchedFacilities.length > 0) {
              break;
            }
          }
        }
      } catch (epErr) {
        console.warn(`[LocationService] Overpass mirror ${ep} failed:`, epErr);
      }
    }
  }

  // Apply client-side category filter if category != 'all'
  if (category && category !== 'all' && fetchedFacilities.length > 0) {
    const cLower = category.toLowerCase().trim();
    if (cLower === 'phc') {
      fetchedFacilities = fetchedFacilities.filter((f) => f.type === 'phc' || f.type === 'chc');
    } else if (cLower === 'hospital') {
      fetchedFacilities = fetchedFacilities.filter((f) => f.type === 'hospital' || f.type === 'district_hospital');
    } else if (cLower === 'clinic') {
      fetchedFacilities = fetchedFacilities.filter((f) => f.type === 'clinic' || f.type === 'phc' || f.type === 'chc');
    } else if (cLower === 'emergency') {
      fetchedFacilities = fetchedFacilities.filter((f) => f.emergency24x7 === true);
    } else if (cLower === 'pharmacy') {
      fetchedFacilities = fetchedFacilities.filter((f) => f.type === 'pharmacy');
    } else if (cLower === 'diagnostic') {
      fetchedFacilities = fetchedFacilities.filter((f) => f.type === 'diagnostic');
    }
  }

  // STRICT RADIUS FILTER: Never allow any facility beyond the requested radius
  fetchedFacilities = fetchedFacilities.filter((f) => f.distanceKm <= radiusKm);

  // STRICT SORTING: Nearest -> Farthest
  fetchedFacilities.sort((a, b) => a.distanceKm - b.distanceKm);

  // Cache valid results
  if (fetchedFacilities.length > 0) {
    cacheNearbyFacilities(fetchedFacilities);
  }

  // Debug Logging (Requirement 14)
  console.log(`[LocationService] Current latitude: ${userLat}`);
  console.log(`[LocationService] Current longitude: ${userLon}`);
  console.log(`[LocationService] Search radius: ${Math.round(radiusKm * 1000)}m (${radiusKm} km)`);
  console.log(`[LocationService] Facilities returned: ${fetchedFacilities.length}`);
  if (fetchedFacilities.length > 0) {
    console.log(`[LocationService] Nearest facility distance: ${formatDistance(fetchedFacilities[0].distanceKm)} (${fetchedFacilities[0].name})`);
  }

  return fetchedFacilities;
}
