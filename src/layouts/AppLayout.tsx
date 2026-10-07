import React from 'react';
import { Home, FileText, Bot, Bell, User, HeartPulse } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage } from '../hooks/useLanguage';
import { ConnectivityIndicator } from '../components/Connectivity/ConnectivityIndicator';
import { Toast } from '../components/Layout/Toast';
import { EmergencyHeaderBar } from '../components/Emergency/EmergencyHeaderBar';
import { DesktopSidebar } from '../components/Navigation/DesktopSidebar';

interface AppLayoutProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  onOpenEmergencyModal: () => void;
  children: React.ReactNode;
  showBottomNav?: boolean;
  activePatientName?: string;
  userName?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentRoute,
  onNavigate,
  onOpenEmergencyModal,
  children,
  showBottomNav = true,
  activePatientName,
  userName
}) => {
  const {
    status,
    showReconnectedToast,
    showOfflineToast,
    showServiceUnavailableToast,
    dismissToast
  } = useOnlineStatus();

  const { lang, t } = useLanguage();

  const navItems = [
    { id: 'home', label: t.navHome, icon: Home },
    { id: 'records', label: t.navRecords, icon: FileText },
    { id: 'assistant', label: t.navAssistant, icon: Bot },
    { id: 'notifications', label: t.navNotifications, icon: Bell },
    { id: 'profile', label: t.navProfile, icon: User }
  ];

  return (
    <div className="app-container">
      {/* Toast Notifications */}
      <Toast
        message={t.reconnectedToast}
        isVisible={showReconnectedToast}
        durationMs={3000}
        onClose={dismissToast}
      />
      <Toast
        message={t.offlineNotice}
        isVisible={showOfflineToast}
        durationMs={4000}
        onClose={dismissToast}
      />
      <Toast
        message={t.backendUnavailableTitle}
        isVisible={showServiceUnavailableToast}
        durationMs={4000}
        onClose={dismissToast}
      />

      {/* Desktop Left Navigation Sidebar (Visible only on screens >=1024px) */}
      <DesktopSidebar
        currentRoute={currentRoute}
        onNavigate={onNavigate}
        onOpenEmergencyModal={onOpenEmergencyModal}
        activePatientName={activePatientName}
        userName={userName}
        status={status}
      />

      {/* Main Desktop & Mobile Layout Container */}
      <div className="desktop-layout-wrapper">
        {/* Emergency Quick Header Bar */}
        <EmergencyHeaderBar onOpenEmergencyModal={onOpenEmergencyModal} />

        {/* Mobile Sticky Application Header (Visible only on screens <1024px) */}
        <header
          className="mobile-only"
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: '10px 16px',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            width: '100%'
          }}
        >
          <div
            onClick={() => onNavigate('home')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <div
              style={{
                backgroundColor: '#0f766e',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '4px',
                display: 'flex'
              }}
            >
              <HeartPulse size={20} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '18px', color: '#0f766e' }}>
              GramCare AI
            </span>
          </div>

          <ConnectivityIndicator status={status} lang={lang} />
        </header>

        {/* Screen Viewport */}
        <main className="main-content">
          {children}
        </main>
      </div>

      {/* Mobile 5-Tab Bottom Navigation Bar (Visible only on screens <1024px) */}
      {showBottomNav && (
        <nav
          className="mobile-only"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            justifyContent: 'space-around',
            padding: '8px 4px',
            boxShadow: '0 -4px 14px rgba(0, 0, 0, 0.06)',
            zIndex: 200
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  flex: 1,
                  padding: '6px 2px',
                  borderRadius: '8px',
                  color: isActive ? '#0f766e' : '#64748b',
                  backgroundColor: isActive ? '#f0fdf4' : 'transparent',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '11px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={20} color={isActive ? '#0f766e' : '#64748b'} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '72px' }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};
