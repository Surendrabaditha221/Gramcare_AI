import React, { useState, useEffect, useRef } from 'react';
import {
  Languages,
  Check,
  ArrowRight,
  Search,
  ChevronDown,
  X,
  Globe2
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { SCHEDULED_INDIAN_LANGUAGES, IndianLanguage } from '../data/indianLanguages';
import { useAuth } from '../context/AuthContext';

interface LanguageScreenProps {
  onNext: () => void;
}

export const LanguageScreen: React.FC<LanguageScreenProps> = ({ onNext }) => {
  const { lang, selectedLanguageCode, switchLanguage, t } = useLanguage();
  const { updateUserLanguage } = useAuth();

  // Default to existing selected language, context language, or English
  const [selectedCode, setSelectedCode] = useState<string>(() => {
    return selectedLanguageCode || lang || 'en';
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync state if context updates
  useEffect(() => {
    if (selectedLanguageCode) {
      setSelectedCode(selectedLanguageCode);
    }
  }, [selectedLanguageCode]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isDropdownOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [isDropdownOpen]);

  // Keyboard navigation: Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen]);

  // Find currently selected language metadata
  const currentLanguage =
    SCHEDULED_INDIAN_LANGUAGES.find((item) => item.code === selectedCode) ||
    SCHEDULED_INDIAN_LANGUAGES[0];

  // Filter languages based on search query
  const filteredLanguages = SCHEDULED_INDIAN_LANGUAGES.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.englishName.toLowerCase().includes(q) ||
      item.nativeName.toLowerCase().includes(q) ||
      item.script.toLowerCase().includes(q)
    );
  });

  const handleSelectLanguage = (code: string) => {
    setSelectedCode(code);
    switchLanguage(code);
    setIsDropdownOpen(false);
  };

  const handleContinue = () => {
    if (selectedCode) {
      switchLanguage(selectedCode);
      updateUserLanguage(selectedCode).catch(() => {});
    }
    onNext();
  };

  return (
    <div
      style={{
        backgroundColor: '#F7FAFC',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* ── Main Clean Language Selection Card ── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          maxWidth: '460px',
          width: '100%',
          padding: '36px 32px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          position: 'relative',
        }}
      >
        {/* Language Icon Badge */}
        <div
          style={{
            backgroundColor: '#E6FFFA',
            border: '1.5px solid #CCFBF1',
            borderRadius: '50%',
            width: '64px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            boxShadow: '0 4px 12px rgba(15, 118, 110, 0.08)',
          }}
        >
          <Languages size={32} color="#0F766E" />
        </div>

        {/* Heading & Subtitle */}
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#0F766E',
            margin: '0 0 6px 0',
            letterSpacing: '-0.3px',
          }}
        >
          {t?.chooseLangTitle || 'Choose Your Language'}
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: '#64748B',
            margin: '0 0 28px 0',
            lineHeight: 1.5,
          }}
        >
          {t?.chooseLangSub || 'Select your preferred language for healthcare guidance.'}
        </p>

        {/* Language Selector Trigger */}
        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#334155',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Selected Language
          </label>

          <button
            type="button"
            onClick={() => setIsDropdownOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isDropdownOpen}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFFFFF',
              border: isDropdownOpen ? '2px solid #0F766E' : '1.5px solid #CBD5E1',
              borderRadius: '16px',
              padding: '14px 18px',
              boxSizing: 'border-box',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
              boxShadow: isDropdownOpen
                ? '0 0 0 3px rgba(15, 118, 110, 0.15)'
                : '0 2px 4px rgba(0, 0, 0, 0.02)',
              outline: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left' }}>
              <div
                style={{
                  backgroundColor: '#F0FDFA',
                  borderRadius: '10px',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0F766E',
                  flexShrink: 0,
                }}
              >
                <Globe2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#1E293B', lineHeight: 1.2 }}>
                  {currentLanguage.nativeName}
                </div>
                <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
                  {currentLanguage.englishName} ({currentLanguage.script})
                </div>
              </div>
            </div>

            <ChevronDown
              size={20}
              color="#64748B"
              style={{
                transition: 'transform 0.2s ease',
                transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                flexShrink: 0,
                marginLeft: '8px',
              }}
            />
          </button>
        </div>

        {/* Continue Button */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedCode}
          style={{
            width: '100%',
            backgroundColor: '#0F766E',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '16px',
            padding: '16px 24px',
            fontSize: '16px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: selectedCode ? 'pointer' : 'not-allowed',
            opacity: selectedCode ? 1 : 0.6,
            boxShadow: '0 4px 14px rgba(15, 118, 110, 0.25)',
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
        >
          <span>{t?.continueBtn || 'Continue'}</span>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* ── Modern Searchable Dropdown Modal / Bottom Sheet ── */}
      {isDropdownOpen && (
        <div
          onClick={() => setIsDropdownOpen(false)}
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
            boxSizing: 'border-box',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Select Language"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              maxWidth: '460px',
              width: '100%',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              animation: 'modalSlideUp 0.2s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px 14px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1E293B' }}>
                  Select Language
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                  22 Scheduled Official Languages of India
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDropdownOpen(false)}
                title="Close language picker (Esc)"
                style={{
                  backgroundColor: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748B',
                  transition: 'background-color 0.15s ease',
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
                  color="#94A3B8"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search language or script..."
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 42px',
                    borderRadius: '14px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '14px',
                    backgroundColor: '#F8FAFC',
                    color: '#1E293B',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      color: '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Language List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '4px 14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {filteredLanguages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748B' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 600 }}>
                    No languages found
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                    No language matching &ldquo;{searchQuery}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      marginTop: '14px',
                      backgroundColor: '#F1F5F9',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0F766E',
                      cursor: 'pointer',
                    }}
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                filteredLanguages.map((item: IndianLanguage) => {
                  const isSelected = selectedCode === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => handleSelectLanguage(item.code)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: '14px',
                        border: isSelected ? '1.5px solid #0F766E' : '1px solid transparent',
                        backgroundColor: isSelected ? 'rgba(15, 118, 110, 0.08)' : '#FFFFFF',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s ease-in-out',
                        outline: 'none',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#F8FAFC';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#FFFFFF';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span
                          style={{
                            fontSize: '16px',
                            fontWeight: isSelected ? 800 : 700,
                            color: isSelected ? '#0F766E' : '#1E293B',
                          }}
                        >
                          {item.nativeName}
                        </span>
                        <span style={{ fontSize: '13px', color: '#64748B', marginTop: '1px' }}>
                          {item.englishName} · <span style={{ fontSize: '11px', color: '#94A3B8' }}>{item.script}</span>
                        </span>
                      </div>

                      {isSelected && (
                        <div
                          style={{
                            backgroundColor: '#0F766E',
                            color: '#FFFFFF',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
