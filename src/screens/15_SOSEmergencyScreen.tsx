import React from 'react';
import { PhoneCall, ShieldAlert, MapPin, HeartHandshake, UserCheck, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { MOCK_EMERGENCY_HOTLINES } from '../data/mockHealthcare';

interface SOSEmergencyScreenProps {
  onBack: () => void;
  onNavigateToNearby: () => void;
}

export const SOSEmergencyScreen: React.FC<SOSEmergencyScreenProps> = ({
  onBack,
  onNavigateToNearby
}) => {
  const { lang, t } = useLanguage();

  return (
    <div style={{
      backgroundColor: '#fef2f2',
      minHeight: '85vh',
      borderRadius: '20px',
      padding: '24px 20px',
      border: '2px solid #fca5a5',
      maxWidth: '720px',
      margin: '0 auto',
      width: '100%'
    }}>
      {/* Top Back Navigation */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: '#dc2626',
          fontWeight: 700,
          fontSize: '14px',
          marginBottom: '14px',
          border: 'none',
          background: 'none',
          cursor: 'pointer'
        }}
      >
        <ArrowLeft size={18} />
        Return to App
      </button>

      {/* High-Urgency Emergency Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          backgroundColor: '#dc2626',
          borderRadius: '50%',
          width: '72px',
          height: '72px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
          boxShadow: '0 0 24px rgba(220, 38, 38, 0.4)'
        }}>
          <ShieldAlert size={40} color="#ffffff" />
        </div>

        <h1 style={{ color: '#991b1b', fontSize: '26px', margin: '0 0 4px 0' }}>
          {t.sosTitle}
        </h1>

        <p style={{ color: '#b91c1c', fontSize: '14px', margin: 0, fontWeight: 600 }}>
          Tap below for instant emergency hotline connection
        </p>
      </div>

      {/* Primary 108 Emergency Dialing Action */}
      <a
        href="tel:108"
        className="btn btn-emergency"
        style={{
          fontSize: '22px',
          padding: '18px',
          borderRadius: '16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}
      >
        <PhoneCall size={28} />
        <span>{t.callEmergencyServices}</span>
      </a>

      {/* Other Official Hotlines List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {MOCK_EMERGENCY_HOTLINES.slice(1).map((contact) => (
          <div
            key={contact.id}
            style={{
              backgroundColor: '#ffffff',
              border: '1.5px solid #fca5a5',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                {contact.title}
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                {contact.description}
              </p>
            </div>

            <a
              href={`tel:${contact.number.replace(/\s+/g, '')}`}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                padding: '8px 14px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <PhoneCall size={14} />
              {contact.number}
            </a>
          </div>
        ))}
      </div>

      {/* Find Nearby Hospital Trigger */}
      <button
        onClick={onNavigateToNearby}
        className="btn"
        style={{
          backgroundColor: '#ffffff',
          border: '2px solid #0f766e',
          color: '#0f766e',
          fontSize: '16px',
          fontWeight: 700,
          borderRadius: '14px',
          padding: '14px'
        }}
      >
        <MapPin size={20} />
        <span>Find Nearest Emergency Hospital</span>
      </button>
    </div>
  );
};
