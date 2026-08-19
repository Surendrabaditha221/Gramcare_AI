import React, { useState } from 'react';
import { Languages, Check, ArrowRight, Search } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { SCHEDULED_INDIAN_LANGUAGES, IndianLanguage } from '../data/indianLanguages';
import { PrimaryButton } from '../components/Common/PrimaryButton';

import { useAuth } from '../context/AuthContext';

interface LanguageScreenProps {
  onNext: () => void;
}

export const LanguageScreen: React.FC<LanguageScreenProps> = ({ onNext }) => {
  const { lang, switchLanguage, t } = useLanguage();
  const { updateUserLanguage } = useAuth();
  const [selectedCode, setSelectedCode] = useState<string>(lang || '');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLanguages = SCHEDULED_INDIAN_LANGUAGES.filter(item => {
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
  };

  const handleContinue = () => {
    if (selectedCode) {
      switchLanguage(selectedCode);
      updateUserLanguage(selectedCode).catch(() => {});
    }
    onNext();
  };

  return (
    <div style={{
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '88vh',
      justifyContent: 'space-between',
      maxWidth: '640px',
      margin: '0 auto',
      width: '100%'
    }}>
      <div>
        <div style={{
          backgroundColor: '#f0fdf4',
          borderRadius: '50%',
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <Languages size={32} color="#0f766e" />
        </div>

        <h2 style={{ fontSize: '24px', color: '#0f766e', margin: '0 0 4px 0' }}>
          Choose Your Language
        </h2>
        <p style={{ fontSize: '18px', color: '#0f766e', fontWeight: 600, margin: '0 0 8px 0' }}>
          మీ భాషను ఎంచుకోండి
        </p>

        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
          Select from the 22 scheduled official languages of India for health guidance.
        </p>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search languages / భాషల వెతుకులాట..."
            style={{
              width: '100%',
              padding: '12px 14px 12px 42px',
              borderRadius: '12px',
              border: '1.5px solid #cbd5e1',
              fontSize: '15px',
              backgroundColor: '#ffffff',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* 22 Languages List Container */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxHeight: '44vh',
          overflowY: 'auto',
          paddingRight: '4px',
          marginBottom: '16px'
        }}>
          {filteredLanguages.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', padding: '20px' }}>
              No matching languages found.
            </p>
          ) : (
            filteredLanguages.map((item: IndianLanguage) => {
              const isSelected = selectedCode === item.code;
              return (
                <div
                  key={item.code}
                  onClick={() => handleSelectLanguage(item.code)}
                  style={{
                    border: isSelected ? '2px solid #0f766e' : '1px solid #e2e8f0',
                    backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                    borderRadius: '14px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 4px 12px rgba(15, 118, 110, 0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s ease-in-out'
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', color: '#1e293b', fontWeight: 700 }}>
                      {item.nativeName}
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                      {item.englishName} ({item.script})
                    </p>
                  </div>
                  {isSelected && (
                    <div style={{ backgroundColor: '#0f766e', color: '#ffffff', borderRadius: '50%', padding: '5px', display: 'flex' }}>
                      <Check size={16} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <PrimaryButton
        onClick={handleContinue}
        disabled={!selectedCode}
        style={{
          fontSize: '17px',
          padding: '16px',
          borderRadius: '14px',
          opacity: selectedCode ? 1 : 0.6,
          cursor: selectedCode ? 'pointer' : 'not-allowed'
        }}
      >
        <span>{t.continueBtn || 'Continue'}</span>
        <ArrowRight size={20} />
      </PrimaryButton>
    </div>
  );
};
