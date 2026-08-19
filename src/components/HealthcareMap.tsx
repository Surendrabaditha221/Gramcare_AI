import React, { useEffect, useRef } from 'react';
import { MapPin, Navigation, PhoneCall, Hospital } from 'lucide-react';
import { HealthcareCenter } from '../types/healthCenter';
import { LocationCoords } from '../services/locationService';

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
      if (!L) return;

      const defaultLat = userCoords?.latitude || 17.385;
      const defaultLon = userCoords?.longitude || 78.4867;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [defaultLat, defaultLon],
          zoom: 13,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.setView([defaultLat, defaultLon], 13);
      }

      const map = mapInstanceRef.current;

      // Clear existing markers
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle) {
          map.removeLayer(layer);
        }
      });

      // User location marker (Blue dot)
      if (userCoords) {
        const userIcon = L.divIcon({
          className: 'custom-user-pin',
          html: `<div style="
            width: 20px;
            height: 20px;
            background-color: #2563eb;
            border: 3px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 0 12px rgba(37, 99, 235, 0.8);
          "></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        L.marker([userCoords.latitude, userCoords.longitude], { icon: userIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: system-ui, sans-serif; padding: 4px;">
              <strong style="color: #2563eb;">Your Current Location</strong>
              <p style="margin: 4px 0 0; font-size: 12px; color: #475569;">${userAddress || 'GPS Location Detected'}</p>
            </div>
          `);

        if (userCoords.accuracy) {
          L.circle([userCoords.latitude, userCoords.longitude], {
            radius: Math.min(userCoords.accuracy, 2000),
            color: '#3b82f6',
            fillColor: '#60a5fa',
            fillOpacity: 0.15,
            weight: 1,
          }).addTo(map);
        }
      }

      // Facility markers
      facilities.forEach((f) => {
        if (!f.latitude || !f.longitude) return;

        let pinColor = '#0f766e'; // Default PHC/CHC Teal
        if (f.type === 'district_hospital') pinColor = '#dc2626'; // Hospital Red
        else if (f.type === 'pharmacy') pinColor = '#2563eb'; // Pharmacy Blue

        const facilityIcon = L.divIcon({
          className: 'custom-facility-pin',
          html: `<div style="
            width: 26px;
            height: 26px;
            background-color: ${pinColor};
            color: #ffffff;
            border: 2px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          ">🏥</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userCoords?.latitude || ''},${userCoords?.longitude || ''}&destination=${f.latitude},${f.longitude}&travelmode=driving`;

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; width: 220px; padding: 4px;">
            <h4 style="margin: 0 0 4px; font-size: 14px; color: ${pinColor};">${f.name}</h4>
            <p style="margin: 0 0 6px; font-size: 12px; color: #64748b;">
              <strong>${f.distanceKm} km away</strong> • ${f.villageOrTaluka}
            </p>
            <div style="display: flex; gap: 6px; margin-top: 8px;">
              ${f.phone ? `
              <a href="tel:${f.phone.replace(/\\s+/g, '')}" style="
                flex: 1;
                text-align: center;
                background-color: #f1f5f9;
                color: #0f766e;
                padding: 6px;
                border-radius: 6px;
                text-decoration: none;
                font-size: 11px;
                font-weight: 600;
              ">📞 Call</a>
              ` : ''}
              <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="
                flex: 1;
                text-align: center;
                background-color: #0f766e;
                color: #ffffff;
                padding: 6px;
                border-radius: 6px;
                text-decoration: none;
                font-size: 11px;
                font-weight: 600;
              ">🧭 Navigate</a>
            </div>
          </div>
        `;

        const marker = L.marker([f.latitude, f.longitude], { icon: facilityIcon }).addTo(map);
        marker.bindPopup(popupContent);

        if (onSelectFacility) {
          marker.on('click', () => onSelectFacility(f));
        }
      });
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
      position: 'relative',
      width: '100%',
      height: '320px',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1.5px solid #cbd5e1',
      marginBottom: '20px',
      backgroundColor: '#f8fafc',
    }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      {!userCoords && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#475569',
          fontSize: '13px',
          zIndex: 400,
        }}>
          <MapPin size={28} color="#0f766e" />
          <span>Interactive Map: Waiting for user location coordinates...</span>
        </div>
      )}
    </div>
  );
};
