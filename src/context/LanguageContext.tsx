import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { localStorageService } from '../services/localStorageService';
import { saveUserProfileBackend } from '../services/api';
import { getTranslation, TranslationDict } from '../data/translations';
import { SCHEDULED_INDIAN_LANGUAGES, IndianLanguage } from '../data/indianLanguages';
import { useAuth } from './AuthContext';

export interface LanguageContextType {
  lang: string;
  selectedLanguageCode: string;
  selectedLanguageMeta: IndianLanguage;
  switchLanguage: (code: string) => void;
  t: TranslationDict;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updateUserLanguage } = useAuth();

  // Initialize from user preference or local storage or default 'en'
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>(() => {
    const stored = localStorageService.getPreferredLanguage();
    if (stored) return stored;
    const userLang = user?.preferredLanguage || user?.language;
    if (userLang) return userLang;
    return 'en';
  });

  // Sync if user preference in AuthContext updates
  useEffect(() => {
    const userLang = user?.preferredLanguage || user?.language;
    if (userLang && userLang !== selectedLanguageCode) {
      setSelectedLanguageCode(userLang);
      localStorageService.savePreferredLanguage(userLang);
    }
  }, [user?.preferredLanguage, user?.language]);

  // Persist locally
  useEffect(() => {
    if (selectedLanguageCode) {
      localStorageService.savePreferredLanguage(selectedLanguageCode);
      const isRTL = ['ur', 'ks', 'sd'].includes(selectedLanguageCode);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = selectedLanguageCode;
        document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      }
    }
  }, [selectedLanguageCode]);

  const switchLanguage = (newLang: string) => {
    const normalized = newLang ? newLang.trim().toLowerCase() : 'en';
    setSelectedLanguageCode(normalized);
    localStorageService.savePreferredLanguage(normalized);
    localStorage.setItem('gramcare_language_selected', 'true');
    
    // Update HTML attributes immediately
    const isRTL = ['ur', 'ks', 'sd'].includes(normalized);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = normalized;
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    }

    if (user) {
      updateUserLanguage(normalized).catch(() => {});
    } else {
      saveUserProfileBackend({ preferredLanguage: normalized }).catch(() => {});
    }
  };

  const selectedLanguageMeta = useMemo(() => {
    return (
      SCHEDULED_INDIAN_LANGUAGES.find(l => l.code === selectedLanguageCode) ||
      SCHEDULED_INDIAN_LANGUAGES[0]
    );
  }, [selectedLanguageCode]);

  // Reactive translation dictionary with seamless English fallback for all keys
  const t = useMemo(() => {
    return getTranslation(selectedLanguageCode);
  }, [selectedLanguageCode]);

  const isRTL = useMemo(() => {
    return ['ur', 'ks', 'sd'].includes(selectedLanguageCode);
  }, [selectedLanguageCode]);

  return (
    <LanguageContext.Provider
      value={{
        lang: selectedLanguageCode,
        selectedLanguageCode,
        selectedLanguageMeta,
        switchLanguage,
        t,
        isRTL
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
