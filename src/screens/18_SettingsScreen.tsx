import React, { useState } from 'react';
import { Settings as SettingsIcon, Languages, Bell, Shield, Trash2, Info, LogOut, Check } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { localStorageService } from '../services/localStorageService';
import { indexedDbService } from '../services/indexedDbService';
import { PrimaryButton } from '../components/Common/PrimaryButton';

interface SettingsScreenProps {
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onLogout }) => {
  const { lang, switchLanguage, t } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [clearedNotice, setClearedNotice] = useState(false);

  const handleClearCache = async () => {
    if (window.confirm('Are you sure you want to clear all offline stored health data?')) {
      localStorageService.clearAllOfflineData();
      await indexedDbService.clearAllData();
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 3000);
    }
  };

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '22px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <SettingsIcon size={24} />
          {t.settingsTitle}
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
          Configure app language, notifications, offline data, and privacy.
        </p>
      </div>

      {clearedNotice && (
        <div style={{
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          border: '1px solid #fca5a5',
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          Offline storage cleared successfully!
        </div>
      )}

      {/* Language Setting */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <Languages size={20} color="#0f766e" />
          <h3 style={{ margin: 0, fontSize: '17px', color: '#1e293b' }}>
            {t.langSetting}
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            type="button"
            onClick={() => switchLanguage('en')}
            style={{
              backgroundColor: lang === 'en' ? '#0f766e' : '#f8fafc',
              color: lang === 'en' ? '#ffffff' : '#334155',
              border: `1.5px solid ${lang === 'en' ? '#0f766e' : '#cbd5e1'}`,
              borderRadius: '12px',
              padding: '10px',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>English</span>
            {lang === 'en' && <Check size={16} />}
          </button>

          <button
            type="button"
            onClick={() => switchLanguage('te')}
            style={{
              backgroundColor: lang === 'te' ? '#0f766e' : '#f8fafc',
              color: lang === 'te' ? '#ffffff' : '#334155',
              border: `1.5px solid ${lang === 'te' ? '#0f766e' : '#cbd5e1'}`,
              borderRadius: '12px',
              padding: '10px',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>తెలుగు (Telugu)</span>
            {lang === 'te' && <Check size={16} />}
          </button>
        </div>
      </div>

      {/* Notifications Toggle */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={20} color="#0f766e" />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                Health Alerts & Reminders
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Vaccination & ANC checkup alerts</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            style={{
              backgroundColor: notificationsEnabled ? '#0f766e' : '#cbd5e1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {notificationsEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Offline Storage Management */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trash2 size={20} color="#dc2626" />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#991b1b' }}>
                {t.clearOfflineData}
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Reset local cache & triage logs</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearCache}
            style={{
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* About GramCare */}
      <div className="card" style={{ backgroundColor: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Info size={20} color="#0f766e" />
          <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
            {t.aboutGramCare}
          </h3>
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
          GramCare AI v2.0-Frontend Prototype • Designed for Accessible Rural Health Companion & Symptom Triage in India.
        </p>
      </div>

      {/* Logout Action */}
      <button
        onClick={onLogout}
        className="btn btn-emergency"
        style={{
          marginTop: '16px',
          padding: '14px',
          fontSize: '16px',
          borderRadius: '14px'
        }}
      >
        <LogOut size={20} />
        <span>{t.logout}</span>
      </button>
    </div>
  );
};
