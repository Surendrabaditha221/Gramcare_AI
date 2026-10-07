import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LocationCoords,
  GeocodedAddress,
  LocationErrorDetails,
  GEOLOCATION_OPTIONS,
  getCurrentDevicePosition,
  watchDevicePosition,
  clearDevicePositionWatch,
  reverseGeocodeNominatim,
  searchLocationByNameOrPin,
  saveActiveLocation,
} from '../services/locationService';

export interface UseRealLocationReturn {
  isDetecting: boolean;
  isGranted: boolean;
  permissionState: 'prompt' | 'granted' | 'denied';
  coords: LocationCoords | null;
  address: GeocodedAddress | null;
  error: LocationErrorDetails | null;
  isGeocoding: boolean;
  locationSource: 'gps' | 'manual' | null;
  refreshLocation: () => Promise<void>;
  setManualLocation: (lat: number, lon: number, addressName?: string) => Promise<void>;
  searchAndSetLocation: (query: string) => Promise<boolean>;
}

export function useRealLocation(): UseRealLocationReturn {
  // Always begin with fresh detection state on mount - NEVER assume cached or IP location
  const [isDetecting, setIsDetecting] = useState<boolean>(true);
  const [isGranted, setIsGranted] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const [address, setAddress] = useState<GeocodedAddress | null>(null);
  const [error, setError] = useState<LocationErrorDetails | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [locationSource, setLocationSource] = useState<'gps' | 'manual' | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const activeRequestIdRef = useRef<number>(0);
  const isRequestInProgressRef = useRef<boolean>(false);
  const watchIdRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<LocationCoords | null>(null);

  const clearWatcher = useCallback(() => {
    if (watchIdRef.current !== null) {
      clearDevicePositionWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const updateGeocodedAddress = useCallback(async (newCoords: LocationCoords) => {
    if (!isMountedRef.current) return;
    setIsGeocoding(true);
    try {
      const result = await reverseGeocodeNominatim(newCoords.latitude, newCoords.longitude);
      if (isMountedRef.current) {
        setAddress(result);
        saveActiveLocation(newCoords, result);
      }
    } catch (e) {
      console.warn('[useRealLocation] Geocoding error:', e);
    } finally {
      if (isMountedRef.current) {
        setIsGeocoding(false);
      }
    }
  }, []);

  // Background watcher for real device movement after initial position acquisition
  const startMovementWatcher = useCallback(() => {
    clearWatcher();
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    watchIdRef.current = watchDevicePosition(
      (newCoords: LocationCoords) => {
        if (!isMountedRef.current) return;
        if (lastCoordsRef.current) {
          const latDiff = Math.abs(newCoords.latitude - lastCoordsRef.current.latitude);
          const lonDiff = Math.abs(newCoords.longitude - lastCoordsRef.current.longitude);
          if (latDiff < 0.0003 && lonDiff < 0.0003) {
            return;
          }
        }
        console.log(`[useRealLocation Watch] Updated GPS position: ${newCoords.latitude}, ${newCoords.longitude}`);
        setCoords(newCoords);
        lastCoordsRef.current = newCoords;
        setIsGranted(true);
        setPermissionState('granted');
        setLocationSource('gps');
        updateGeocodedAddress(newCoords);
      },
      (err: LocationErrorDetails) => {
        console.warn('[useRealLocation Watch] Background watch error:', err);
        clearWatcher();
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 10000,
      }
    );
  }, [clearWatcher, updateGeocodedAddress]);

  // Primary GPS position acquisition (Real Device GPS Only)
  const fetchPosition = useCallback(async (isManualRetry: boolean = false) => {
    // Prevent duplicate simultaneous requests unless explicitly retried
    if (isRequestInProgressRef.current && !isManualRetry) {
      console.log('[useRealLocation] GPS request already in progress, skipping duplicate.');
      return;
    }

    clearWatcher();

    const reqId = ++activeRequestIdRef.current;
    isRequestInProgressRef.current = true;

    setIsDetecting(true);
    setError(null);

    try {
      const position = await getCurrentDevicePosition(GEOLOCATION_OPTIONS);

      // Guard against unmounted component or superseded request
      if (!isMountedRef.current || reqId !== activeRequestIdRef.current) {
        return;
      }

      isRequestInProgressRef.current = false;
      console.log(`[useRealLocation] GPS acquired: lat=${position.latitude}, lon=${position.longitude}, acc=${position.accuracy}m`);

      setCoords(position);
      lastCoordsRef.current = position;
      setIsGranted(true);
      setPermissionState('granted');
      setLocationSource('gps');
      setIsDetecting(false);
      setError(null);

      await updateGeocodedAddress(position);

      // Start movement watcher only after initial GPS successfully resolved
      if (isMountedRef.current && reqId === activeRequestIdRef.current) {
        startMovementWatcher();
      }
    } catch (err: any) {
      if (!isMountedRef.current || reqId !== activeRequestIdRef.current) {
        return;
      }

      isRequestInProgressRef.current = false;
      clearWatcher();

      const errDetail = err as LocationErrorDetails;
      console.warn('[useRealLocation] GPS acquisition failed:', errDetail);

      setCoords(null);
      lastCoordsRef.current = null;
      setIsGranted(false);
      setIsDetecting(false);

      if (errDetail.code === 'PERMISSION_DENIED') {
        setPermissionState('denied');
        setError({
          code: 'PERMISSION_DENIED',
          message: 'Location permission is required to find healthcare facilities near you. Please enable location permissions in your browser or device settings.',
        });
      } else if (errDetail.code === 'TIMEOUT') {
        setError({
          code: 'TIMEOUT',
          message: 'Unable to get your current location. Please make sure Location Services are enabled and try again, or enter your location manually.',
        });
      } else if (errDetail.code === 'UNSUPPORTED') {
        setError({
          code: 'UNSUPPORTED',
          message: 'Geolocation is not supported by your browser. Please search by village, city, town, or PIN code.',
        });
      } else {
        setError({
          code: 'POSITION_UNAVAILABLE',
          message: 'Your device location is currently unavailable. Please check your device location settings and try again.',
        });
      }
    }
  }, [clearWatcher, startMovementWatcher, updateGeocodedAddress]);

  // Search by village, town, city, PIN code
  const searchAndSetLocation = useCallback(async (query: string): Promise<boolean> => {
    if (!query.trim()) return false;
    clearWatcher();
    activeRequestIdRef.current++;
    isRequestInProgressRef.current = false;

    setIsDetecting(true);
    setError(null);
    const result = await searchLocationByNameOrPin(query);
    if (!isMountedRef.current) return false;

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
      setError(null);
      saveActiveLocation(searchCoords, { displayName: result.displayName });
      return true;
    }
    setIsDetecting(false);
    setError({
      code: 'POSITION_UNAVAILABLE',
      message: 'Could not find location coordinates. Please verify spelling or enter PIN code.',
    });
    return false;
  }, [clearWatcher]);

  // Manual latitude/longitude submission
  const setManualLocation = useCallback(async (lat: number, lon: number, addressName?: string) => {
    clearWatcher();
    activeRequestIdRef.current++;
    isRequestInProgressRef.current = false;

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
    setError(null);

    if (addressName) {
      const manualAddress = { displayName: addressName };
      setAddress(manualAddress);
      saveActiveLocation(manualCoords, manualAddress);
    } else {
      await updateGeocodedAddress(manualCoords);
    }
  }, [clearWatcher, updateGeocodedAddress]);

  // Permissions API listener
  useEffect(() => {
    let permissionStatusObj: PermissionStatus | null = null;
    let isCancelled = false;

    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        if (isCancelled || !isMountedRef.current) return;
        permissionStatusObj = status;
        setPermissionState(status.state as any);

        status.onchange = () => {
          if (isCancelled || !isMountedRef.current) return;
          setPermissionState(status.state as any);
          if (status.state === 'granted') {
            fetchPosition(true);
          } else if (status.state === 'denied') {
            clearWatcher();
            setIsGranted(false);
            setCoords(null);
            setError({
              code: 'PERMISSION_DENIED',
              message: 'Location permission is required to find healthcare facilities near you. Please enable location permissions in your browser or device settings.',
            });
          }
        };
      }).catch((err) => {
        console.warn('[useRealLocation] Permissions API query error:', err);
      });
    }

    return () => {
      isCancelled = true;
      if (permissionStatusObj) {
        permissionStatusObj.onchange = null;
      }
    };
  }, [clearWatcher, fetchPosition]);

  // Initial GPS position acquisition on mount
  useEffect(() => {
    isMountedRef.current = true;

    // Purge any stale IP-based coordinates from localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('gramcare_active_location');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.coords?.source === 'ip') {
            localStorage.removeItem('gramcare_active_location');
          }
        }
      }
    } catch {}

    fetchPosition(false);

    return () => {
      isMountedRef.current = false;
      isRequestInProgressRef.current = false;
      clearWatcher();
    };
  }, [clearWatcher, fetchPosition]);

  const handleRefresh = useCallback(() => fetchPosition(true), [fetchPosition]);

  return {
    isDetecting,
    isGranted,
    permissionState,
    coords,
    address,
    error,
    isGeocoding,
    locationSource,
    refreshLocation: handleRefresh,
    setManualLocation,
    searchAndSetLocation,
  };
}
