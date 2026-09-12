import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * The House filter is a portal-wide lens: choosing Lok Sabha or Rajya Sabha narrows
 * every figure on every page to members of that House. It is held here rather than in
 * each page's URL so the choice survives navigation, and mirrored to localStorage so
 * it survives a reload.
 *
 * The value is always one of three literals, so a tampered stored value cannot leak
 * into an API query string.
 */
export type House = 'both' | 'lok' | 'rajya';

const STORAGE_KEY = 'pramana.house';

export const HOUSES: { value: House; label: string; short: string }[] = [
  { value: 'both', label: 'Both Houses', short: 'Both' },
  { value: 'lok', label: 'Lok Sabha', short: 'Lok Sabha' },
  { value: 'rajya', label: 'Rajya Sabha', short: 'Rajya Sabha' },
];

type HouseValue = {
  house: House;
  setHouse: (h: House) => void;
  label: string;
  /** Appends the filter to a query string, omitting it when no narrowing applies. */
  param: (existing?: string) => string;
};

const HouseContext = createContext<HouseValue | null>(null);

function readStored(): House {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'lok' || stored === 'rajya' || stored === 'both') return stored;
  } catch { /* storage unavailable */ }
  return 'both';
}

export function HouseProvider({ children }: { children: ReactNode }) {
  const [house, setHouseState] = useState<House>(readStored);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, house); } catch { /* ignore */ }
  }, [house]);

  const value = useMemo<HouseValue>(() => ({
    house,
    setHouse: setHouseState,
    label: HOUSES.find((h) => h.value === house)?.label || 'Both Houses',
    param: (existing?: string) => {
      const qs = new URLSearchParams(existing || '');
      if (house === 'both') qs.delete('house');
      else qs.set('house', house);
      const out = qs.toString();
      return out ? `?${out}` : '';
    },
  }), [house]);

  return <HouseContext.Provider value={value}>{children}</HouseContext.Provider>;
}

export function useHouse() {
  const ctx = useContext(HouseContext);
  if (!ctx) throw new Error('useHouse must be used inside HouseProvider');
  return ctx;
}
