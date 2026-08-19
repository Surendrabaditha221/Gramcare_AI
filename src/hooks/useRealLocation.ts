import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LocationCoords,
  GeocodedAddress,
  LocationErrorDetails,
  getCurrentDevicePosition,
  watchDevicePosition,
  reverseGeocodeNominatim,
  fetchIpLocation,
  searchLocationByNameOrPin,
} from '../services/locationService';

export interface UseRealLocationReturn {
  isDetecting: boolean;
  isGranted: boolean;
  permissionState: 'prompt' | 'granted' | 'denied';
  coords: LocationCoords | null;
  address: GeocodedAddress | null;
  error: LocationErrorDetails | null;
  isGeocoding: boolean;
  locationSource: 'gps' | 'ip' | 'manual' | 'cache' | null;
  refreshLocation: () => Promise<void>;
  setManualLocation: (lat: number, lon: number, addressName?: string) => Promise<void>;
  searchAndSetLocation: (query: string) => Promise<boolean>;
  useIpFallback: () => Promise<boolean>;
}

export function useRealLocation(): UseRealLocationReturn {
  const [isDetecting, setIsDetecting] = useState<boolean>(true);
  const [isGranted, setIsGranted] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const [address, setAddress] = useState<GeocodedAddress | null>(null);
  const [error, setError] = useState<LocationErrorDetails | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [locationSource, setLocationSource] = useState<'gps' | 'ip' | 'manual' | 'cache' | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<LocationCoords | null>(null);

  const updateGeocodedAddress = useCallback(async (newCoords: LocationCoords) => {
    setIsGeocoding(true);
    const result = await reverseGeocodeNominatim(newCoords.latitude, newCoords.longitude);
    setAddress(result);
    setIsGeocoding(false);
  }, []);

  // IP Location Fallback handler
  const useIpFallback = useCallback(async (): Promise<boolean> => {
    setIsDetecting(true);
    const ipCoords = await fetchIpLocation();
    if (ipCoords) {
      setCoords(ipCoords);
      lastCoordsRef.current = ipCoords;
      setIsGranted(true);
      setLocationSource('ip');
      setIsDetecting(false);
      setError(null);
      await updateGeocodedAddress(ipCoords);
      return true;
    }
    setIsDetecting(false);
    return false;
  }, [updateGeocodedAddress]);

  // Primary GPS position acquisition
  const fetchPosition = useCallback(async () => {
    setIsDetecting(true);
    setError(null);
    try {
      const position = await getCurrentDevicePosition();
      setCoords(position);
      lastCoordsRef.current = position;
      setIsGranted(true);
      setPermissionState('granted');
      setLocationSource('gps');
      setIsDetecting(false);
      await updateGeocodedAddress(position);
    } catch (err: any) {
      console.warn('[useRealLocation] Location acquisition failed:', err);
      const errDetail = err as LocationErrorDetails;
      setError(errDetail);
      if (errDetail.code === 'PERMISSION_DENIED') {
        setPermissionState('denied');
        setIsGranted(false);
        setIsDetecting(false);
      } else {
        // Try IP fallback automatically for TIMEOUT or POSITION_UNAVAILABLE
        const ipSuccess = await useIpFallback();
        if (!ipSuccess) {
          setIsGranted(false);
          setIsDetecting(false);
        }
      }
    }
  }, [updateGeocodedAddress, useIpFallback]);

  // Search by village, town, city, PIN code
  const searchAndSetLocation = useCallback(async (query: string): Promise<boolean> => {
    if (!query.trim()) return false;
    setIsDetecting(true);
    setError(null);
    const result = await searchLocationByNameOrPin(query);
    if (result) {
      const searchCoords: LocationCoords = {
        latitude: result.lat,
        longitude: result.lon,
        accuracy: 100,
        source: 'manual',
      };
      setCoords(searchCoords);
      lastCoordsRef.current = searchCoords;
      setIsGranted(true);
      setLocationSource('manual');
      setAddress({ displayName: result.displayName });
      setIsDetecting(false);
      return true;
    }
    setIsDetecting(false);
    return false;
  }, []);

  // Manual latitude/longitude submission
  const setManualLocation = useCallback(async (lat: number, lon: number, addressName?: string) => {
    setIsDetecting(true);
    setError(null);
    const manualCoords: LocationCoords = {
      latitude: lat,
      longitude: lon,
      accuracy: 10,
      source: 'manual',
    };
    setCoords(manualCoords);
    lastCoordsRef.current = manualCoords;
    setIsGranted(true);
    setLocationSource('manual');
    setIsDetecting(false);

    if (addressName) {
      setAddress({ displayName: addressName });
    } else {
      await updateGeocodedAddress(manualCoords);
    }
  }, [updateGeocodedAddress]);

  // Position watcher callback
  const handleWatchSuccess = useCallback((newCoords: LocationCoords) => {
    if (lastCoordsRef.current) {
      const latDiff = Math.abs(newCoords.latitude - lastCoordsRef.current.latitude);
      const lonDiff = Math.abs(newCoords.longitude - lastCoordsRef.current.longitude);
      if (latDiff < 0.0005 && lonDiff < 0.0005) {
        return;
      }
    }
    setCoords(newCoords);
    lastCoordsRef.current = newCoords;
    setIsGranted(true);
    setPermissionState('granted');
    setLocationSource('gps');
    setIsDetecting(false);
    updateGeocodedAddress(newCoords);
  }, [updateGeocodedAddress]);

  const handleWatchError = useCallback((err: LocationErrorDetails) => {
    if (!lastCoordsRef.current) {
      setError(err);
      if (err.code === 'PERMISSION_DENIED') {
        setPermissionState('denied');
      }
      setIsGranted(false);
      setIsDetecting(false);
    }
  }, []);

  // Permissions API listener
  useEffect(() => {
    let permissionStatusObj: PermissionStatus | null = null;

    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        permissionStatusObj = status;
        setPermissionState(status.state as any);
        if (status.state === 'granted' && !lastCoordsRef.current) {
          fetchPosition();
        }

        status.onchange = () => {
          setPermissionState(status.state as any);
          if (status.state === 'granted') {
            fetchPosition();
          } else if (status.state === 'denied') {
            setIsGranted(false);
            setError({
              code: 'PERMISSION_DENIED',
              message: 'Location permission was denied in browser settings.',
            });
          }
        };
      }).catch((err) => {
        console.warn('[useRealLocation] Permissions API query error:', err);
      });
    }

    return () => {
      if (permissionStatusObj) {
        permissionStatusObj.onchange = null;
      }
    };
  }, [fetchPosition]);

  // Initial trigger on mount
  useEffect(() => {
    fetchPosition();

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      watchIdRef.current = watchDevicePosition(handleWatchSuccess, handleWatchError);
    }

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [fetchPosition, handleWatchSuccess, handleWatchError]);

  return {
    isDetecting,
    isGranted,
    permissionState,
    coords,
    address,
    error,
    isGeocoding,
    locationSource,
    refreshLocation: fetchPosition,
    setManualLocation,
    searchAndSetLocation,
    useIpFallback,
  };
}
