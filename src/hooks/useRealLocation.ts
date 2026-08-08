import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LocationCoords,
  GeocodedAddress,
  LocationErrorDetails,
  getCurrentDevicePosition,
  watchDevicePosition,
  reverseGeocodeNominatim,
} from '../services/locationService';

export interface UseRealLocationReturn {
  isDetecting: boolean;
  isGranted: boolean;
  coords: LocationCoords | null;
  address: GeocodedAddress | null;
  error: LocationErrorDetails | null;
  isGeocoding: boolean;
  refreshLocation: () => Promise<void>;
  setManualLocation: (lat: number, lon: number, addressName?: string) => Promise<void>;
}

export function useRealLocation(): UseRealLocationReturn {
  const [isDetecting, setIsDetecting] = useState<boolean>(true);
  const [isGranted, setIsGranted] = useState<boolean>(false);
  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const [address, setAddress] = useState<GeocodedAddress | null>(null);
  const [error, setError] = useState<LocationErrorDetails | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<LocationCoords | null>(null);

  // Reverse geocode helper
  const updateGeocodedAddress = useCallback(async (newCoords: LocationCoords) => {
    setIsGeocoding(true);
    const result = await reverseGeocodeNominatim(newCoords.latitude, newCoords.longitude);
    setAddress(result);
    setIsGeocoding(false);
  }, []);

  // Fetch initial single position
  const fetchPosition = useCallback(async () => {
    setIsDetecting(true);
    setError(null);
    try {
      const position = await getCurrentDevicePosition();
      setCoords(position);
      lastCoordsRef.current = position;
      setIsGranted(true);
      setIsDetecting(false);
      await updateGeocodedAddress(position);
    } catch (err: any) {
      console.warn('[useRealLocation] Location acquisition failed:', err);
      setError(err as LocationErrorDetails);
      setIsGranted(false);
      setIsDetecting(false);
    }
  }, [updateGeocodedAddress]);

  // Set manual coordinates when GPS fails or user manually enters location
  const setManualLocation = useCallback(async (lat: number, lon: number, addressName?: string) => {
    setIsDetecting(true);
    setError(null);
    const manualCoords: LocationCoords = {
      latitude: lat,
      longitude: lon,
      accuracy: 10,
    };
    setCoords(manualCoords);
    lastCoordsRef.current = manualCoords;
    setIsGranted(true);
    setIsDetecting(false);

    if (addressName) {
      setAddress({ displayName: addressName });
    } else {
      await updateGeocodedAddress(manualCoords);
    }
  }, [updateGeocodedAddress]);

  // Handle position updates from watchPosition
  const handleWatchSuccess = useCallback((newCoords: LocationCoords) => {
    // Only update if moved > 50 meters to prevent jitter
    if (lastCoordsRef.current) {
      const latDiff = Math.abs(newCoords.latitude - lastCoordsRef.current.latitude);
      const lonDiff = Math.abs(newCoords.longitude - lastCoordsRef.current.longitude);
      // Rough approximation: 0.0005 deg ~ 50 meters
      if (latDiff < 0.0005 && lonDiff < 0.0005) {
        return;
      }
    }
    setCoords(newCoords);
    lastCoordsRef.current = newCoords;
    setIsGranted(true);
    setIsDetecting(false);
    updateGeocodedAddress(newCoords);
  }, [updateGeocodedAddress]);

  const handleWatchError = useCallback((err: LocationErrorDetails) => {
    // Keep existing position if available, but set error if none
    if (!lastCoordsRef.current) {
      setError(err);
      setIsGranted(false);
      setIsDetecting(false);
    }
  }, []);

  useEffect(() => {
    fetchPosition();

    // Start watching position if supported
    if (navigator.geolocation) {
      watchIdRef.current = watchDevicePosition(handleWatchSuccess, handleWatchError);
    }

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [fetchPosition, handleWatchSuccess, handleWatchError]);

  return {
    isDetecting,
    isGranted,
    coords,
    address,
    error,
    isGeocoding,
    refreshLocation: fetchPosition,
    setManualLocation,
  };
}
