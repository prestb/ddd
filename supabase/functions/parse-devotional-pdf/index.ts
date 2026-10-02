// @ts-nocheck
import * as pdfjs from 'npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const DAY_RE = /^(?<weekday>[A-Za-zÀ-ÿ]+(?:day)?(?:\s*\([^)]+\))?)\s+(?<day>\d{1,2})(?:st|nd|rd|th|er)?$/i;
const TRANSLATION_TAG_RE = /\((?:KJV|NKJV|NIV|NLT|AMP|CEV|MSG|TPT|RSV|GNT|LSG|S21|BDS|NEG)\)/i;
const BIBLE_FULL_REF_RE = /((?:[1-3]\s*)?[A-ZÀ-ÿ][a-zà-ÿ]{2,15}\s+\d{1,3}[\s:]+\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*(?:\((?:KJV|NKJV|NIV|NLT|AMP|CEV|MSG|TPT|RSV|GNT|LSG|S21|BDS|NEG)\))?)/i;
const SECTION_RE = /^(Declaration|Wisdom Nugget|Further Studies|Prière|Prayer|Déclaration|Pensée de sagesse|Pensee de sagesse|Lectures complémentaires|Pour aller plus loin|Étude approfondie|Etude):?\s*$/i;

const join = (lines: string[]) => lines.join(' ').replace(/\s+/g, ' ').trim();

function parsePage(pageNumber: number, rawLines: string[]) {
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

  if (!headingMatch) return null;

  const dayNumber = Number(headingMatch.groups.day);
  const weekday = headingMatch.groups.weekday.trim();
  const title = headingIdx + 1 < lines.length ? lines[headingIdx + 1] : 'Daily Meditation';

  let cursor = headingIdx + 2;
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
      let rawName = secMatch[1].toLowerCase().replace(/\s+/g, '_');
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
    source_page: pageNumber,
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = request.headers.get('Authorization');
  let activeImportId: string | null = null;
  try {
    if (!authHeader) throw new Error('Sign in is required.');
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) throw new Error('Sign in is required.');
    const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !['admin', 'editor'].includes(profile.role)) throw new Error('Editor access is required.');

    const { importId } = await request.json();
    activeImportId = importId;
    if (!importId) throw new Error('Import id is required.');
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: job, error: jobError } = await admin
      .from('devotional_imports')
      .select('id, owner_id, storage_path, status')
      .eq('id', importId)
      .eq('owner_id', user.id)
      .single();
    if (jobError || !job) throw jobError ?? new Error('Import job not found.');
    if (job.status === 'processing') throw new Error('This import is already processing.');
    await admin.from('devotional_imports').update({ status: 'processing', error_message: null, updated_at: new Date().toISOString() }).eq('id', job.id);

    const { data: file, error: downloadError } = await admin.storage.from('devotional-imports').download(job.storage_path);
    if (downloadError || !file) throw downloadError ?? new Error('PDF could not be downloaded.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const document = await pdfjs.getDocument({ data: bytes, disableWorker: true, useSystemFonts: false }).promise;
    const days = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = content.items.map((item) => item.str ?? '');
      const parsed = parsePage(pageNumber, lines);
      if (parsed) days.push(parsed);
    }
    const reviewCount = days.filter((day) => day.needs_review).length;
    await admin
      .from('devotional_imports')
      .update({ status: 'review', extracted_data: { source_pages: document.numPages, days_found: days.length, review_count: reviewCount, days }, updated_at: new Date().toISOString() })
      .eq('id', job.id);
    return new Response(JSON.stringify({ importId: job.id, status: 'review', daysFound: days.length, reviewCount }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF extraction failed.';
    if (activeImportId) {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.from('devotional_imports').update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() }).eq('id', activeImportId);
    }
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
