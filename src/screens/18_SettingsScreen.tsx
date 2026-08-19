import React, { useState } from 'react';
import { Settings as SettingsIcon, Languages, Bell, Shield, Trash2, Info, LogOut, Check, Lock, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { localStorageService } from '../services/localStorageService';
import { indexedDbService } from '../services/indexedDbService';
import { deleteAccountBackend, changePasswordBackend } from '../services/api';

interface SettingsScreenProps {
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onLogout }) => {
  const { lang, switchLanguage, t } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [clearedNotice, setClearedNotice] = useState<string | null>(null);

  // Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClearCache = async () => {
    if (window.confirm('Are you sure you want to clear all offline stored health data?')) {
      localStorageService.clearAllOfflineData();
      await indexedDbService.clearAllData();
      setClearedNotice('Offline storage cleared successfully!');
      setTimeout(() => setClearedNotice(null), 3000);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;
    const ok = await changePasswordBackend(oldPassword, newPassword);
    if (ok) {
      setPasswordStatus('Password changed successfully!');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordStatus(null);
        setOldPassword('');
        setNewPassword('');
      }, 1500);
    } else {
      setPasswordStatus('Failed to change password. Check current password.');
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccountBackend();
      localStorageService.clearAllOfflineData();
      await indexedDbService.clearAllData();
      onLogout();
    } catch {
      setIsDeleting(false);
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
          Configure app language, notifications, password, offline data, and security.
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
          {clearedNotice}
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

      {/* Change Password */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Lock size={20} color="#0f766e" />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                Account Security
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Update account password</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            style={{
              backgroundColor: '#f0fdf4',
              color: '#0f766e',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Change Password
          </button>
        </div>
      </div>

      {/* Offline Storage Management */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trash2 size={20} color="#64748b" />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#334155' }}>
                {t.clearOfflineData}
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Reset local cache & triage logs</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearCache}
            style={{
              backgroundColor: '#f8fafc',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Clear Cache
          </button>
        </div>
      </div>

      {/* Delete Account */}
      <div className="card" style={{ borderColor: '#fca5a5', backgroundColor: '#fff5f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="#dc2626" />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#991b1b' }}>
                Delete Account
              </h3>
              <span style={{ fontSize: '12px', color: '#b91c1c' }}>Permanently remove your MongoDB health profile</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Delete
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
          GramCare AI Production SaaS • Commercial Healthcare Companion & Symptom Triage in India.
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

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '16px'
        }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '24px', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f766e' }}>
              Change Account Password
            </h3>

            {passwordStatus && (
              <div style={{ fontSize: '13px', color: passwordStatus.includes('success') ? '#15803d' : '#b91c1c', marginBottom: '12px' }}>
                {passwordStatus}
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="password"
                required
                placeholder="Current Password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                style={{ padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px' }}
              />
              <input
                type="password"
                required
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px' }}
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '16px'
        }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '24px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#1e293b' }}>
              Delete Account & All Data
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
              This will permanently delete your user account, patient profiles, health records, and chat history from MongoDB. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="btn btn-emergency"
                style={{ flex: 1 }}
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
