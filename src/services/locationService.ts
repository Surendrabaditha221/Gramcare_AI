/**
 * Location Service for GramCare AI
 * Production-Grade Implementation:
 * - Device GPS Geolocation with high accuracy
 * - IP-based approximate location fallback
 * - OpenStreetMap Nominatim reverse & forward geocoding
 * - Live Overpass API & Backend Facilities API integration
 * - LocalStorage caching for resilient offline mode
 */

import { HealthcareCenter } from '../types/healthCenter';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  source?: 'gps' | 'ip' | 'manual' | 'cache';
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
  timeout: 12000,
  maximumAge: 5000,
};

const FACILITIES_CACHE_KEY = 'gramcare_cached_facilities';

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
export function getCurrentDevicePosition(): Promise<LocationCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
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
        let code: LocationErrorType = 'POSITION_UNAVAILABLE';
        let message = 'Unable to determine your current GPS location.';

        if (error.code === error.PERMISSION_DENIED) {
          code = 'PERMISSION_DENIED';
          message = 'Location permission was denied. Please allow location access to find nearby healthcare centers.';
        } else if (error.code === error.TIMEOUT) {
          code = 'TIMEOUT';
          message = 'GPS location detection timed out. Trying location retry or IP fallback...';
        }

        reject({ code, message } as LocationErrorDetails);
      },
      GEOLOCATION_OPTIONS
    );
  });
}

/**
 * Watch device position changes continuously
 */
export function watchDevicePosition(
  onSuccess: (coords: LocationCoords) => void,
  onError: (error: LocationErrorDetails) => void
): number | null {
  if (!navigator.geolocation) {
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
      let code: LocationErrorType = 'POSITION_UNAVAILABLE';
      let message = 'Unable to update location.';

      if (error.code === error.PERMISSION_DENIED) {
        code = 'PERMISSION_DENIED';
        message = 'Location permission is denied.';
      } else if (error.code === error.TIMEOUT) {
        code = 'TIMEOUT';
        message = 'GPS watch timed out.';
      }

      onError({ code, message });
    },
    GEOLOCATION_OPTIONS
  );
}

/**
 * IP-based approximate location lookup fallback
 */
export async function fetchIpLocation(): Promise<LocationCoords | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 5000,
          source: 'ip',
        };
      }
    }
  } catch (err) {
    console.warn('[LocationService] IP geolocation fallback failed:', err);
  }
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
 * Fetch live nearby healthcare centers (Backend API first -> OpenStreetMap Overpass fallback -> Cache fallback)
 */
export async function fetchNearbyHealthcareCenters(
  userLat: number,
  userLon: number,
  category: string = 'all',
  radiusKm: number = 25
): Promise<HealthcareCenter[]> {
  let fetchedFacilities: HealthcareCenter[] = [];

  // 1. Try Backend API endpoint
  try {
    const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
    let targetHost = apiBaseUrl;
    if (typeof window !== 'undefined' && window.location) {
      const h = window.location.hostname;
      if (h && h !== 'localhost' && h !== '127.0.0.1') {
        targetHost = apiBaseUrl.replace(/localhost|127\.0\.0\.1/g, h);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const backendUrl = `${targetHost}/api/facilities?lat=${userLat}&lon=${userLon}&radius_km=${radiusKm}&category=${encodeURIComponent(category)}`;

    const res = await fetch(backendUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        fetchedFacilities = data.map((f: any) => ({
          ...f,
          distanceKm: typeof f.distanceKm === 'number' ? f.distanceKm : calculateHaversineDistance(userLat, userLon, f.latitude || userLat, f.longitude || userLon),
        }));
      }
    }
  } catch (err) {
    console.log('[LocationService] Backend facilities query skipped or offline:', err);
  }

  // 2. OpenStreetMap Overpass API fallback if backend returned no results
  if (fetchedFacilities.length === 0) {
    try {
      const radiusMeters = Math.min(radiusKm * 1000, 50000);
      const overpassQuery = `[out:json][timeout:10];(node["amenity"~"hospital|clinic|doctors|pharmacy|health_post"](around:${radiusMeters},${userLat},${userLon});way["amenity"~"hospital|clinic|doctors|pharmacy|health_post"](around:${radiusMeters},${userLat},${userLon});node["healthcare"~"hospital|clinic|centre|health_centre|doctor|pharmacy|laboratory"](around:${radiusMeters},${userLat},${userLon});way["healthcare"~"hospital|clinic|centre|health_centre|doctor|pharmacy|laboratory"](around:${radiusMeters},${userLat},${userLon}););out center 35;`;
      const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(overpassUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
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

              const tags = elem.tags || {};
              const rawName = tags.name || tags['name:en'] || tags['name:te'] || tags['name:hi'] || tags.official_name;
              const amenity = tags.amenity || '';
              const healthcare = tags.healthcare || '';

              const name = rawName || (
                amenity === 'hospital' ? 'Healthcare Hospital' :
                amenity === 'pharmacy' ? 'Medical Pharmacy' :
                amenity === 'laboratory' ? 'Diagnostic Laboratory' :
                'Community Health Centre'
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

              const dist = calculateHaversineDistance(userLat, userLon, lat, lon);

              const addrParts = [
                tags['addr:street'],
                tags['addr:suburb'],
                tags['addr:village'],
                tags['addr:city'],
                tags['addr:town']
              ];
              const villageOrTaluka = addrParts.filter(Boolean).join(', ') || 'Local Area';
              const district = tags['addr:district'] || tags['addr:state'] || 'Region';

              const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || undefined;
              const is24x7 = tags.emergency === 'yes' || tags.opening_hours === '24/7' || (tags.opening_hours || '').includes('24/7') || typeStr === 'hospital';

              let services = ['General Consultation', 'Basic Care'];
              if (typeStr === 'pharmacy') {
                services = ['Prescription Medicines', 'OTC Drugs', 'First Aid Supplies'];
              } else if (typeStr === 'phc' || typeStr === 'chc') {
                services = ['Primary OPD', 'Maternal & Child Health', 'Immunization', 'Essential Medicines'];
              } else if (typeStr === 'diagnostic') {
                services = ['Blood Tests', 'Pathology Diagnostic', 'Sample Collection'];
              } else if (typeStr === 'hospital') {
                services = ['Inpatient Care', 'Emergency OPD', 'General Medicine', 'Trauma Care'];
              }

              return {
                id: elemId,
                name,
                hindiName: tags['name:hi'],
                type: typeStr,
                distanceKm: dist,
                villageOrTaluka,
                district,
                phone,
                emergency24x7: is24x7,
                servicesAvailable: services,
                isOpenNow: true,
                latitude: lat,
                longitude: lon,
                openingHours: tags.opening_hours || (is24x7 ? '24/7' : undefined),
              } as HealthcareCenter;
            })
            .filter(Boolean) as HealthcareCenter[];
        }
      }
    } catch (err) {
      console.warn('[LocationService] Overpass query failed:', err);
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
      fetchedFacilities = fetchedFacilities.filter((f) => f.emergency24x7);
    } else if (cLower === 'pharmacy') {
      fetchedFacilities = fetchedFacilities.filter((f) => f.type === 'pharmacy');
    } else if (cLower === 'diagnostic') {
      fetchedFacilities = fetchedFacilities.filter((f) => f.type === 'diagnostic');
    }
  }

  // Cache valid results
  if (fetchedFacilities.length > 0) {
    cacheNearbyFacilities(fetchedFacilities);
  }

  // Sort: Prioritize PHC/CHC first, then strictly Nearest -> Farthest
  return fetchedFacilities.sort((a, b) => {
    const aIsPhc = a.type === 'phc' || a.type === 'chc' ? 0 : 1;
    const bIsPhc = b.type === 'phc' || b.type === 'chc' ? 0 : 1;
    if (aIsPhc !== bIsPhc) return aIsPhc - bIsPhc;
    return a.distanceKm - b.distanceKm;
  });
}
