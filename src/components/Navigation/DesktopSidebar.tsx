import React from 'react';
import {
  Home,
  FileText,
  Bot,
  Bell,
  User,
  Settings,
  HeartPulse,
  PhoneCall,
  UserCheck,
  ShieldAlert
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { ConnectivityIndicator } from '../Connectivity/ConnectivityIndicator';
import { NetworkStatus } from '../../types/connectivity';

interface DesktopSidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  onOpenEmergencyModal: () => void;
  activePatientName?: string;
  userName?: string;
  status: NetworkStatus;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  currentRoute,
  onNavigate,
  onOpenEmergencyModal,
  activePatientName = 'Primary User',
  userName,
  status
}) => {
  const { lang, t } = useLanguage();

  const navItems = [
    { id: 'home', label: t.navHome, icon: Home },
    { id: 'records', label: t.navRecords, icon: FileText },
    { id: 'assistant', label: t.navAssistant, icon: Bot },
    { id: 'notifications', label: t.navNotifications, icon: Bell },
    { id: 'profile', label: t.navProfile, icon: User },
    { id: 'settings', label: lang === 'te' ? 'సెట్టింగ్‌లు' : 'Settings', icon: Settings }
  ];

  return (
    <aside
      className="desktop-only"
      style={{
        width: '270px',
        minWidth: '270px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px 16px',
        position: 'sticky',
        top: 0,
        height: '100vh',
        boxShadow: '2px 0 12px rgba(0,0,0,0.03)',
        zIndex: 90
      }}
    >
      <div>
        {/* Brand Header */}
        <div
          onClick={() => onNavigate('home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            padding: '4px 8px 20px 8px',
            borderBottom: '1px solid #f1f5f9'
          }}
        >
          <div
            style={{
              backgroundColor: '#0f766e',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)'
            }}
          >
            <HeartPulse size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f766e', margin: 0, lineHeight: 1.2 }}>
              GramCare AI
            </h2>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.4px' }}>
              Rural Healthcare Suite
            </span>
          </div>
        </div>

        {/* Active Patient Context Badge */}
        <div
          onClick={() => onNavigate('patient_select')}
          style={{
            marginTop: '16px',
            marginBottom: '20px',
            padding: '10px 12px',
            backgroundColor: '#f0fdf4',
            borderRadius: '12px',
            border: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title="Click to switch active family patient"
        >
          <UserCheck size={18} color="#0f766e" />
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#166534', fontWeight: 700, letterSpacing: '0.5px' }}>
              {lang === 'te' ? 'సక్రియాత్మక రోగి' : 'Active Patient'}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f766e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activePatientName}
            </div>
          </div>
        </div>

        {/* Primary Desktop Navigation Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: isActive ? '#f0fdf4' : 'transparent',
                  color: isActive ? '#0f766e' : '#475569',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={20} color={isActive ? '#0f766e' : '#64748b'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Controls: SOS Emergency + Connectivity + User Card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
        {/* Quick SOS Trigger */}
        <button
          onClick={onOpenEmergencyModal}
          style={{
            width: '100%',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 14px',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
            transition: 'all 0.2s ease'
          }}
        >
          <ShieldAlert size={18} />
          <span>{lang === 'te' ? 'అత్యవసర SOS' : 'Emergency SOS'}</span>
        </button>

        {/* Connectivity Status */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ConnectivityIndicator status={status} lang={lang} />
        </div>

        {/* User Card */}
        {userName && (
          <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', fontWeight: 500 }}>
            Logged in as <strong style={{ color: '#0f766e' }}>{userName}</strong>
          </div>
        )}
      </div>
    </aside>
  );
};
