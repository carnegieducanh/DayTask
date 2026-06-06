import { vi as viT } from '../i18n/vi';
import { en as enT } from '../i18n/en';

export type Period = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

export interface GreetingItem {
  id: string;
  vi: string;
  en: string;
  isFixed?: boolean;
}

export type GreetingsStore = Record<Period, GreetingItem[]>;

const KEY = 'atomic_greetings_v2';

const PERIOD_SEEDS: Record<Period, { vi: { fixed: string; random: string[] }; en: { fixed: string; random: string[] } }> = {
  morning:   { vi: viT.greeting.morning,   en: enT.greeting.morning },
  noon:      { vi: viT.greeting.noon,      en: enT.greeting.noon },
  afternoon: { vi: viT.greeting.afternoon, en: enT.greeting.afternoon },
  evening:   { vi: viT.greeting.evening,   en: enT.greeting.evening },
  night:     { vi: viT.greeting.night,     en: enT.greeting.night },
};

function buildDefaults(): GreetingsStore {
  const store = {} as GreetingsStore;
  for (const period of Object.keys(PERIOD_SEEDS) as Period[]) {
    const seed = PERIOD_SEEDS[period];
    store[period] = [
      { id: `seed-${period}-fixed`, vi: seed.vi.fixed, en: seed.en.fixed, isFixed: true },
      ...seed.vi.random.map((v, i) => ({
        id: `seed-${period}-${i}`,
        vi: v,
        en: seed.en.random[i] ?? '',
      })),
    ];
  }
  return store;
}

export function loadGreetings(): GreetingsStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as GreetingsStore;
  } catch { /* ignore */ }
  const defaults = buildDefaults();
  localStorage.setItem(KEY, JSON.stringify(defaults));
  return defaults;
}

export function saveGreetings(store: GreetingsStore): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function resetGreetings(): GreetingsStore {
  const defaults = buildDefaults();
  localStorage.setItem(KEY, JSON.stringify(defaults));
  return defaults;
}
