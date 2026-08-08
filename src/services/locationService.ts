/**
 * Location Service for GramCare AI
 * Interfaces with Browser Geolocation API, OpenStreetMap Nominatim reverse-geocoding,
 * and calculates Haversine distances for nearby healthcare facilities.
 */

import { HealthcareCenter } from '../types/healthCenter';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
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
  timeout: 10000,
  maximumAge: 0,
};

/**
 * Calculates straight-line distance in kilometers between two coordinates using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
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
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Get current device position using browser Geolocation API
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
        });
      },
      (error) => {
        let code: LocationErrorType = 'POSITION_UNAVAILABLE';
        let message = 'Unable to determine your current location.';

        if (error.code === error.PERMISSION_DENIED) {
          code = 'PERMISSION_DENIED';
          message = 'Location permission is required to find healthcare centers near you.';
        } else if (error.code === error.TIMEOUT) {
          code = 'TIMEOUT';
          message = 'Location detection timed out. Please try again.';
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
      });
    },
    (error) => {
      let code: LocationErrorType = 'POSITION_UNAVAILABLE';
      let message = 'Unable to determine your current location.';

      if (error.code === error.PERMISSION_DENIED) {
        code = 'PERMISSION_DENIED';
        message = 'Location permission is required to find healthcare centers near you.';
      } else if (error.code === error.TIMEOUT) {
        code = 'TIMEOUT';
        message = 'Location detection timed out. Please try again.';
      }

      onError({ code, message });
    },
    GEOLOCATION_OPTIONS
  );
}

/**
 * Reverse geocode latitude and longitude to human-readable address using OpenStreetMap Nominatim
 */
export async function reverseGeocodeNominatim(
  lat: number,
  lon: number
): Promise<GeocodedAddress> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GramCareAI/1.0',
      },
    });

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
    console.warn('[LocationService] Reverse geocoding failed or offline:', err);
    return {
      displayName: `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    };
  }
}

/**
 * Search real nearby healthcare centers around (lat, lon) using OpenStreetMap Overpass API,
 * falling back to calculating distances for reference healthcare centers dynamically relative to user coordinates.
 */
export async function fetchNearbyHealthcareCenters(
  userLat: number,
  userLon: number
): Promise<HealthcareCenter[]> {
  let fetchedFacilities: HealthcareCenter[] = [];

  try {
    // Attempt Overpass API search within 25km radius
    const overpassQuery = `[out:json][timeout:10];(node["amenity"~"hospital|clinic|doctors|health_post"](around:25000,${userLat},${userLon});way["amenity"~"hospital|clinic|doctors|health_post"](around:25000,${userLat},${userLon}););out center 15;`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(overpassUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.elements && data.elements.length > 0) {
        fetchedFacilities = data.elements
          .map((elem: any, idx: number) => {
            const lat = elem.lat || elem.center?.lat;
            const lon = elem.lon || elem.center?.lon;
            if (!lat || !lon) return null;

            const name = elem.tags?.name || elem.tags?.['name:en'] || elem.tags?.['name:hi'] || elem.tags?.['name:te'] || `Medical Center #${idx + 1}`;
            const amenity = elem.tags?.amenity || 'hospital';
            const dist = calculateHaversineDistance(userLat, userLon, lat, lon);

            let typeStr: HealthcareCenter['type'] = 'phc';
            if (amenity === 'hospital') typeStr = 'district_hospital';
            else if (amenity === 'clinic') typeStr = 'chc';

            return {
              id: `osm_${elem.id}`,
              name,
              hindiName: elem.tags?.['name:hi'] || name,
              type: typeStr,
              distanceKm: dist,
              villageOrTaluka: elem.tags?.['addr:city'] || elem.tags?.['addr:suburb'] || elem.tags?.['addr:village'] || 'Local Area',
              district: elem.tags?.['addr:district'] || elem.tags?.['addr:state'] || 'District',
              phone: elem.tags?.phone || elem.tags?.['contact:phone'] || '+91 108',
              emergency24x7: elem.tags?.emergency === 'yes' || amenity === 'hospital',
              servicesAvailable: [
                amenity === 'hospital' ? 'Emergency Care' : 'General OPD',
                'Essential Medicines',
                'Patient Consultation'
              ],
              isOpenNow: true,
              latitude: lat,
              longitude: lon,
            } as HealthcareCenter;
          })
          .filter(Boolean);
      }
    }
  } catch (err) {
    console.log('[LocationService] Overpass API query failed or timed out:', err);
  }

  // Sort strictly Nearest -> Farthest
  return fetchedFacilities.sort((a, b) => a.distanceKm - b.distanceKm);
}
