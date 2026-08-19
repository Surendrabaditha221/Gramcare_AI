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
  SlidersHorizontal,
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useRealLocation } from '../hooks/useRealLocation';
import { fetchNearbyHealthcareCenters, getCachedNearbyFacilities } from '../services/locationService';
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
  { id: 'pharmacy', label: 'Pharmacy', hindiLabel: 'दवा दुकान', icon: '💊' },
  { id: 'diagnostic', label: 'Diagnostic Lab', hindiLabel: 'जांच केंद्र', icon: '🔬' },
];

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
    locationSource,
    refreshLocation,
    searchAndSetLocation,
    useIpFallback,
  } = useRealLocation();

  const [facilities, setFacilities] = useState<HealthcareCenter[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRadius, setSelectedRadius] = useState<number>(25);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState<boolean>(true);
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [showSettingsGuide, setShowSettingsGuide] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchError, setSearchError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load facilities whenever coordinates, category, or radius change
  const loadFacilitiesForCoords = useCallback(async (lat: number, lon: number, cat: string, rad: number) => {
    setIsLoadingFacilities(true);
    try {
      const results = await fetchNearbyHealthcareCenters(lat, lon, cat, rad);
      setFacilities(results);
      if (results.length > 0) {
        showToast(`Found ${results.length} verified healthcare facilities.`);
      }
    } catch (err) {
      console.error('[NearbyHealthcareScreen] Error loading facilities:', err);
      const cached = getCachedNearbyFacilities();
      if (cached.length > 0) {
        setFacilities(cached);
        showToast('Offline Mode: Showing cached healthcare centers.');
      }
    } finally {
      setIsLoadingFacilities(false);
    }
  }, []);

  useEffect(() => {
    if (coords) {
      loadFacilitiesForCoords(coords.latitude, coords.longitude, selectedCategory, selectedRadius);
    } else if (!isDetecting) {
      setIsLoadingFacilities(false);
    }
  }, [coords, isDetecting, selectedCategory, selectedRadius, loadFacilitiesForCoords]);

  // Handle manual search submit (Village / City / PIN code)
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    if (!searchInput.trim()) {
      setSearchError('Please enter a village, city, town name, or PIN code.');
      return;
    }

    setIsLoadingFacilities(true);
    const success = await searchAndSetLocation(searchInput);
    if (success) {
      setShowManualInput(false);
      showToast(`Location set to "${searchInput}". Searching verified facilities...`);
    } else {
      setSearchError('Could not find location coordinates. Please verify spelling or enter PIN code.');
      setIsLoadingFacilities(false);
    }
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

  return (
    <div>
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
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          fontSize: '13px',
          fontWeight: 600,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <CheckCircle2 size={16} />
          {toastMessage}
        </div>
      )}

      {/* Emergency Immediate Action Banner */}
      <div style={{
        backgroundColor: '#fef2f2',
        border: '1.5px solid #f87171',
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: '#fee2e2', borderRadius: '50%', padding: '8px', display: 'flex' }}>
            <ShieldAlert size={22} color="#dc2626" />
          </div>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#991b1b', display: 'block' }}>
              Medical Emergency?
            </span>
            <span style={{ fontSize: '12.5px', color: '#b91c1c' }}>
              If in critical danger, call National Emergency Ambulances immediately.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href="tel:108"
            className="btn btn-primary"
            style={{
              backgroundColor: '#dc2626',
              borderColor: '#dc2626',
              color: '#ffffff',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
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
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <PhoneCall size={14} />
            Call 112
          </a>
        </div>
      </div>

      {/* Screen Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '22px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Hospital size={24} />
          {t.nearbyTitle || 'Find Nearby Healthcare'}
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
          Real location-based discovery of verified Primary Health Centres (PHC), Community Health Centres (CHC), and hospitals.
        </p>
      </div>

      {/* System Status Badges */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '16px',
        backgroundColor: '#f8fafc',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid #e2e8f0'
      }}>
        {/* Network Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}>
          <Wifi size={14} color={isOnline ? '#16a34a' : '#dc2626'} />
          <span style={{ color: '#475569' }}>Network:</span>
          <span style={{ color: isOnline ? '#15803d' : '#dc2626' }}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <span style={{ color: '#cbd5e1' }}>•</span>

        {/* Location Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}>
          <Compass size={14} color={isGranted ? '#0f766e' : isDetecting ? '#eab308' : '#dc2626'} />
          <span style={{ color: '#475569' }}>Location:</span>
          <span style={{ color: isGranted ? '#0f766e' : isDetecting ? '#ca8a04' : '#dc2626' }}>
            {isDetecting
              ? 'Requesting GPS Permission...'
              : isGranted
              ? `Active (${locationSource === 'gps' ? 'GPS' : locationSource === 'ip' ? 'IP Approx' : 'Manual'})`
              : 'Permission Denied'}
          </span>
        </div>

        <span style={{ color: '#cbd5e1' }}>•</span>

        {/* Facilities Data Provider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}>
          <Hospital size={14} color={isBackendAvailable ? '#16a34a' : '#2563eb'} />
          <span style={{ color: '#475569' }}>Provider:</span>
          <span style={{ color: isBackendAvailable ? '#15803d' : '#2563eb' }}>
            {isBackendAvailable ? 'FastAPI Overpass API' : 'OpenStreetMap Live'}
          </span>
        </div>
      </div>

      {/* 1. INITIAL AUTOMATIC GPS PERMISSION LOADING STATE */}
      {isDetecting && (
        <div className="card" style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', marginBottom: '20px' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: '#0f766e', marginBottom: '10px' }} />
          <h3 style={{ margin: 0, color: '#0f766e', fontSize: '18px' }}>
            Detecting your location...
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
            Requesting device GPS permission to locate nearest verified PHCs and hospitals...
          </p>
        </div>
      )}

      {/* 2. PERMISSION DENIED / LOCATION ERROR CARD */}
      {!isDetecting && !isGranted && (
        <div className="card" style={{ padding: '24px', backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
            <div style={{ backgroundColor: '#fee2e2', borderRadius: '50%', padding: '10px', display: 'flex' }}>
              <XCircle size={28} color="#dc2626" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#991b1b', fontWeight: 700 }}>
                Location Access Needed
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: '#b91c1c', lineHeight: '1.5' }}>
                {error?.message || 'Please allow location permission to discover real verified PHCs, CHCs, and hospitals near you.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
            <button
              type="button"
              onClick={() => refreshLocation()}
              className="btn btn-primary"
              style={{ padding: '10px 16px', fontSize: '13px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={15} />
              Try Again
            </button>

            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="btn btn-secondary"
              style={{ padding: '10px 16px', fontSize: '13px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Search size={15} />
              Search Village / City / PIN
            </button>

            <button
              type="button"
              onClick={() => useIpFallback()}
              className="btn btn-outline"
              style={{ padding: '10px 16px', fontSize: '13px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Compass size={15} />
              Use IP Approximate Location
            </button>

            <button
              type="button"
              onClick={() => setShowSettingsGuide(true)}
              className="btn btn-outline"
              style={{ padding: '10px 16px', fontSize: '13px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#475569' }}
            >
              <Settings size={15} />
              Settings Guide
            </button>
          </div>
        </div>
      )}

      {/* MANUAL LOCATION SEARCH FORM */}
      {(showManualInput || (!isGranted && !isDetecting)) && (
        <div className="card" style={{ padding: '18px', backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '15px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={16} />
            Search Healthcare Centers by Village, Town, or PIN Code
          </h3>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Enter Village name, Town, City, or 6-digit PIN code (e.g. Warangal, Guntur, 500001)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                flex: 1,
                minWidth: '240px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px'
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '10px 18px', fontSize: '13.5px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Search size={15} />
              Search Location
            </button>
          </form>

          {searchError && (
            <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: '#dc2626' }}>
              {searchError}
            </p>
          )}
        </div>
      )}

      {/* BROWSER SETTINGS GUIDE MODAL */}
      {showSettingsGuide && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 2000,
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={20} />
              How to Enable Location Permission
            </h3>
            <ol style={{ fontSize: '13.5px', color: '#334155', paddingLeft: '20px', lineHeight: '1.6', margin: '0 0 16px' }}>
              <li>Look at your browser's address bar at the top (near <code>http://...</code>).</li>
              <li>Click the <strong>Padlock 🔒 or Settings icon</strong> next to the URL.</li>
              <li>Find <strong>Location</strong> and switch it from <em>Block</em> to <strong>Allow</strong>.</li>
              <li>Close this dialog and click <strong>Try Again</strong>.</li>
            </ol>
            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowSettingsGuide(false)}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE DETECTED LOCATION DISPLAY */}
      {coords && (
        <div className="card" style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '13px', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={15} color="#15803d" />
                Active Search Location ({locationSource === 'gps' ? 'Device GPS' : locationSource === 'ip' ? 'IP Location' : 'Manual Location'})
              </h3>
              <p style={{ margin: '4px 0 2px', fontSize: '15px', fontWeight: 700, color: '#14532d' }}>
                {isGeocoding ? 'Resolving address...' : address?.displayName || 'Coordinates active'}
              </p>
              <span style={{ fontSize: '12px', color: '#166534', fontWeight: 500 }}>
                {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)} (Radius: {selectedRadius} km)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={selectedRadius}
                onChange={(e) => setSelectedRadius(Number(e.target.value))}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #86efac',
                  fontSize: '12.5px',
                  color: '#14532d',
                  backgroundColor: '#ffffff'
                }}
              >
                <option value={10}>10 km radius</option>
                <option value={25}>25 km radius</option>
                <option value={50}>50 km radius</option>
              </select>

              <button
                onClick={() => refreshLocation()}
                className="btn btn-outline"
                disabled={isDetecting || isGeocoding}
                style={{
                  padding: '6px 12px',
                  fontSize: '12.5px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  borderColor: '#86efac',
                  color: '#15803d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={13} className={isDetecting || isGeocoding ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY FILTER TABS */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '8px',
        paddingBottom: '8px',
        marginBottom: '16px',
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
                padding: '8px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                backgroundColor: isActive ? '#0f766e' : '#ffffff',
                color: isActive ? '#ffffff' : '#334155',
                border: isActive ? '1px solid #0f766e' : '1px solid #cbd5e1',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* INTERACTIVE LEAFLET / OPENSTREETMAP MAP */}
      <HealthcareMap
        userCoords={coords}
        userAddress={address?.displayName}
        facilities={facilities}
        onSelectFacility={(fac) => {
          showToast(`Selected ${fac.name} (${fac.distanceKm} km away)`);
        }}
      />

      {/* ASHA WORKER CONTACT CARD (if configured in user profile) */}
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
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <UserCheck size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#14532d' }}>
                  Village ASHA Health Activist Contact
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#166534' }}>
                  Accredited Social Health Activist for your sector
                </p>
              </div>
            </div>

            <a
              href={`tel:${userProfile.ashaWorkerPhone}`}
              className="btn btn-primary"
              style={{ padding: '8px 12px', fontSize: '13.5px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <PhoneCall size={15} />
              Call ASHA Worker ({userProfile.ashaWorkerPhone})
            </a>
          </div>
        );
      })()}

      {/* FACILITIES LIST HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '17px', color: '#1e293b', margin: 0 }}>
          Nearby Facilities ({facilities.length})
        </h3>
        {isLoadingFacilities && (
          <span style={{ fontSize: '12px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <RefreshCw size={12} className="animate-spin" /> Fetching live facilities...
          </span>
        )}
      </div>

      {/* SKELETON CARDS LOADING STATE */}
      {isLoadingFacilities && facilities.length === 0 && (
        <div className="grid-responsive-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card" style={{ padding: '20px', minHeight: '160px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ height: '20px', width: '60%', backgroundColor: '#e2e8f0', borderRadius: '4px' }} className="animate-pulse" />
              <div style={{ height: '14px', width: '40%', backgroundColor: '#f1f5f9', borderRadius: '4px' }} className="animate-pulse" />
              <div style={{ height: '36px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '6px', marginTop: 'auto' }} className="animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* ZERO RESULTS EMPTY STATE (STRICT PRODUCTION STANDARD) */}
      {!isLoadingFacilities && facilities.length === 0 && (
        <div className="card" style={{ padding: '32px', textAlign: 'center', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Hospital size={40} color="#94a3b8" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: 0, fontSize: '16px', color: '#334155', fontWeight: 600 }}>
            No nearby healthcare facilities found
          </h3>
          <p style={{ margin: '8px 0 16px', fontSize: '13px', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            Please visit your nearest Primary Health Centre (PHC), Community Health Centre (CHC), or hospital. You may also increase the search radius above or search another village/city.
          </p>
          <button
            type="button"
            onClick={() => refreshLocation()}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
          >
            Retry Location Detection
          </button>
        </div>
      )}

      {/* REAL FACILITY CARDS */}
      <div className="grid-responsive-2">
        {facilities.map((facility) => {
          const isPhcChc = facility.type === 'phc' || facility.type === 'chc';
          return (
            <div
              key={facility.id}
              className="card"
              style={{
                margin: 0,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: isPhcChc ? '1.5px solid #99f6e4' : '1px solid #e2e8f0',
                backgroundColor: isPhcChc ? '#f0fdfa' : '#ffffff'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0f766e', fontWeight: 700 }}>
                      {facility.name}
                    </h3>
                    <span style={{ fontSize: '13px', color: '#0f766e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <MapPin size={14} color="#0f766e" />
                      {facility.distanceKm} km away • {facility.villageOrTaluka}, {facility.district}
                    </span>
                  </div>

                  <span
                    className={`badge ${facility.emergency24x7 ? 'badge-high' : 'badge-low'}`}
                    style={{ fontSize: '11px', flexShrink: 0 }}
                  >
                    <Clock size={12} />
                    {facility.emergency24x7 ? '24x7 Emergency' : facility.openingHours || 'Open'}
                  </span>
                </div>

                {/* Services Tags */}
                <div style={{ backgroundColor: isPhcChc ? '#ffffff' : '#f8fafc', padding: '8px 10px', borderRadius: '8px', margin: '10px 0 14px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Available Services:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {facility.servicesAvailable.map((srv, idx) => (
                      <span key={idx} style={{
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
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

              {/* Actions: Call (if real number exists) & Directions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                {facility.phone ? (
                  <a
                    href={`tel:${facility.phone.replace(/\s+/g, '')}`}
                    className="btn btn-outline"
                    style={{ flex: 1, padding: '8px 10px', fontSize: '12.5px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  >
                    <PhoneCall size={13} />
                    Call ({facility.phone})
                  </a>
                ) : (
                  <span style={{ flex: 1, padding: '8px 10px', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Phone not listed
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => handleGetDirections(facility, e)}
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    cursor: 'pointer'
                  }}
                >
                  <Navigation size={13} />
                  Get Directions
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
