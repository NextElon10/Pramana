/**
 * Languages PRAMANA ships with.
 *
 * Every listed language is genuinely translated in `strings.ts` — there are no
 * placeholder or machine-mangled entries. `font` names the Google Font that carries
 * the script; it is loaded on demand when the language is selected, so a user reading
 * English never downloads a Devanagari or Tamil face.
 */
export type LanguageCode =
  | 'en' | 'hi' | 'bn' | 'mr' | 'te' | 'ta'
  | 'gu' | 'kn' | 'ml' | 'pa' | 'or' | 'ur';

export type Language = {
  code: LanguageCode;
  /** Name in the language itself — how a speaker expects to see it listed. */
  native: string;
  /** English name, for the accessible label. */
  english: string;
  font?: string;
  dir?: 'ltr' | 'rtl';
};

export const LANGUAGES: Language[] = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', font: 'Noto Sans Devanagari' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali', font: 'Noto Sans Bengali' },
  { code: 'mr', native: 'मराठी', english: 'Marathi', font: 'Noto Sans Devanagari' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu', font: 'Noto Sans Telugu' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil', font: 'Noto Sans Tamil' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati', font: 'Noto Sans Gujarati' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada', font: 'Noto Sans Kannada' },
  { code: 'ml', native: 'മലയാളം', english: 'Malayalam', font: 'Noto Sans Malayalam' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi', font: 'Noto Sans Gurmukhi' },
  { code: 'or', native: 'ଓଡ଼ିଆ', english: 'Odia', font: 'Noto Sans Oriya' },
  { code: 'ur', native: 'اردو', english: 'Urdu', font: 'Noto Nastaliq Urdu', dir: 'rtl' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
