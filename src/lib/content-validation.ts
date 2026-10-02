import type { Devotion } from '@/data/devotions';

export type EditionMetadata = { slug: string; title: string; theme: string; month: number; year: number };

export function isValidEditionMetadata(value: Partial<EditionMetadata> | null | undefined): value is EditionMetadata {
  return Boolean(value?.slug?.trim() && value?.title?.trim() && value?.theme?.trim() && typeof value.month === 'number' && Number.isInteger(value.month) && value.month >= 1 && value.month <= 12 && typeof value.year === 'number' && Number.isInteger(value.year) && value.year >= 2020);
}

export function validateDevotions(rows: Devotion[]): { valid: Devotion[]; invalidDays: number[] } {
  const seen = new Set<number>();
  const invalidDays: number[] = [];
  const valid = rows.filter((row) => {
    const invalid = !Number.isInteger(row.day) || row.day < 1 || row.day > 31 || seen.has(row.day) || !row.title?.trim() || !row.scripture?.trim() || !row.meditation?.trim();
    if (invalid) invalidDays.push(row.day);
    seen.add(row.day);
    return !invalid;
  });
  return { valid, invalidDays };
}

export function getPublishingIssues(edition: { title?: string | null; theme?: string | null; month?: number | null; year?: number | null }, rows: { day_number: number; title?: string | null; scripture_reference?: string | null; meditation?: string | null }[]) {
  const issues: string[] = [];
  if (!edition.title?.trim()) issues.push('Add an edition title.');
  if (!edition.theme?.trim()) issues.push('Add a monthly theme.');
  if (typeof edition.month !== 'number' || !Number.isInteger(edition.month) || edition.month < 1 || edition.month > 12) issues.push('Use a valid month.');
  if (typeof edition.year !== 'number' || !Number.isInteger(edition.year) || edition.year < 2020) issues.push('Use a valid year.');
  if (!rows.length) issues.push('Add at least one meditation.');
  const days = new Set<number>();
  rows.forEach((row) => {
    if (!Number.isInteger(row.day_number) || row.day_number < 1 || row.day_number > 31) issues.push(`Day ${row.day_number} is invalid.`);
    if (days.has(row.day_number)) issues.push(`Day ${row.day_number} is duplicated.`);
    days.add(row.day_number);
    if (!row.title?.trim() || !row.scripture_reference?.trim() || !row.meditation?.trim()) issues.push(`Day ${row.day_number} is missing required content.`);
  });
  return [...new Set(issues)];
}

export function getEditionCacheKey(language: 'en' | 'fr', editionSlug: string) {
  return `daily-dew-published-content-v2-${language}-${editionSlug}`;
}
