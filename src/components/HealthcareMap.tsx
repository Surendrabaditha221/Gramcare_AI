import React, { useEffect, useRef } from 'react';
import { MapPin, Compass } from 'lucide-react';
import { HealthcareCenter } from '../types/healthCenter';
import { LocationCoords, formatDistance, formatFacilityLocation } from '../services/locationService';

interface HealthcareMapProps {
  userCoords: LocationCoords | null;
  userAddress?: string;
  facilities: HealthcareCenter[];
  onSelectFacility?: (facility: HealthcareCenter) => void;
}

export const HealthcareMap: React.FC<HealthcareMapProps> = ({
  userCoords,
  userAddress,
  facilities,
  onSelectFacility,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current || typeof window === 'undefined') return;
    if (!userCoords) return; // Do NOT initialize with fake or default coordinates

    // Load Leaflet CSS dynamically if not present
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      const centerLat = userCoords.latitude;
      const centerLon = userCoords.longitude;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [centerLat, centerLon],
          zoom: 14,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.setView([centerLat, centerLon], 14);
      }

      const map = mapInstanceRef.current;

      // Clear existing markers
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle) {
          map.removeLayer(layer);
        }
      });

      const boundsPoints: [number, number][] = [[centerLat, centerLon]];

      // User location marker ("You are here")
      const userIcon = L.divIcon({
        className: 'custom-user-pin',
        html: `<div style="
          width: 22px;
          height: 22px;
          background-color: #0f766e;
          border: 3.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 14px rgba(15, 118, 110, 0.85);
        "></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      L.marker([centerLat, centerLon], { icon: userIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 6px; min-width: 190px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #0f766e;"></span>
              <strong style="color: #0f766e; font-size: 13.5px;">Your Location (Real GPS)</strong>
            </div>
            <p style="margin: 4px 0 2px; font-size: 12px; color: #334155; font-weight: 600;">
              ${userAddress || `GPS: ${centerLat.toFixed(5)}, ${centerLon.toFixed(5)}`}
            </p>
            ${userCoords.accuracy ? `<span style="font-size: 11px; color: #64748b; display: block;">Accuracy: ±${userCoords.accuracy}m</span>` : ''}
          </div>
        `);

      if (userCoords.accuracy && userCoords.accuracy < 2000) {
        L.circle([centerLat, centerLon], {
          radius: userCoords.accuracy,
          color: '#0f766e',
          fillColor: '#14b8a6',
          fillOpacity: 0.12,
          weight: 1,
        }).addTo(map);
      }

      // Real Facility markers
      facilities.forEach((f) => {
        if (!f.latitude || !f.longitude) return;

        boundsPoints.push([f.latitude, f.longitude]);

        let pinColor = '#0f766e'; // Teal for PHC/Clinic
        let pinIconText = '🏛️';
        if (f.type === 'hospital' || f.type === 'district_hospital') {
          pinColor = '#dc2626'; // Hospital Red
          pinIconText = '🏨';
        } else if (f.type === 'pharmacy') {
          pinColor = '#2563eb'; // Pharmacy Blue
          pinIconText = '💊';
        } else if (f.type === 'diagnostic') {
          pinColor = '#7c3aed'; // Diagnostic Purple
          pinIconText = '🔬';
        } else if (f.type === 'clinic') {
          pinColor = '#0284c7';
          pinIconText = '🩺';
        }

        const facilityIcon = L.divIcon({
          className: 'custom-facility-pin',
          html: `<div style="
            width: 30px;
            height: 30px;
            background-color: ${pinColor};
            color: #ffffff;
            border: 2.5px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
            cursor: pointer;
            transition: transform 0.15s ease;
          ">${pinIconText}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        // Exact coordinates driving directions URL
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${centerLat},${centerLon}&destination=${f.latitude},${f.longitude}&travelmode=driving`;

        const displayDist = formatDistance(f.distanceKm);
        const displayLocality = formatFacilityLocation(f);
        const displayPhone = f.phone ? f.phone : null;

        const popupContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; width: 250px; padding: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; margin-bottom: 6px;">
              <h4 style="margin: 0; font-size: 14.5px; color: #0f172a; font-weight: 700; line-height: 1.3;">
                ${f.name}
              </h4>
              ${f.emergency24x7 ? `<span style="background-color: #fee2e2; color: #dc2626; font-size: 10px; font-weight: 700; padding: 2px 5px; border-radius: 4px; white-space: nowrap;">24x7</span>` : ''}
            </div>

            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="background-color: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; font-size: 12px; font-weight: 700; padding: 2px 7px; border-radius: 12px;">
                📍 ${displayDist}
              </span>
              <span style="font-size: 10.5px; color: #64748b;">
                GPS: ${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}
              </span>
            </div>

            <p style="margin: 0 0 8px; font-size: 12px; color: #475569; line-height: 1.4;">
              📍 ${displayLocality}
            </p>

            <div style="display: flex; gap: 6px;">
              ${displayPhone ? `
                <a href="tel:${displayPhone.replace(/\\s+/g, '')}" style="
                  flex: 1;
                  text-align: center;
                  background-color: #f8fafc;
                  color: #0f766e;
                  padding: 7px 4px;
                  border-radius: 6px;
                  text-decoration: none;
                  font-size: 11.5px;
                  font-weight: 600;
                  border: 1px solid #cbd5e1;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 3px;
                ">📞 Call</a>
              ` : ''}
              <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="
                flex: 1;
                text-align: center;
                background-color: #0f766e;
                color: #ffffff;
                padding: 7px 6px;
                border-radius: 6px;
                text-decoration: none;
                font-size: 11.5px;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 3px;
              ">🧭 Directions</a>
            </div>
          </div>
        `;

        const marker = L.marker([f.latitude, f.longitude], { icon: facilityIcon }).addTo(map);
        marker.bindPopup(popupContent);

        if (onSelectFacility) {
          marker.on('click', () => onSelectFacility(f));
        }
      });

      // Fit map to show both the user and returned facilities comfortably
      if (boundsPoints.length > 1 && facilities.length > 0) {
        try {
          const lBounds = L.latLngBounds(boundsPoints);
          map.fitBounds(lBounds, { padding: [40, 40], maxZoom: 16 });
        } catch (bErr) {
          console.warn('[HealthcareMap] fitBounds error:', bErr);
        }
      }
    };

    if ((window as any).L) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.body.appendChild(script);
    }

    return () => {
      // Map cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [userCoords, userAddress, facilities, onSelectFacility]);

  return (
    <div style={{
      borderRadius: '14px',
      overflow: 'hidden',
      border: '1px solid #cbd5e1',
      marginBottom: '20px',
      backgroundColor: '#ffffff',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
    }}>
      {/* Map Header with Legend */}
      <div style={{
        padding: '10px 14px',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#0f766e' }}>
          <Compass size={16} />
          <span>Live Healthcare Discovery Map</span>
          {facilities.length > 0 && (
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>
              ({facilities.length} verified pin{facilities.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        {/* Legend Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11px', color: '#475569' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ffffff', padding: '3px 7px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0f766e', display: 'inline-block' }}></span>
            You (GPS)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ffffff', padding: '3px 7px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span>🏛️</span> PHC/CHC
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ffffff', padding: '3px 7px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span>🏨</span> Hospital
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ffffff', padding: '3px 7px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span>💊</span> Pharmacy
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ffffff', padding: '3px 7px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span>🔬</span> Lab
          </span>
        </div>
      </div>

      {/* Map Canvas */}
      <div style={{ position: 'relative', width: '100%', height: '360px', backgroundColor: '#f1f5f9' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {!userCoords && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.94)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            color: '#475569',
            fontSize: '13.5px',
            zIndex: 400,
            padding: '24px',
            textAlign: 'center'
          }}>
            <MapPin size={34} color="#0f766e" />
            <span style={{ fontWeight: 700, color: '#0f766e', fontSize: '15px' }}>Acquiring Real Device GPS...</span>
            <span style={{ fontSize: '12.5px', color: '#64748b', maxWidth: '380px' }}>
              Waiting for device GPS coordinates to render your location and verified healthcare facilities.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
