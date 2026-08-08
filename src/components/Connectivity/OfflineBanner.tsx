import React from 'react';
import { WifiOff, ShieldCheck, PhoneCall } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface OfflineBannerProps {
  onGoToFirstAid?: () => void;
  onOpenEmergency?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  onGoToFirstAid,
  onOpenEmergency
}) => {
  const { lang } = useLanguage();

  return (
    <div style={{
      backgroundColor: '#fff7ed',
      border: '1.5px solid #fed7aa',
      borderRadius: '16px',
      padding: '16px',
      marginBottom: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{
          backgroundColor: '#ffedd5',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <WifiOff size={20} color="#c2410c" />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '15px', color: '#9a3412', fontWeight: 700 }}>
            {lang === 'te' ? 'మీరు ప్రస్తుతం ఆఫ్‌లైన్‌లో ఉన్నారు' : "You're Now Offline"}
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#c2410c', lineHeight: 1.4 }}>
            {lang === 'te'
              ? 'కొన్ని గ్రామ్‌కేర్ AI ఫీచర్లకు ఇంటర్నెట్ అవసరం. ఆఫ్‌లైన్ అత్యవసర & ప్రాథమిక చికిత్స టూల్స్ అందుబాటులో ఉన్నాయి.'
              : 'Some GramCare AI features require an internet connection. Offline emergency and first-aid tools are still available.'}
          </p>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '10px',
        marginTop: '12px',
        borderTop: '1px solid #fed7aa',
        paddingTop: '12px'
      }}>
        {onGoToFirstAid && (
          <button
            onClick={onGoToFirstAid}
            className="btn btn-secondary"
            style={{ fontSize: '13px', minHeight: '38px', flex: 1, padding: '8px 12px' }}
          >
            <ShieldCheck size={16} />
            {lang === 'te' ? 'ఆఫ్‌లైన్ ప్రాథమిక చికిత్స' : 'Offline First Aid'}
          </button>
        )}
        {onOpenEmergency && (
          <button
            onClick={onOpenEmergency}
            className="btn btn-emergency"
            style={{ fontSize: '13px', minHeight: '38px', flex: 1, padding: '8px 12px' }}
          >
            <PhoneCall size={16} />
            {lang === 'te' ? '108 కాల్ చేయండి' : 'Emergency 108'}
          </button>
        )}
      </div>
    </div>
  );
};
