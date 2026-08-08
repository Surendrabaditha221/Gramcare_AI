import React, { useState } from 'react';
import { Home, FileText, Bot, Bell, User, HeartPulse } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage } from '../hooks/useLanguage';
import { ConnectivityIndicator } from '../components/Connectivity/ConnectivityIndicator';
import { EmergencyHeaderBar } from '../components/Emergency/EmergencyHeaderBar';
import { EmergencyModal } from '../components/Emergency/EmergencyModal';
import { DesktopSidebar } from '../components/Navigation/DesktopSidebar';

interface MainLayoutProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  currentScreen,
  onNavigate,
  children
}) => {
  const { status } = useOnlineStatus();
  const { lang, t } = useLanguage();
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);

  const navItems = [
    { id: 'home', label: t.navHome, icon: Home },
    { id: 'records', label: t.navRecords, icon: FileText },
    { id: 'assistant', label: t.navAssistant, icon: Bot },
    { id: 'notifications', label: t.navNotifications, icon: Bell },
    { id: 'profile', label: t.navProfile, icon: User }
  ];

  return (
    <div className="app-container">
      {/* Desktop Navigation Sidebar (visible only on screens >=1024px) */}
      <DesktopSidebar
        currentRoute={currentScreen}
        onNavigate={onNavigate}
        onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
        status={status}
      />

      <div className="desktop-layout-wrapper">
        <EmergencyHeaderBar onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)} />

        {/* Mobile Header (visible only on screens <1024px) */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              backgroundColor: '#0f766e',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '4px',
              display: 'flex'
            }}>
              <HeartPulse size={20} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '18px', color: '#0f766e' }}>
              GramCare AI
            </span>
          </div>

          <ConnectivityIndicator status={status} lang={lang} />
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (visible only on screens <1024px) */}
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
          boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
          zIndex: 200
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
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
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70px' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
      />
    </div>
  );
};
