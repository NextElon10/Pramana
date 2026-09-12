import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LANGUAGES, DEFAULT_LANGUAGE, type Language, type LanguageCode } from './languages';
import { STRINGS, EN, type StringKey } from './strings';

const STORAGE_KEY = 'pramana.language';

type I18nValue = {
  lang: LanguageCode;
  language: Language;
  setLang: (code: LanguageCode) => void;
  t: (key: StringKey) => string;
  languages: Language[];
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Loads the Google Font that carries a script, once, only when that language is
 * chosen. A reader using English never downloads a Devanagari or Tamil face, and if
 * the network is unavailable the CSS font stack falls back to the system UI font.
 */
function ensureScriptFont(language: Language) {
  if (!language.font || typeof document === 'undefined') return;
  const id = `font-${language.code}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  // Non-blocking: the script renders in the fallback face until the font arrives,
  // and simply stays in the fallback if the network is unavailable.
  link.media = 'print';
  link.onload = () => { link.media = 'all'; };
  link.href = `https://fonts.googleapis.com/css2?family=${language.font.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

function readStored(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch { /* storage unavailable — fall through to default */ }
  return DEFAULT_LANGUAGE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(readStored);

  const language = useMemo(
    () => LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0],
    [lang],
  );

  useEffect(() => {
    ensureScriptFont(language);
    const root = document.documentElement;
    root.lang = language.code;
    root.dir = language.dir || 'ltr';
    // Scripts get their own face in front of the stack. For Latin the property is
    // REMOVED rather than set to an empty string: an empty value makes the whole
    // font-family declaration invalid, which silently drops the page to a serif
    // default. Removing it lets the var() fallback in the Tailwind stack apply.
    if (language.font) {
      root.style.setProperty('--script-font', `"${language.font}"`);
    } else {
      root.style.removeProperty('--script-font');
    }
    try { localStorage.setItem(STORAGE_KEY, language.code); } catch { /* ignore */ }
  }, [language]);

  const value = useMemo<I18nValue>(() => ({
    lang,
    language,
    setLang: setLangState,
    languages: LANGUAGES,
    // Missing keys fall back to English rather than rendering an empty label.
    t: (key: StringKey) => STRINGS[lang]?.[key] ?? EN[key] ?? key,
  }), [lang, language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export type { LanguageCode, StringKey };
