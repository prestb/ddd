import type { SupportedLanguage } from './localized-content';
import { FRENCH_JULY_SAMPLE } from './french-july-sample';
import { SHILOH_JULY_2026 } from './shiloh-july-2026';

export type Devotion = {
  day: number;
  weekday: string;
  title: string;
  scripture: string;
  preview: string;
  meditation: string;
  furtherStudies: string[];
  wisdom: string;
  declaration: string;
  isLocked?: boolean;
};

export const DAILY_DEVOTIONS = SHILOH_JULY_2026;

const FALLBACK_DEVOTION: Devotion = SHILOH_JULY_2026[0] ?? {
  day: 1,
  weekday: 'Day 1',
  title: 'Daily Meditation',
  scripture: 'Psalm 119:105',
  preview: 'Your word is a lamp to my feet and a light to my path.',
  meditation: 'Your word is a lamp to my feet and a light to my path.',
  furtherStudies: ['Psalm 119:105'],
  wisdom: 'Thy word is a lamp unto my feet.',
  declaration: "God's word guides my steps every day.",
};

export function localizeDevotion(base: Devotion | null | undefined, index: number, language: SupportedLanguage): Devotion {
  const safeBase = base ?? DAILY_DEVOTIONS[index] ?? DAILY_DEVOTIONS[0] ?? FALLBACK_DEVOTION;

  // Security Guard: If devotion is locked, preserve empty protected fields and only localize safe metadata
  if (safeBase.isLocked) {
    if (language === 'en') return safeBase;
    const translated = FRENCH_JULY_SAMPLE[index];
    if (!translated) return safeBase;
    return {
      ...safeBase,
      weekday: translated.weekday?.fr ?? safeBase.weekday,
      title: translated.title?.fr ?? safeBase.title,
      preview: '',
      meditation: '',
      wisdom: '',
      declaration: '',
      furtherStudies: [],
      isLocked: true,
    };
  }

  if (language === 'en') return safeBase;

  const translated = FRENCH_JULY_SAMPLE[index];
  if (!translated) return safeBase;

  return {
    ...safeBase,
    weekday: translated.weekday?.fr ?? safeBase.weekday,
    title: translated.title?.fr ?? safeBase.title,
    preview: translated.preview?.fr ?? safeBase.preview,
    meditation: translated.meditation?.fr ?? safeBase.meditation,
    wisdom: translated.wisdom?.fr ?? safeBase.wisdom,
    declaration: translated.declaration?.fr ?? safeBase.declaration,
  };
}

export function getLocalizedDevotion(index: number, language: SupportedLanguage): Devotion {
  return localizeDevotion(DAILY_DEVOTIONS[index], index, language);
}

export function getLocalizedDevotions(language: SupportedLanguage) {
  return DAILY_DEVOTIONS.map((_, index) => getLocalizedDevotion(index, language));
}
