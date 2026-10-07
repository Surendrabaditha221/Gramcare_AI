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
  Settings,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useRealLocation } from '../hooks/useRealLocation';
import {
  fetchNearbyHealthcareCenters,
  getCachedNearbyFacilities,
  formatDistance,
  formatFacilityLocation,
} from '../services/locationService';
import { localStorageService } from '../services/localStorageService';
import { HealthcareCenter } from '../types/healthCenter';
import { HealthcareMap } from '../components/HealthcareMap';

interface CategoryOption {
  id: string;
  label: string;
  hindiLabel: string;
  icon: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'all', label: 'All Facilities', hindiLabel: 'सभी केंद्र', icon: '🏥' },
  { id: 'phc', label: 'PHC / CHC (Priority)', hindiLabel: 'प्राथमिक स्वास्थ्य केंद्र', icon: '🏛️' },
  { id: 'hospital', label: 'Hospitals', hindiLabel: 'अस्पताल', icon: '🏨' },
  { id: 'clinic', label: 'Clinics', hindiLabel: 'क्लीनिक', icon: '🩺' },
  { id: 'emergency', label: '24x7 Emergency', hindiLabel: 'आपातकालीन 24x7', icon: '🚨' },
  { id: 'pharmacy', label: 'Pharmacies', hindiLabel: 'दवा दुकान', icon: '💊' },
  { id: 'diagnostic', label: 'Diagnostic Labs', hindiLabel: 'जांच केंद्र', icon: '🔬' },
];

export const NearbyHealthcareScreen: React.FC = () => {
  const { t } = useLanguage();
  const { isOnline } = useOnlineStatus();
  const {
    isDetecting,
    isGranted,
    coords,
    address,
    error,
    isGeocoding,
    locationSource,
    refreshLocation,
    searchAndSetLocation,
  } = useRealLocation();

  const [facilities, setFacilities] = useState<HealthcareCenter[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRadius, setSelectedRadius] = useState<number>(5); // Default 5 km
  const [facilitiesState, setFacilitiesState] = useState<'LOADING' | 'SUCCESS' | 'EMPTY' | 'ERROR'>('LOADING');
  const [isLiveSource, setIsLiveSource] = useState<boolean>(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<Date | null>(null);
  const [isManualSearchOpen, setIsManualSearchOpen] = useState<boolean>(false);
  const [showSettingsGuide, setShowSettingsGuide] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchError, setSearchError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return 'Not updated yet';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 15) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Load facilities whenever coordinates, category, or radius change
  const loadFacilitiesForCoords = useCallback(async (lat: number, lon: number, cat: string, rad: number) => {
    setFacilitiesState('LOADING');
    try {
      console.log(`[NearbyHealthcareScreen] Fetching verified facilities: lat=${lat}, lon=${lon}, radius=${rad}km, cat=${cat}`);
      const results = await fetchNearbyHealthcareCenters(lat, lon, cat, rad);
      setFacilities(results);
      setLastUpdatedTime(new Date());
      setIsLiveSource(true);

      if (results.length > 0) {
        setFacilitiesState('SUCCESS');
        showToast(`Discovered ${results.length} verified healthcare facilities within ${rad} km.`);
      } else {
        setFacilitiesState('EMPTY');
      }
    } catch (err) {
      console.error('[NearbyHealthcareScreen] Error loading facilities:', err);
      const cached = getCachedNearbyFacilities();
      const validCached = cached.filter((f) => f.distanceKm <= rad);
      if (validCached.length > 0) {
        setFacilities(validCached);
        setFacilitiesState('SUCCESS');
        setIsLiveSource(false);
        setLastUpdatedTime(new Date());
        showToast('Offline Mode: Showing cached healthcare centers.');
      } else {
        setFacilities([]);
        setFacilitiesState('ERROR');
      }
    }
  }, []);

  useEffect(() => {
    if (coords) {
      loadFacilitiesForCoords(coords.latitude, coords.longitude, selectedCategory, selectedRadius);
    } else if (!isDetecting) {
      setFacilitiesState('EMPTY');
    }
  }, [coords, isDetecting, selectedCategory, selectedRadius, loadFacilitiesForCoords]);

  // Handle manual search submit (Village / City / PIN code)
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    if (!searchInput.trim()) {
      setSearchError('Please enter a village, city, town name, or 6-digit PIN code.');
      return;
    }

    setFacilitiesState('LOADING');
    const success = await searchAndSetLocation(searchInput);
    if (success) {
      setIsManualSearchOpen(false);
      showToast(`Location set to "${searchInput}". Searching verified facilities...`);
    } else {
      setSearchError('Could not find location coordinates. Please verify spelling or enter PIN code.');
      setFacilitiesState('EMPTY');
    }
  };

  // Handle Refresh Nearby (Real Device GPS fresh request)
  const handleRefreshNearby = async () => {
    showToast('Getting fresh GPS location and updating nearby facilities...');
    setFacilitiesState('LOADING');
    await refreshLocation();
  };

  const handleGetDirections = (facility: HealthcareCenter, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const userLat = coords?.latitude;
    const userLon = coords?.longitude;
    const hospLat = facility.latitude;
    const hospLon = facility.longitude;

    if (!hospLat || !hospLon) return;

    let mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${hospLat},${hospLon}&travelmode=driving`;
    if (userLat && userLon) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${hospLat},${hospLon}&travelmode=driving`;
    }
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const getCategoryBadge = (facility: HealthcareCenter) => {
    if (facility.type === 'phc' || facility.type === 'chc') {
      return {
        label: facility.type === 'chc' ? 'Community Health Centre (CHC)' : 'Primary Health Centre (PHC)',
        icon: '🏛️',
        bgColor: '#f0fdfa',
        textColor: '#0f766e',
        borderColor: '#99f6e4',
      };
    }
    if (facility.type === 'hospital' || facility.type === 'district_hospital') {
      return {
        label: 'Hospital',
        icon: '🏨',
        bgColor: '#fef2f2',
        textColor: '#b91c1c',
        borderColor: '#fecaca',
      };
    }
    if (facility.type === 'pharmacy') {
      return {
        label: 'Pharmacy',
        icon: '💊',
        bgColor: '#eff6ff',
        textColor: '#1d4ed8',
        borderColor: '#bfdbfe',
      };
    }
    if (facility.type === 'diagnostic') {
      return {
        label: 'Diagnostic Lab',
        icon: '🔬',
        bgColor: '#faf5ff',
        textColor: '#7e22ce',
        borderColor: '#e9d5ff',
      };
    }
    return {
      label: 'Clinic',
      icon: '🩺',
      bgColor: '#f0f9ff',
      textColor: '#0369a1',
      borderColor: '#bae6fd',
    };
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '32px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#0f766e',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          fontSize: '13.5px',
          fontWeight: 600,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <CheckCircle2 size={16} />
          {toastMessage}
        </div>
      )}

      {/* Emergency Immediate Action Banner */}
      <div style={{
        backgroundColor: '#fef2f2',
        border: '1.5px solid #f87171',
        borderRadius: '14px',
        padding: '14px 18px',
        marginBottom: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(220, 38, 38, 0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#fee2e2', borderRadius: '50%', padding: '10px', display: 'flex' }}>
            <ShieldAlert size={24} color="#dc2626" />
          </div>
          <div>
            <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#991b1b', display: 'block' }}>
              Medical Emergency?
            </span>
            <span style={{ fontSize: '13px', color: '#b91c1c' }}>
              If you or a family member is in critical condition, call National Emergency Ambulances immediately.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href="tel:108"
            className="btn btn-primary"
            style={{
              backgroundColor: '#dc2626',
              borderColor: '#dc2626',
              color: '#ffffff',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none'
            }}
          >
            <PhoneCall size={14} />
            Call 108 (Ambulance)
          </a>
          <a
            href="tel:112"
            className="btn btn-outline"
            style={{
              borderColor: '#dc2626',
              color: '#dc2626',
              backgroundColor: '#ffffff',
              padding: '9px 14px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none'
            }}
          >
            <PhoneCall size={14} />
            Call 112
          </a>
        </div>
      </div>

      {/* Screen Title & Live Refresh Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            color: '#0f766e',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: 0
          }}>
            <Hospital size={26} color="#0f766e" />
            {t.nearbyTitle || 'Find Nearby Healthcare'}
          </h1>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>
            Real-time verified healthcare discovery • Primary Health Centres (PHC), Community Health Centres (CHC), & Hospitals
          </p>
        </div>

        {/* Refresh Nearby Action */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleRefreshNearby}
            disabled={isDetecting || facilitiesState === 'LOADING'}
            className="btn btn-primary"
            style={{
              padding: '10px 18px',
              fontSize: '13.5px',
              fontWeight: 700,
              borderRadius: '9px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#0f766e',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(15, 118, 110, 0.25)',
              cursor: (isDetecting || facilitiesState === 'LOADING') ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={15} className={(isDetecting || facilitiesState === 'LOADING') ? 'animate-spin' : ''} />
            Refresh Nearby
          </button>
        </div>
      </div>

      {/* TOP LOCATION HERO CARD (Requirement 2 & 6) */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1.5px solid #cbd5e1',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Card Header with Badges */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          paddingBottom: '14px',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Compass size={17} color="#0f766e" />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f766e', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Your Current Location
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* GPS Status Badge */}
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: isGranted ? '#f0fdf4' : isDetecting ? '#fefce8' : '#fef2f2',
              color: isGranted ? '#15803d' : isDetecting ? '#a16207' : '#dc2626',
              border: `1px solid ${isGranted ? '#bbf7d0' : isDetecting ? '#fef08a' : '#fecaca'}`
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: isGranted ? '#16a34a' : isDetecting ? '#eab308' : '#dc2626'
              }} />
              {isDetecting
                ? 'Acquiring GPS Fix...'
                : isGranted
                ? (locationSource === 'gps' ? 'GPS Active' : 'Manual Location')
                : error?.code === 'PERMISSION_DENIED'
                ? 'Permission Denied'
                : error?.code === 'TIMEOUT'
                ? 'GPS Timed Out'
                : 'Location Unavailable'}
            </span>

            {/* Network Status Badge */}
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: isOnline ? '#f0fdf4' : '#fef2f2',
              color: isOnline ? '#15803d' : '#dc2626',
              border: `1px solid ${isOnline ? '#bbf7d0' : '#fecaca'}`
            }}>
              <Wifi size={12} color={isOnline ? '#16a34a' : '#dc2626'} />
              {isOnline ? 'Online' : 'Offline'}
            </span>

            {/* Live Data Status Badge */}
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: isLiveSource ? '#f0fdfa' : '#fffbeb',
              color: isLiveSource ? '#0f766e' : '#b45309',
              border: `1px solid ${isLiveSource ? '#ccfbf1' : '#fde68a'}`
            }}>
              <Activity size={12} />
              {isLiveSource ? 'Live Healthcare Data' : 'Offline Cache'}
            </span>

            {/* Last Updated Badge */}
            <span style={{
              fontSize: '12px',
              color: '#64748b',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#f8fafc',
              padding: '4px 9px',
              borderRadius: '14px',
              border: '1px solid #e2e8f0'
            }}>
              <Clock size={12} />
              {facilitiesState === 'LOADING' ? 'Searching...' : `Updated ${formatTimeAgo(lastUpdatedTime)}`}
            </span>
          </div>
        </div>

        {/* Location Content */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: '1 1 360px' }}>
            {isDetecting ? (
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', color: '#0f766e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={16} className="animate-spin" />
                  Getting your current location...
                </h3>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Waiting for your device's real GPS lock to discover verified healthcare facilities within {selectedRadius} km...
                </p>
              </div>
            ) : coords ? (
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', lineHeight: '1.4' }}>
                  {isGeocoding
                    ? 'Resolving locality details...'
                    : (address?.displayName || `GPS Fix: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`)}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '12px',
                    color: '#0f766e',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: 700
                  }}>
                    GPS: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                  </span>
                  {coords.accuracy ? (
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                      ±{coords.accuracy}m accuracy
                    </span>
                  ) : null}
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>•</span>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                    {locationSource === 'gps' ? 'Device GPS' : 'Manual Coordinates'}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#dc2626', fontWeight: 700 }}>
                  {error?.code === 'PERMISSION_DENIED'
                    ? 'GPS Permission Denied'
                    : error?.code === 'TIMEOUT'
                    ? 'GPS Request Timed Out'
                    : 'Location Currently Unavailable'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Please enable location permissions or enter your village, city, or PIN code below.
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions & Search Radius Selector (Requirements 2 & 8) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'flex-start'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Search Radius:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[2, 5, 10, 25].map((rad) => {
                  const isSelected = selectedRadius === rad;
                  return (
                    <button
                      key={rad}
                      type="button"
                      onClick={() => setSelectedRadius(rad)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12.5px',
                        fontWeight: isSelected ? 800 : 600,
                        backgroundColor: isSelected ? '#0f766e' : '#f8fafc',
                        color: isSelected ? '#ffffff' : '#334155',
                        border: isSelected ? '1.5px solid #0f766e' : '1.5px solid #cbd5e1',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {rad} km{rad === 5 ? ' (Default)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsManualSearchOpen(!isManualSearchOpen)}
                className="btn btn-outline"
                style={{
                  padding: '7px 12px',
                  fontSize: '12.5px',
                  borderRadius: '8px',
                  borderColor: '#cbd5e1',
                  color: '#334155',
                  backgroundColor: isManualSearchOpen ? '#f1f5f9' : '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
              >
                <Search size={14} />
                Search Village / City / PIN
              </button>
            </div>
          </div>
        </div>

        {/* MANUAL LOCATION SEARCH ACCORDION / FORM */}
        {isManualSearchOpen && (
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9',
            animation: 'fadeIn 0.2s ease'
          }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '13.5px', color: '#0f766e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={15} />
              Manual Search (Village, Town, City, or 6-digit PIN code)
            </h4>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="e.g. Kakinada, Samalkot, Tallarevu, 533001..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  flex: '1 1 280px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  padding: '10px 18px',
                  fontSize: '13.5px',
                  borderRadius: '8px',
                  backgroundColor: '#0f766e',
                  color: '#ffffff',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Search size={14} />
                Search Location
              </button>
            </form>
            {searchError && (
              <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: '#dc2626', fontWeight: 600 }}>
                {searchError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* GPS ERROR / TIMEOUT CARD (If error and no coords) */}
      {!isDetecting && !isGranted && (
        <div style={{
          padding: '20px 22px',
          backgroundColor: '#fef2f2',
          border: '1.5px solid #fca5a5',
          borderRadius: '14px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
            <div style={{ backgroundColor: '#fee2e2', borderRadius: '50%', padding: '10px', display: 'flex' }}>
              <XCircle size={26} color="#dc2626" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#991b1b', fontWeight: 800 }}>
                {error?.code === 'PERMISSION_DENIED'
                  ? 'Location Access Required'
                  : error?.code === 'TIMEOUT'
                  ? 'Location Request Timed Out'
                  : error?.code === 'UNSUPPORTED'
                  ? 'Browser Geolocation Unsupported'
                  : 'Device Location Unavailable'}
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: '#b91c1c', lineHeight: '1.5' }}>
                {error?.code === 'PERMISSION_DENIED'
                  ? 'Location permission is required to find healthcare facilities near you. Please enable location permissions in your browser or device settings.'
                  : error?.code === 'TIMEOUT'
                  ? 'GPS location request timed out. Please make sure Location Services are enabled on your device and try again, or enter your location manually.'
                  : error?.code === 'UNSUPPORTED'
                  ? 'Geolocation is not supported by your browser. Please search by village, city, town, or PIN code.'
                  : (error?.message || 'Your device location is currently unavailable. Please check your device location settings and try again.')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {error?.code !== 'UNSUPPORTED' && (
              <button
                type="button"
                onClick={() => refreshLocation()}
                className="btn btn-primary"
                style={{ padding: '9px 16px', fontSize: '13px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <RefreshCw size={14} />
                {error?.code === 'PERMISSION_DENIED' ? 'Enable Location' : 'Retry Location'}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsManualSearchOpen(true)}
              className="btn btn-secondary"
              style={{ padding: '9px 16px', fontSize: '13px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
            >
              <Search size={14} />
              Search Village / City / PIN
            </button>

            {error?.code === 'PERMISSION_DENIED' && (
              <button
                type="button"
                onClick={() => setShowSettingsGuide(true)}
                className="btn btn-outline"
                style={{ padding: '9px 16px', fontSize: '13px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#475569', backgroundColor: '#ffffff', fontWeight: 600 }}
              >
                <Settings size={14} />
                Settings Guide
              </button>
            )}
          </div>
        </div>
      )}

      {/* BROWSER SETTINGS GUIDE MODAL */}
      {showSettingsGuide && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 2000,
        }}>
          <div style={{ maxWidth: '500px', width: '100%', padding: '24px', backgroundColor: '#ffffff', borderRadius: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', color: '#0f766e', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={20} />
              How to Enable Location Permission
            </h3>
            <ol style={{ fontSize: '13.5px', color: '#334155', paddingLeft: '20px', lineHeight: '1.7', margin: '0 0 18px' }}>
              <li>Look at your browser's address bar at the top (near <code>http://...</code>).</li>
              <li>Click the <strong>Padlock 🔒 or Site Settings icon</strong> next to the URL.</li>
              <li>Find <strong>Location</strong> and switch it from <em>Block</em> to <strong>Allow</strong>.</li>
              <li>Close this dialog and click <strong>Retry Location</strong> or <strong>Refresh Nearby</strong>.</li>
            </ol>
            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowSettingsGuide(false)}
                className="btn btn-primary"
                style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '8px', fontWeight: 700 }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE HEALTHCARE MAP CARD (Requirement 7) */}
      <HealthcareMap
        userCoords={coords}
        userAddress={address?.displayName}
        facilities={facilities}
        onSelectFacility={(fac) => {
          showToast(`Selected ${fac.name} (${formatDistance(fac.distanceKm)})`);
        }}
      />

      {/* ASHA WORKER CONTACT CARD (if configured in user profile) */}
      {(() => {
        const userProfile = localStorageService.getUserProfile();
        if (!userProfile?.ashaWorkerPhone) return null;
        return (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #bbf7d0',
            borderRadius: '14px',
            marginBottom: '20px',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                <UserCheck size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#14532d', fontWeight: 700 }}>
                  Village ASHA Health Activist Contact
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#166534' }}>
                  Accredited Social Health Activist for your sector
                </p>
              </div>
            </div>

            <a
              href={`tel:${userProfile.ashaWorkerPhone}`}
              className="btn btn-primary"
              style={{
                padding: '9px 16px',
                fontSize: '13.5px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#0f766e',
                color: '#ffffff',
                fontWeight: 700,
                textDecoration: 'none'
              }}
            >
              <PhoneCall size={15} />
              Call ASHA Worker ({userProfile.ashaWorkerPhone})
            </a>
          </div>
        );
      })()}

      {/* CATEGORY FILTER TABS (Requirement 8) */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '8px',
        paddingBottom: '8px',
        marginBottom: '18px',
        scrollbarWidth: 'thin'
      }}>
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '24px',
                fontSize: '13px',
                fontWeight: isActive ? 800 : 600,
                backgroundColor: isActive ? '#0f766e' : '#ffffff',
                color: isActive ? '#ffffff' : '#334155',
                border: isActive ? '1.5px solid #0f766e' : '1.5px solid #cbd5e1',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 2px 6px rgba(15, 118, 110, 0.2)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* RESULTS HEADER & LIVE SEARCH STATUS (Requirement 6 & 8) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', color: '#0f172a', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {facilitiesState === 'LOADING' ? (
              <>
                <Search size={18} color="#0f766e" />
                Searching for nearby healthcare facilities...
              </>
            ) : facilities.length > 0 ? (
              <>
                <CheckCircle2 size={18} color="#16a34a" />
                {facilities.length} healthcare facilit{facilities.length === 1 ? 'y' : 'ies'} found within {selectedRadius} km
              </>
            ) : (
              `No healthcare facilities found within ${selectedRadius} km`
            )}
          </h2>
          <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>
            {facilitiesState === 'LOADING'
              ? 'Finding hospitals, clinics, pharmacies and emergency facilities near your location...'
              : 'Sorted strictly nearest to farthest • Live GPS coordinates verified'}
          </span>
        </div>

        {facilitiesState === 'LOADING' && (
          <span style={{ fontSize: '12.5px', color: '#0f766e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={13} className="animate-spin" />
            Searching nearby healthcare...
          </span>
        )}
      </div>

      {/* 1. SKELETON LOADING STATE (Requirement 10) */}
      {facilitiesState === 'LOADING' && (
        <div className="grid-responsive-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '20px',
                minHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ height: '22px', width: '65%', backgroundColor: '#e2e8f0', borderRadius: '6px' }} className="animate-pulse" />
                  <div style={{ height: '22px', width: '25%', backgroundColor: '#f1f5f9', borderRadius: '12px' }} className="animate-pulse" />
                </div>
                <div style={{ height: '16px', width: '45%', backgroundColor: '#f1f5f9', borderRadius: '4px', marginBottom: '10px' }} className="animate-pulse" />
                <div style={{ height: '20px', width: '30%', backgroundColor: '#ecfdf5', borderRadius: '10px' }} className="animate-pulse" />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <div style={{ height: '38px', flex: 1, backgroundColor: '#f1f5f9', borderRadius: '8px' }} className="animate-pulse" />
                <div style={{ height: '38px', flex: 1, backgroundColor: '#e2e8f0', borderRadius: '8px' }} className="animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. ERROR STATE (Requirement 9 & 13) */}
      {facilitiesState === 'ERROR' && facilities.length === 0 && (
        <div style={{
          padding: '36px 24px',
          textAlign: 'center',
          backgroundColor: '#fef2f2',
          border: '1.5px solid #fecaca',
          borderRadius: '14px',
          marginBottom: '20px'
        }}>
          <AlertTriangle size={42} color="#dc2626" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: 0, fontSize: '18px', color: '#991b1b', fontWeight: 800 }}>
            Unable to Load Nearby Healthcare Facilities
          </h3>
          <p style={{ margin: '8px auto 20px', fontSize: '13.5px', color: '#b91c1c', maxWidth: '460px', lineHeight: '1.5' }}>
            We acquired your GPS coordinates, but could not load nearby healthcare facilities from the network. Please check your internet connection and try again.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleRefreshNearby}
              className="btn btn-primary"
              style={{ padding: '9px 18px', fontSize: '13px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <RefreshCw size={14} />
              Retry Search
            </button>
            <button
              type="button"
              onClick={() => setIsManualSearchOpen(true)}
              className="btn btn-secondary"
              style={{ padding: '9px 18px', fontSize: '13px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
            >
              <Search size={14} />
              Search by Town / PIN
            </button>
          </div>
        </div>
      )}

      {/* 3. STRICT EMPTY STATE (Requirement 9) */}
      {facilitiesState === 'EMPTY' && facilities.length === 0 && (
        <div style={{
          padding: '40px 24px',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Hospital size={34} color="#64748b" />
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: 800 }}>
            No healthcare facilities found within {selectedRadius} km
          </h3>
          <p style={{ margin: '8px auto 20px', fontSize: '13.5px', color: '#64748b', maxWidth: '480px', lineHeight: '1.6' }}>
            No verified healthcare centers were found within {selectedRadius} km of your current location. You can expand the search radius or search directly by village name or PIN code.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {selectedRadius < 25 && (
              <button
                type="button"
                onClick={() => setSelectedRadius(selectedRadius === 2 ? 5 : selectedRadius === 5 ? 10 : 25)}
                className="btn btn-primary"
                style={{
                  padding: '9px 18px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  backgroundColor: '#0f766e',
                  color: '#ffffff',
                  fontWeight: 700
                }}
              >
                Increase Radius to {selectedRadius === 2 ? '5 km' : selectedRadius === 5 ? '10 km' : '25 km'}
              </button>
            )}
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="btn btn-secondary"
                style={{ padding: '9px 18px', fontSize: '13px', borderRadius: '8px', fontWeight: 600 }}
              >
                Show All Facility Types
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsManualSearchOpen(true)}
              className="btn btn-outline"
              style={{ padding: '9px 18px', fontSize: '13px', borderRadius: '8px', fontWeight: 600 }}
            >
              <Search size={14} />
              Search Village / Town / PIN
            </button>
          </div>
        </div>
      )}

      {/* REAL PRODUCTION-GRADE FACILITY CARDS (Requirements 3, 4, 5, 11) */}
      <div className="grid-responsive-2">
        {facilities.map((facility) => {
          const isPhcChc = facility.type === 'phc' || facility.type === 'chc';
          const localityLabel = formatFacilityLocation(facility);
          const distanceStr = formatDistance(facility.distanceKm);
          const catBadge = getCategoryBadge(facility);

          return (
            <div
              key={facility.id}
              style={{
                backgroundColor: isPhcChc ? '#fafdfc' : '#ffffff',
                border: isPhcChc ? '1.5px solid #99f6e4' : '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                boxShadow: isPhcChc ? '0 2px 10px rgba(15, 118, 110, 0.06)' : '0 2px 6px rgba(0, 0, 0, 0.02)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div>
                {/* Header: Name & Type / 24x7 Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{
                        backgroundColor: catBadge.bgColor,
                        color: catBadge.textColor,
                        border: `1px solid ${catBadge.borderColor}`,
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>{catBadge.icon}</span>
                        <span>{catBadge.label}</span>
                      </span>
                    </div>

                    <h3 style={{
                      margin: 0,
                      fontSize: '17px',
                      color: '#0f172a',
                      fontWeight: 800,
                      lineHeight: '1.3'
                    }}>
                      {facility.name}
                    </h3>
                  </div>

                  {facility.emergency24x7 === true ? (
                    <span style={{
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0
                    }}>
                      <Clock size={12} />
                      24x7 Emergency
                    </span>
                  ) : facility.openingHours ? (
                    <span style={{
                      backgroundColor: '#f8fafc',
                      color: '#475569',
                      border: '1px solid #e2e8f0',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '8px',
                      flexShrink: 0
                    }}>
                      <Clock size={11} />
                      {facility.openingHours}
                    </span>
                  ) : null}
                </div>

                {/* Location / Locality (Requirement 3 & 5) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  color: '#475569',
                  fontSize: '13px',
                  margin: '6px 0 10px',
                  lineHeight: '1.4'
                }}>
                  <MapPin size={15} color="#0f766e" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontWeight: 600, color: '#334155' }}>
                    {localityLabel}
                  </span>
                </div>

                {/* Distance Highlight & Coordinates */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <span style={{
                    backgroundColor: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                    padding: '4px 11px',
                    borderRadius: '16px',
                    fontSize: '13px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    📍 {distanceStr} away
                  </span>

                  {facility.latitude && facility.longitude && (
                    <span style={{
                      fontSize: '11px',
                      color: '#64748b',
                      backgroundColor: '#f8fafc',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      fontWeight: 600
                    }}>
                      GPS: {facility.latitude.toFixed(5)}, {facility.longitude.toFixed(5)}
                    </span>
                  )}
                </div>

                {/* Available Services Tags (if listed) */}
                {facility.servicesAvailable && facility.servicesAvailable.length > 0 && (
                  <div style={{
                    backgroundColor: isPhcChc ? '#ffffff' : '#f8fafc',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <span style={{ fontSize: '11px', color: '#475569', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      Available Services:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {facility.servicesAvailable.map((srv, idx) => (
                        <span key={idx} style={{
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          fontSize: '11px',
                          color: '#334155'
                        }}>
                          {srv}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Directions & Call (Requirement 3) */}
              <div style={{
                display: 'flex',
                gap: '8px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9',
                flexWrap: 'wrap'
              }}>
                <button
                  type="button"
                  onClick={(e) => handleGetDirections(facility, e)}
                  className="btn btn-primary"
                  style={{
                    flex: '1 1 140px',
                    padding: '9px 12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    backgroundColor: '#0f766e',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(15, 118, 110, 0.2)'
                  }}
                >
                  <Navigation size={14} />
                  Get Directions
                </button>

                {facility.phone ? (
                  <a
                    href={`tel:${facility.phone.replace(/\s+/g, '')}`}
                    className="btn btn-outline"
                    style={{
                      flex: '1 1 120px',
                      padding: '9px 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      borderColor: '#0f766e',
                      color: '#0f766e',
                      backgroundColor: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      textDecoration: 'none'
                    }}
                  >
                    <PhoneCall size={14} />
                    Call ({facility.phone})
                  </a>
                ) : (
                  <span style={{
                    flex: '1 1 110px',
                    padding: '9px 8px',
                    fontSize: '12px',
                    color: '#94a3b8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 500
                  }}>
                    Phone not listed
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
