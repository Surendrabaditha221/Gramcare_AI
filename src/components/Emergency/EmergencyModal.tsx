import React from 'react';
import { X, PhoneCall, ShieldAlert } from 'lucide-react';
import { MOCK_EMERGENCY_HOTLINES } from '../../data/mockHealthcare';
import { useLanguage } from '../../hooks/useLanguage';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({ isOpen, onClose }) => {
  const { lang } = useLanguage();

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        maxWidth: '480px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            backgroundColor: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={20} color="#475569" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            backgroundColor: '#fef2f2',
            padding: '10px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldAlert size={28} color="#dc2626" />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#dc2626', fontSize: '20px' }}>
              {lang === 'te' ? 'అత్యవసర సహాయ సంఖ్యలు' : 'Emergency Assistance Hotlines'}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              {lang === 'te' ? 'కాల్ చేయడానికి సంఖ్యపై నొక్కండి' : 'Tap any number below for instant call'}
            </p>
          </div>
        </div>

        {/* Primary 108 Action */}
        <a
          href="tel:108"
          className="btn btn-emergency"
          style={{
            fontSize: '20px',
            padding: '16px',
            marginBottom: '20px',
            borderRadius: '14px',
            display: 'flex',
            gap: '12px'
          }}
        >
          <PhoneCall size={24} />
          {lang === 'te' ? '108 అంబులెన్స్ (కాల్ చేయండి)' : 'DIAL 108 AMBULANCE (Free)'}
        </a>

        {/* Contact List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {MOCK_EMERGENCY_HOTLINES.map((contact) => (
            <div
              key={contact.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: contact.isPrimary ? '#fff5f5' : '#ffffff'
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                  {contact.title}
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                  {contact.description}
                </p>
              </div>

              <a
                href={`tel:${contact.number.replace(/\s+/g, '')}`}
                style={{
                  backgroundColor: '#0f766e',
                  color: '#ffffff',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 600,
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
      </div>
    </div>
  );
};
