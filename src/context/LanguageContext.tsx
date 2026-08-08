import React, { createContext, useContext, useState, useEffect } from 'react';
import { localStorageService } from '../services/localStorageService';
import { saveUserProfileBackend } from '../services/api';
import { TRANSLATIONS, TranslationDict } from '../data/translations';
import { SCHEDULED_INDIAN_LANGUAGES, IndianLanguage } from '../data/indianLanguages';

interface LanguageContextType {
  lang: 'en' | 'te';
  selectedLanguageCode: string;
  selectedLanguageMeta: IndianLanguage;
  switchLanguage: (code: string) => void;
  t: TranslationDict;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>(() =>
    localStorageService.getPreferredLanguage()
  );

  useEffect(() => {
    localStorageService.savePreferredLanguage(selectedLanguageCode);
  }, [selectedLanguageCode]);

  const switchLanguage = (newLang: string) => {
    setSelectedLanguageCode(newLang);
    localStorageService.savePreferredLanguage(newLang);
    saveUserProfileBackend({ preferredLanguage: newLang }).catch(() => {});
  };

  const lang: 'en' | 'te' = selectedLanguageCode === 'te' ? 'te' : 'en';
  const t: TranslationDict = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const selectedLanguageMeta =
    SCHEDULED_INDIAN_LANGUAGES.find(l => l.code === selectedLanguageCode) ||
    SCHEDULED_INDIAN_LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        lang,
        selectedLanguageCode,
        selectedLanguageMeta,
        switchLanguage,
        t
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
