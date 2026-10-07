import React from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useLanguage } from '../../hooks/useLanguage';

interface ConnectivityIndicatorProps {
  status?: string;
  isOnline?: boolean;
  lang?: string;
}

export const ConnectivityIndicator: React.FC<ConnectivityIndicatorProps> = ({
  lang: _langProp
}) => {
  const { isOnline, backendStatus } = useOnlineStatus();
  const { t } = useLanguage();

  let bgColor = '#f0fdf4';
  let borderColor = '#bbf7d0';
  let textColor = '#15803d';
  let dotColor = '#22c55e';
  let icon = <Wifi size={14} color="#15803d" />;
  let label = t.online || 'Online';

  if (!isOnline) {
    // CASE 1: Device Offline (Internet OFFLINE)
    bgColor = '#fef2f2';
    borderColor = '#fca5a5';
    textColor = '#dc2626';
    dotColor = '#ef4444';
    icon = <WifiOff size={14} color="#dc2626" />;
    label = t.offline || "Offline";
  } else if (backendStatus === 'RECONNECTING') {
    // CASE 2: Internet ONLINE + Backend RECONNECTING
    bgColor = '#fefce8';
    borderColor = '#fef08a';
    textColor = '#a16207';
    dotColor = '#eab308';
    icon = <Wifi size={14} color="#a16207" />;
    label = t.loading || 'Reconnecting...';
  } else if (backendStatus === 'UNREACHABLE') {
    // CASE 3: Internet ONLINE + Backend UNREACHABLE (All retries failed)
    bgColor = '#fff7ed';
    borderColor = '#fed7aa';
    textColor = '#c2410c';
    dotColor = '#ea580c';
    icon = <AlertTriangle size={14} color="#c2410c" />;
    label = t.backendUnavailableTitle || 'Backend unavailable';
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
      title={`GramCare Status: ${label}`}
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
      <span>{label}</span>
    </div>
  );
};
