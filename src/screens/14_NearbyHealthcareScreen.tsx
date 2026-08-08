import React, { useEffect, useState, useCallback } from 'react';
import {
  Hospital,
  MapPin,
  PhoneCall,
  Navigation,
  Clock,
  UserCheck,
  RefreshCw,
  AlertTriangle,
  Compass,
  Wifi,
  Search,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useRealLocation } from '../hooks/useRealLocation';
import { fetchNearbyHealthcareCenters } from '../services/locationService';
import { localStorageService } from '../services/localStorageService';
import { HealthcareCenter } from '../types/healthCenter';

export const NearbyHealthcareScreen: React.FC = () => {
  const { t } = useLanguage();
  const { isOnline, isBackendAvailable } = useOnlineStatus();
  const {
    isDetecting,
    isGranted,
    coords,
    address,
    error,
    isGeocoding,
    refreshLocation,
    setManualLocation,
  } = useRealLocation();

  const [facilities, setFacilities] = useState<HealthcareCenter[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState<boolean>(false);
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [manualAddressInput, setManualAddressInput] = useState<string>('');
  const [manualLatInput, setManualLatInput] = useState<string>('');
  const [manualLonInput, setManualLonInput] = useState<string>('');
  const [manualSubmitError, setManualSubmitError] = useState<string>('');

  // Load healthcare facilities whenever real user coordinates change
  const loadFacilitiesForCoords = useCallback(async (lat: number, lon: number) => {
    setIsLoadingFacilities(true);
    try {
      const results = await fetchNearbyHealthcareCenters(lat, lon);
      setFacilities(results);
    } catch (err) {
      console.error('[NearbyHealthcareScreen] Error loading facilities:', err);
    } finally {
      setIsLoadingFacilities(false);
    }
  }, []);

  useEffect(() => {
    if (coords) {
      loadFacilitiesForCoords(coords.latitude, coords.longitude);
    }
  }, [coords, loadFacilitiesForCoords]);

  // Handle manual location submit (address or lat/lon)
  const handleManualLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualSubmitError('');

    if (manualLatInput && manualLonInput) {
      const parsedLat = parseFloat(manualLatInput);
      const parsedLon = parseFloat(manualLonInput);
      if (isNaN(parsedLat) || isNaN(parsedLon) || parsedLat < -90 || parsedLat > 90 || parsedLon < -180 || parsedLon > 180) {
        setManualSubmitError('Please enter valid Latitude (-90 to 90) and Longitude (-180 to 180).');
        return;
      }
      await setManualLocation(parsedLat, parsedLon, manualAddressInput || undefined);
      setShowManualInput(false);
      return;
    }

    if (manualAddressInput.trim()) {
      try {
        setIsLoadingFacilities(true);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddressInput.trim())}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'GramCareAI/1.0' } });
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          await setManualLocation(lat, lon, data[0].display_name);
          setShowManualInput(false);
        } else {
          setManualSubmitError('Could not find location coordinates for the entered place. Try typing city/town name or latitude/longitude.');
        }
      } catch (err) {
        setManualSubmitError('Error searching location. Please check network connection or enter coordinates.');
      } finally {
        setIsLoadingFacilities(false);
      }
    } else {
      setManualSubmitError('Please enter a location name or coordinates.');
    }
  };

  const handleGetDirections = (facility: HealthcareCenter, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!coords) return;

    const userLat = coords.latitude;
    const userLon = coords.longitude;
    const hospLat = facility.latitude ?? userLat;
    const hospLon = facility.longitude ?? userLon;

    console.log("User location:", userLat, userLon);
    console.log("Hospital location:", hospLat, hospLon);

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${hospLat},${hospLon}&travelmode=driving`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '22px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Hospital size={24} />
          {t.nearbyTitle}
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
          Real-time GPS location detection and nearby healthcare search.
        </p>
      </div>

      {/* Independent Status Badges */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '16px',
        backgroundColor: '#f8fafc',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid #e2e8f0'
      }}>
        {/* Internet Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}>
          <Wifi size={14} color={isOnline ? '#16a34a' : '#dc2626'} />
          <span style={{ color: '#475569' }}>Internet:</span>
          <span style={{ color: isOnline ? '#15803d' : '#dc2626' }}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <span style={{ color: '#cbd5e1' }}>•</span>

        {/* GPS Location Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}>
          <Compass size={14} color={isGranted ? '#0f766e' : isDetecting ? '#eab308' : '#dc2626'} />
          <span style={{ color: '#475569' }}>Location:</span>
          <span style={{ color: isGranted ? '#0f766e' : isDetecting ? '#ca8a04' : '#dc2626' }}>
            {isGranted ? 'Available (GPS)' : isDetecting ? 'Detecting...' : 'Permission Required'}
          </span>
        </div>

        <span style={{ color: '#cbd5e1' }}>•</span>

        {/* Healthcare API Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}>
          <Hospital size={14} color={isBackendAvailable ? '#16a34a' : '#2563eb'} />
          <span style={{ color: '#475569' }}>Healthcare API:</span>
          <span style={{ color: isBackendAvailable ? '#15803d' : '#2563eb' }}>
            {isBackendAvailable ? 'Backend Service Available' : 'OpenStreetMap Service'}
          </span>
        </div>
      </div>

      {/* LOCATION DETECTION STATES */}
      {isDetecting ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', marginBottom: '20px' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: '#0f766e', marginBottom: '10px' }} />
          <h3 style={{ margin: 0, color: '#0f766e', fontSize: '18px' }}>
            Detecting your current location...
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
            Requesting device GPS coordinates (High Accuracy)...
          </p>
        </div>
      ) : error && !coords ? (
        /* PERMISSION OR LOCATION ERROR STATE */
        <div className="card" style={{ padding: '20px', backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
            <XCircle size={24} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#991b1b' }}>
                {error.code === 'PERMISSION_DENIED'
                  ? 'Location Permission Required'
                  : error.code === 'TIMEOUT'
                  ? 'Location Timeout'
                  : 'Location Unavailable'}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#b91c1c' }}>
                {error.message}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => refreshLocation()}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} />
              Try Again
            </button>
          </div>
        </div>
      ) : coords && (
        /* SUCCESSFUL LOCATION DISPLAY CARD */
        <div className="card" style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} color="#15803d" />
                Your Location
              </h3>
              <p style={{ margin: '4px 0 2px', fontSize: '16px', fontWeight: 700, color: '#14532d' }}>
                {isGeocoding ? 'Resolving address...' : address?.displayName || 'Current location detected'}
              </p>
              <span style={{ fontSize: '12px', color: '#166534', fontWeight: 500 }}>
                Accuracy: ±{coords.accuracy} meters
              </span>
            </div>

            <button
              onClick={() => refreshLocation()}
              className="btn btn-outline"
              disabled={isDetecting || isGeocoding}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                borderColor: '#86efac',
                color: '#15803d',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} className={isDetecting || isGeocoding ? 'animate-spin' : ''} />
              Refresh Location
            </button>
          </div>

          {/* DEVELOPMENT / DEBUGGING COORDINATES DISPLAY */}
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            backgroundColor: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #dcfce7',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#166534',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <span><strong>Latitude:</strong> {coords.latitude.toFixed(6)}</span>
            <span><strong>Longitude:</strong> {coords.longitude.toFixed(6)}</span>
            <span><strong>Accuracy:</strong> ±{coords.accuracy} m</span>
          </div>
        </div>
      )}

      {/* ASHA Worker Contact Card (Rendered only if real ASHA worker phone is saved in profile) */}
      {(() => {
        const userProfile = localStorageService.getUserProfile();
        if (!userProfile?.ashaWorkerPhone) return null;
        return (
          <div className="card" style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', marginBottom: '20px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div style={{
                backgroundColor: '#0f766e',
                color: '#ffffff',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <UserCheck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#14532d' }}>
                  Local Village ASHA Worker Contact
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#166534' }}>
                  Community Health Activist
                </p>
              </div>
            </div>

            <a
              href={`tel:${userProfile.ashaWorkerPhone}`}
              className="btn btn-primary"
              style={{ padding: '10px', fontSize: '14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <PhoneCall size={16} />
              Call ASHA Worker ({userProfile.ashaWorkerPhone})
            </a>
          </div>
        );
      })()}

      {/* Facilities List Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '18px', color: '#1e293b', margin: 0 }}>
          Nearby Healthcare Centers ({facilities.length})
        </h3>
        {isLoadingFacilities && (
          <span style={{ fontSize: '12px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <RefreshCw size={12} className="animate-spin" /> Updating distance...
          </span>
        )}
      </div>

      {/* Facility Cards List */}
      <div className="grid-responsive-2">
        {facilities.map((facility) => {
          return (
            <div key={facility.id} className="card" style={{ margin: 0, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', color: '#0f766e' }}>
                      {facility.name}
                    </h3>
                    <span style={{ fontSize: '13px', color: '#0f766e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <MapPin size={14} color="#0f766e" />
                      {facility.distanceKm} km away • {facility.villageOrTaluka}, {facility.district}
                    </span>
                  </div>

                  <span className="badge badge-low" style={{ fontSize: '11px', flexShrink: 0 }}>
                    <Clock size={12} />
                    {facility.emergency24x7 ? '24x7 Emergency' : 'OPD Open'}
                  </span>
                </div>

                {/* Services Tags */}
                <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', margin: '10px 0 14px' }}>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Available Services:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {facility.servicesAvailable.map((srv, idx) => (
                      <span key={idx} style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        color: '#334155'
                      }}>
                        {srv}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions: Call & Directions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <a
                  href={`tel:${facility.phone ? facility.phone.replace(/\s+/g, '') : '+91108'}`}
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '8px 12px', fontSize: '13px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <PhoneCall size={14} />
                  {t.callCenter}
                </a>

                <button
                  type="button"
                  onClick={(e) => handleGetDirections(facility, e)}
                  disabled={!coords}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: coords ? 'pointer' : 'not-allowed',
                    opacity: coords ? 1 : 0.6
                  }}
                >
                  <Navigation size={14} />
                  {t.getDirections}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
