import { useAppStore } from '../store/appStore';
import { vi } from './vi';
import { en } from './en';

export type Language = 'vi' | 'en';
export type Translations = typeof vi;

const translations: Record<Language, Translations> = { vi, en };

export function useT(): Translations {
  const language = useAppStore((s) => s.language);
  return translations[language];
}
