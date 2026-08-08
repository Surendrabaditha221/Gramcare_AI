import React from 'react';
import { PhoneCall, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface EmergencyHeaderBarProps {
  onOpenEmergencyModal: () => void;
}

export const EmergencyHeaderBar: React.FC<EmergencyHeaderBarProps> = ({
  onOpenEmergencyModal
}) => {
  const { lang } = useLanguage();

  return (
    <div style={{
      backgroundColor: '#dc2626',
      color: '#ffffff',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '14px',
      fontWeight: 600,
      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertCircle size={18} color="#ffffff" style={{ animation: 'pulse 2s infinite' }} />
        <span>{lang === 'te' ? 'అత్యవసరం? 108 అంబులెన్స్' : 'EMERGENCY 108 AMBULANCE'}</span>
      </div>

      <button
        onClick={onOpenEmergencyModal}
        style={{
          backgroundColor: '#ffffff',
          color: '#dc2626',
          border: 'none',
          borderRadius: '16px',
          padding: '4px 12px',
          fontWeight: 700,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer'
        }}
      >
        <PhoneCall size={14} />
        {lang === 'te' ? 'కాల్ చేయండి' : 'CALL NOW'}
      </button>
    </div>
  );
};
