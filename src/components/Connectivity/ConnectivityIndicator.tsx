import React from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface ConnectivityIndicatorProps {
  status?: string;
  isOnline?: boolean;
  lang?: 'en' | 'te';
}

export const ConnectivityIndicator: React.FC<ConnectivityIndicatorProps> = ({
  lang = 'en'
}) => {
  const { isOnline, backendStatus } = useOnlineStatus();

  let bgColor = '#f0fdf4';
  let borderColor = '#bbf7d0';
  let textColor = '#15803d';
  let dotColor = '#22c55e';
  let icon = <Wifi size={14} color="#15803d" />;
  let labelEn = 'Online';
  let labelTe = 'ఆన్‌లైన్';

  if (!isOnline) {
    // CASE 1: Device Offline (Internet OFFLINE)
    bgColor = '#fef2f2';
    borderColor = '#fca5a5';
    textColor = '#dc2626';
    dotColor = '#ef4444';
    icon = <WifiOff size={14} color="#dc2626" />;
    labelEn = "You're Offline";
    labelTe = 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు';
  } else if (backendStatus === 'RECONNECTING') {
    // CASE 2: Internet ONLINE + Backend RECONNECTING
    bgColor = '#fefce8';
    borderColor = '#fef08a';
    textColor = '#a16207';
    dotColor = '#eab308';
    icon = <Wifi size={14} color="#a16207" />;
    labelEn = 'Reconnecting...';
    labelTe = 'మళ్ళీ కనెక్ట్ చేస్తోంది...';
  } else if (backendStatus === 'UNREACHABLE') {
    // CASE 3: Internet ONLINE + Backend UNREACHABLE (All retries failed)
    bgColor = '#fff7ed';
    borderColor = '#fed7aa';
    textColor = '#c2410c';
    dotColor = '#ea580c';
    icon = <AlertTriangle size={14} color="#c2410c" />;
    labelEn = 'GramCare backend unavailable';
    labelTe = 'గ్రామ్‌కేర్ బ్యాకెండ్ అందుబాటులో లేదు';
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '24px',
        padding: '5px 12px',
        fontSize: '12px',
        fontWeight: 700,
        color: textColor,
        transition: 'all 0.3s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}
      title={`GramCare Status: ${labelEn}`}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: dotColor,
          display: 'inline-block',
          boxShadow: isOnline ? `0 0 6px ${dotColor}` : 'none'
        }}
      />
      {icon}
      <span>{lang === 'te' ? labelTe : labelEn}</span>
    </div>
  );
};
