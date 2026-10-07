import React, { useState, useEffect, useRef } from 'react';
import {
  Settings as SettingsIcon, Languages, Bell, Trash2, Info, LogOut, Check, Lock, AlertTriangle,
  Search, X, Globe2, CheckCircle2
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { SCHEDULED_INDIAN_LANGUAGES, IndianLanguage } from '../data/indianLanguages';
import { localStorageService } from '../services/localStorageService';
import { indexedDbService } from '../services/indexedDbService';
import { deleteAccountBackend, changePasswordBackend } from '../services/api';

interface SettingsScreenProps {
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onLogout }) => {
  const { lang, selectedLanguageCode, selectedLanguageMeta, switchLanguage, t } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [clearedNotice, setClearedNotice] = useState<string | null>(null);

  // App Language Modal State
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [tempLangCode, setTempLangCode] = useState<string>(selectedLanguageCode || lang || 'en');
  const [langSearchQuery, setLangSearchQuery] = useState('');
  const [langSuccessNotice, setLangSuccessNotice] = useState<string | null>(null);
  const langSearchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when language modal opens
  useEffect(() => {
    if (showLanguageModal) {
      const timer = setTimeout(() => {
        langSearchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setLangSearchQuery('');
    }
  }, [showLanguageModal]);

  // Keyboard navigation: Escape key closes language modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLanguageModal) {
        setShowLanguageModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLanguageModal]);

  // Current language metadata
  const currentLang =
    SCHEDULED_INDIAN_LANGUAGES.find((l) => l.code === (selectedLanguageCode || lang)) ||
    selectedLanguageMeta ||
    SCHEDULED_INDIAN_LANGUAGES[0];

  // Filter languages in modal
  const filteredLanguages = SCHEDULED_INDIAN_LANGUAGES.filter((item) => {
    const q = langSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.englishName.toLowerCase().includes(q) ||
      item.nativeName.toLowerCase().includes(q) ||
      item.script.toLowerCase().includes(q)
    );
  });

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

      {/* Language Success Toast */}
      {langSuccessNotice && (
        <div style={{
          backgroundColor: '#f0fdf4',
          color: '#15803d',
          border: '1px solid #bbf7d0',
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={18} color="#16a34a" />
          <span>{langSuccessNotice}</span>
        </div>
      )}

      {/* App Language Section */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Languages size={20} color="#0f766e" />
          <h3 style={{ margin: 0, fontSize: '17px', color: '#1e293b', fontWeight: 700 }}>
            {t.langSetting || 'App Language'}
          </h3>
        </div>
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
          Choose your preferred language for GramCare AI.
        </p>

        {/* Selected Language Display Card with Change Language Button */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: '14px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: '#f0fdfa',
              border: '1px solid #ccfbf1',
              borderRadius: '10px',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f766e',
              flexShrink: 0
            }}>
              <Globe2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>
                {currentLang.nativeName} ({currentLang.englishName})
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                Script: {currentLang.script}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTempLangCode(selectedLanguageCode || lang || 'en');
              setLangSearchQuery('');
              setShowLanguageModal(true);
            }}
            style={{
              backgroundColor: '#ffffff',
              border: '1.5px solid #0f766e',
              color: '#0f766e',
              borderRadius: '10px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(15, 118, 110, 0.1)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0f766e';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#0f766e';
            }}
          >
            <span>{t.changeLanguage || 'Change Language'}</span>
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

      {/* ── Change Language Modal Dialog ── */}
      {showLanguageModal && (
        <div
          onClick={() => setShowLanguageModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Select Language"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              maxWidth: '460px',
              width: '100%',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px 14px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>
                  {t.selectLanguageModalTitle || 'Change Language'}
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  {t.selectLanguageModalSub || 'Choose your preferred language for GramCare AI.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowLanguageModal(false)}
                title="Close (Esc)"
                style={{
                  backgroundColor: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input Bar */}
            <div style={{ padding: '14px 20px 10px', position: 'relative' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search
                  size={18}
                  color="#94a3b8"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  ref={langSearchInputRef}
                  type="text"
                  value={langSearchQuery}
                  onChange={(e) => setLangSearchQuery(e.target.value)}
                  placeholder={t.searchLanguagesPlaceholder || 'Search languages...'}
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 42px',
                    borderRadius: '14px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: '#f8fafc',
                    color: '#1e293b',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {langSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLangSearchQuery('')}
                    title="Clear search"
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Language List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '4px 14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {filteredLanguages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 600 }}>
                    No languages found
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                    No language matching &ldquo;{langSearchQuery}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => setLangSearchQuery('')}
                    style={{
                      marginTop: '14px',
                      backgroundColor: '#f1f5f9',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0f766e',
                      cursor: 'pointer'
                    }}
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                filteredLanguages.map((item: IndianLanguage) => {
                  const isSelected = tempLangCode === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setTempLangCode(item.code)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: '14px',
                        border: isSelected ? '1.5px solid #0f766e' : '1px solid transparent',
                        backgroundColor: isSelected ? 'rgba(15, 118, 110, 0.08)' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s ease-in-out',
                        outline: 'none',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#ffffff';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{
                          fontSize: '16px',
                          fontWeight: isSelected ? 800 : 700,
                          color: isSelected ? '#0f766e' : '#1e293b'
                        }}>
                          {item.nativeName}
                        </span>
                        <span style={{ fontSize: '13px', color: '#64748b', marginTop: '1px' }}>
                          {item.englishName} · <span style={{ fontSize: '11px', color: '#94a3b8' }}>{item.script}</span>
                        </span>
                      </div>

                      {/* Radio Check Indicator */}
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        border: isSelected ? '2px solid #0f766e' : '2px solid #cbd5e1',
                        backgroundColor: isSelected ? '#0f766e' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isSelected && <Check size={13} color="#ffffff" strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Modal Footer Actions (Cancel & Apply Language) */}
            <div style={{
              padding: '14px 20px 18px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              backgroundColor: '#fafafa'
            }}>
              <button
                type="button"
                onClick={() => setShowLanguageModal(false)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  color: '#475569',
                  borderRadius: '12px',
                  padding: '10px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {t.cancelBtn || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tempLangCode) {
                    switchLanguage(tempLangCode);
                    const applied = SCHEDULED_INDIAN_LANGUAGES.find(l => l.code === tempLangCode);
                    setLangSuccessNotice(`Language changed to ${applied ? applied.englishName : tempLangCode}`);
                    setTimeout(() => setLangSuccessNotice(null), 3000);
                  }
                  setShowLanguageModal(false);
                }}
                style={{
                  backgroundColor: '#0f766e',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '10px 22px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(15, 118, 110, 0.25)'
                }}
              >
                {t.applyLanguage || 'Apply Language'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
