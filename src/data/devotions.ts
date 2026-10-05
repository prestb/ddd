import type { SupportedLanguage } from './localized-content';
import { SHILOH_JULY_2026 } from './shiloh-july-2026';

export type Devotion = {
  day: number;
  weekday: string;
  title: string;
  scripture: string;
  scriptureText?: string;
  preview: string;
  meditation: string;
  furtherStudies: string[];
  wisdom: string;
  declaration: string;
  isLocked?: boolean;
};

export const DAILY_DEVOTIONS = SHILOH_JULY_2026;

export function localizeDevotion(base: Devotion | null | undefined, _index: number, _language: SupportedLanguage): Devotion | null {
  if (!base) return null;

  // Security Guard: If devotion is locked, preserve empty protected fields
  if (base.isLocked) {
    return {
      ...base,
      preview: '',
      meditation: '',
      wisdom: '',
      declaration: '',
      furtherStudies: [],
      isLocked: true,
    };
  }

  return base;
}

export function getLocalizedDevotion(index: number, language: SupportedLanguage): Devotion | null {
  return localizeDevotion(DAILY_DEVOTIONS[index], index, language);
}

export function getLocalizedDevotions(language: SupportedLanguage): Devotion[] {
  return DAILY_DEVOTIONS.map((d: Devotion, index: number) => localizeDevotion(d, index, language)).filter(Boolean) as Devotion[];
}
