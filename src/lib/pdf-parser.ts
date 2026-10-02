export type ParsedDayResult = {
  day_number: number;
  weekday: string;
  title: string;
  scripture_reference: string;
  scripture_text: string;
  meditation: string;
  declaration: string;
  wisdom_nugget: string;
  further_studies: string[];
  needs_review: boolean;
};

const DAY_RE = /^(?<weekday>[A-Za-zÀ-ÿ]+(?:day)?(?:\s*\([^)]+\))?)\s+(?<day>\d{1,2})(?:st|nd|rd|th|er)?$/i;
const TRANSLATION_TAG_RE = /\((?:KJV|NKJV|NIV|NLT|AMP|CEV|MSG|TPT|RSV|GNT|LSG|S21|BDS|NEG)\)/i;
const BIBLE_FULL_REF_RE = /((?:[1-3]\s*)?[A-ZÀ-ÿ][a-zà-ÿ]{2,15}\s+\d{1,3}[\s:]+\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*(?:\((?:KJV|NKJV|NIV|NLT|AMP|CEV|MSG|TPT|RSV|GNT|LSG|S21|BDS|NEG)\))?)/i;
const SECTION_RE = /^(Declaration|Wisdom Nugget|Further Studies|Prière|Prayer|Déclaration|Pensée de sagesse|Pensee de sagesse|Lectures complémentaires|Pour aller plus loin|Étude approfondie|Etude):?\s*$/i;

const join = (lines: string[]) => lines.join(' ').replace(/\s+/g, ' ').trim();

export function smartParseDevotionalText(rawTextOrLines: string | string[]): ParsedDayResult | null {
  const rawLines = typeof rawTextOrLines === 'string' ? rawTextOrLines.split('\n') : rawTextOrLines;

  const lines = rawLines
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !/^(?:DAILY DEW|DEVOTIONAL|SHILOH|PAGE \d+|\d{1,3})$/i.test(line));

  if (!lines.length) return null;

  let headingMatch: RegExpMatchArray | null = null;
  let headingIdx = -1;

  for (let idx = 0; idx < Math.min(lines.length, 5); idx++) {
    const m = lines[idx].match(DAY_RE);
    if (m && m.groups?.day) {
      headingMatch = m;
      headingIdx = idx;
      break;
    }
  }

  const dayNumber = headingMatch?.groups?.day ? Number(headingMatch.groups.day) : 1;
  const weekday = headingMatch?.groups?.weekday ? headingMatch.groups.weekday.trim() : 'Daily';
  const title = headingIdx >= 0 && headingIdx + 1 < lines.length ? lines[headingIdx + 1] : lines[0] ?? 'Daily Meditation';

  let cursor = headingIdx >= 0 ? headingIdx + 2 : 1;
  const scriptureLines: string[] = [];

  while (cursor < lines.length) {
    const line = lines[cursor];
    if (SECTION_RE.test(line)) break;
    scriptureLines.push(line);
    cursor++;
    if (TRANSLATION_TAG_RE.test(line)) break;
  }

  const scriptureText = join(scriptureLines);
  const refMatch = scriptureText.match(BIBLE_FULL_REF_RE);
  const scriptureRef = refMatch ? refMatch[0] : '';

  const sections: Record<string, string[]> = {
    meditation: [],
    declaration: [],
    wisdom_nugget: [],
    further_studies: [],
  };

  let currentSec = 'meditation';

  while (cursor < lines.length) {
    const line = lines[cursor];
    const secMatch = line.match(SECTION_RE);
    if (secMatch) {
      const rawName = secMatch[1].toLowerCase().replace(/\s+/g, '_');
      if (rawName.includes('declaration') || rawName.includes('déclaration')) currentSec = 'declaration';
      else if (rawName.includes('wisdom') || rawName.includes('sagesse')) currentSec = 'wisdom_nugget';
      else if (rawName.includes('further') || rawName.includes('étude') || rawName.includes('etude') || rawName.includes('lectures')) currentSec = 'further_studies';
      else currentSec = 'meditation';
      cursor++;
      continue;
    }

    sections[currentSec].push(line);
    cursor++;
  }

  const meditation = join(sections.meditation);
  const declaration = join(sections.declaration);
  const wisdom = join(sections.wisdom_nugget);
  const furtherRaw = join(sections.further_studies);
  const furtherStudiesList = furtherRaw
    .split(/[,;]/)
    .map((item) => item.replace(/^[.\s]+|[.\s]+$/g, '').trim())
    .filter(Boolean);

  return {
    day_number: dayNumber,
    weekday,
    title,
    scripture_reference: scriptureRef,
    scripture_text: scriptureText,
    meditation,
    declaration,
    wisdom_nugget: wisdom,
    further_studies: furtherStudiesList,
    needs_review: !scriptureRef || !meditation || !declaration,
  };
}

export function sanitizeAndRepairExtractedDay(day: any): ParsedDayResult {
  // If the extracted day has meditation buried inside scripture_text or vice-versa, re-parse it!
  const combinedText = [
    `${day.weekday ?? 'Daily'} ${day.day_number ?? 1}`,
    day.title ?? '',
    day.scripture_text ?? '',
    day.meditation ?? '',
    day.declaration ? `Declaration:\n${day.declaration}` : '',
    day.wisdom_nugget ? `Wisdom Nugget:\n${day.wisdom_nugget}` : '',
    day.further_studies ? `Further Studies:\n${Array.isArray(day.further_studies) ? day.further_studies.join(', ') : day.further_studies}` : '',
  ].filter(Boolean).join('\n');

  const reParsed = smartParseDevotionalText(combinedText);
  if (reParsed && reParsed.meditation && reParsed.declaration) {
    return reParsed;
  }

  return {
    day_number: Number(day.day_number ?? 1),
    weekday: String(day.weekday ?? 'Daily'),
    title: String(day.title ?? 'Daily Meditation'),
    scripture_reference: String(day.scripture_reference ?? ''),
    scripture_text: String(day.scripture_text ?? ''),
    meditation: String(day.meditation ?? ''),
    declaration: String(day.declaration ?? ''),
    wisdom_nugget: String(day.wisdom_nugget ?? ''),
    further_studies: Array.isArray(day.further_studies) ? day.further_studies : [],
    needs_review: Boolean(day.needs_review),
  };
}
