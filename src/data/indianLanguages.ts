export interface IndianLanguage {
  code: string;
  nativeName: string;
  englishName: string;
  script: string;
}

export const SCHEDULED_INDIAN_LANGUAGES: IndianLanguage[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', script: 'Latin' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', script: 'Devanagari' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', script: 'Telugu' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', script: 'Tamil' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada', script: 'Kannada' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam', script: 'Malayalam' },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi', script: 'Devanagari' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', script: 'Bengali' },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati', script: 'Gujarati' },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', script: 'Gurmukhi' },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ', englishName: 'Odia', script: 'Odia' },
  { code: 'as', nativeName: 'অসমীয়া', englishName: 'Assamese', script: 'Bengali-Assamese' },
  { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', script: 'Arabic-Persian' },
  { code: 'sa', nativeName: 'संस्कृतम्', englishName: 'Sanskrit', script: 'Devanagari' },
  { code: 'ne', nativeName: 'नेपाली', englishName: 'Nepali', script: 'Devanagari' },
  { code: 'kok', nativeName: 'कोंकणी', englishName: 'Konkani', script: 'Devanagari' },
  { code: 'mai', nativeName: 'मैथिली', englishName: 'Maithili', script: 'Devanagari' },
  { code: 'doi', nativeName: 'डोगरी', englishName: 'Dogri', script: 'Devanagari' },
  { code: 'ks', nativeName: 'کٲشُر', englishName: 'Kashmiri', script: 'Arabic-Persian' },
  { code: 'sat', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', englishName: 'Santali', script: 'Ol Chiki' },
  { code: 'mni', nativeName: 'मणिपुरी', englishName: 'Manipuri', script: 'Meitei Mayek' },
  { code: 'brx', nativeName: 'बड़ो', englishName: 'Bodo', script: 'Devanagari' },
  { code: 'sd', nativeName: 'سنڌي / सिन्धी', englishName: 'Sindhi', script: 'Arabic-Persian / Devanagari' }
];
