import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { type Devotion } from '@/data/devotions';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/context/settings-context';
import { useAuth } from '@/context/auth-context';
import { getEditionCacheKey, isValidEditionMetadata, validateDevotions } from '@/lib/content-validation';

type EditionMeta = {
  slug: string;
  title: string;
  theme: string;
  introduction: string;
  month: number;
  year: number;
  access_level?: 'free' | 'premium';
  isLocked?: boolean;
};

type ContentContextValue = {
  devotions: Devotion[];
  edition: EditionMeta | null;
  source: 'offline' | 'cloud';
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const ContentContext = createContext<ContentContextValue | null>(null);
const contentCacheKey = (language: 'en' | 'fr', slug = 'fallback') => getEditionCacheKey(language, slug);
const latestCacheKey = (language: 'en' | 'fr') => `daily-dew-latest-content-v2-${language}`;

export function ContentProvider({ children }: PropsWithChildren) {
  const { language } = useSettings();
  const { session } = useAuth();
  const [devotions, setDevotions] = useState<Devotion[]>([]);
  const [edition, setEdition] = useState<ContentContextValue['edition']>(null);
  const [source, setSource] = useState<'offline' | 'cloud'>('offline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // 1. Instant Cache Hydration on Mount, Language Switch, or Account Session Change
  useEffect(() => {
    let active = true;
    async function hydrateCache() {
      try {
        const cachedRaw = await AsyncStorage.getItem(latestCacheKey(language));
        if (cachedRaw && active) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed?.edition && Array.isArray(parsed?.devotions) && parsed.devotions.length > 0) {
            const isPremiumEdition = parsed.edition.access_level === 'premium';
            const currentUserId = session?.user?.id ?? null;
            const cachedUserId = parsed?.cachedUserId ?? null;
            const isOwnerMatch = Boolean(currentUserId && cachedUserId && currentUserId === cachedUserId);

            // ACCOUNT ISOLATION GUARD:
            // If cached edition is premium AND (user is signed out OR active session user ID does NOT match cached user ID)
            if (isPremiumEdition && (!session || !isOwnerMatch)) {
              setEdition({ ...parsed.edition, isLocked: true });
              // Strip ALL protected premium body fields from active memory
              setDevotions(
                parsed.devotions.map((d: Devotion) => ({
                  ...d,
                  meditation: '',
                  preview: '',
                  wisdom: '',
                  declaration: '',
                  furtherStudies: [],
                }))
              );
            } else {
              setEdition(parsed.edition);
              setDevotions(parsed.devotions);
            }
            setSource('offline');
            setLoading(false);
          }
        }
      } catch {
        // Fallback silently if cache is unreadable
      }
    }
    hydrateCache();
    return () => { active = false; };
  }, [language, session]);

  // 2. Fetch Latest Published Content from Supabase (Silent Sync & RLS Enforced)
  useEffect(() => {
    let cancelled = false;

    async function loadPublishedContent() {
      const client = supabase;
      if (!client) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const { data: publishedEdition, error: editionError } = await client
          .from('editions')
          .select('id, slug, title, theme, introduction, month, year, access_level')
          .eq('status', 'published')
          .eq('language', language)
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .limit(1)
          .maybeSingle();

        let selectedEdition = publishedEdition;
        if (!selectedEdition && language !== 'en' && !editionError) {
          const fallback = await client
            .from('editions')
            .select('id, slug, title, theme, introduction, month, year, language, access_level')
            .eq('status', 'published')
            .eq('language', 'en')
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(1)
            .maybeSingle();
          selectedEdition = fallback.data;
        }

        if (editionError || !selectedEdition) {
          if (cancelled) return;
          // Keep cached data intact if available; only show error if no cached content exists
          setSource('offline');
          setLoading(false);
          return;
        }

        const { data: rows, error: devotionError } = await client
          .from('devotions')
          .select('day_number, weekday, title, scripture_reference, meditation, further_studies, wisdom_nugget, declaration')
          .eq('edition_id', selectedEdition.id)
          .order('day_number', { ascending: true });

        if (devotionError) {
          if (cancelled) return;
          setSource('offline');
          setLoading(false);
          return;
        }

        if (rows && rows.length > 0 && !cancelled) {
          const nextDevotions = rows.map((row) => ({
            day: row.day_number,
            weekday: row.weekday,
            title: row.title,
            scripture: row.scripture_reference,
            preview: row.meditation.slice(0, 220),
            meditation: row.meditation,
            furtherStudies: Array.isArray(row.further_studies) ? row.further_studies : [],
            wisdom: row.wisdom_nugget ?? '',
            declaration: row.declaration ?? '',
          }));

          const metadata = { slug: selectedEdition.slug, title: selectedEdition.title, theme: selectedEdition.theme, month: selectedEdition.month, year: selectedEdition.year };
          const checked = validateDevotions(nextDevotions);

          if (isValidEditionMetadata(metadata) && checked.valid.length > 0) {
            const cachedEdition: EditionMeta = {
              slug: selectedEdition.slug,
              title: selectedEdition.title,
              theme: selectedEdition.theme,
              introduction: selectedEdition.introduction ?? '',
              month: selectedEdition.month,
              year: selectedEdition.year,
              access_level: selectedEdition.access_level ?? 'free',
              isLocked: selectedEdition.access_level === 'premium',
            };

            setDevotions(checked.valid);
            setEdition(cachedEdition);
            setSource('cloud');
            setError(null);

            const cachePayload = JSON.stringify({
              edition: cachedEdition,
              devotions: checked.valid,
              cachedUserId: session?.user?.id ?? null,
            });

            AsyncStorage.multiSet([
              [contentCacheKey(language, selectedEdition.slug), JSON.stringify(checked.valid)],
              [latestCacheKey(language), cachePayload],
            ]).catch(() => undefined);
          }
        }
      } catch {
        // Network/offline exception: silently retain cached state
        if (!cancelled) {
          setSource('offline');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPublishedContent();

    return () => { cancelled = true; };
  }, [language, reloadToken, session]);

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);
  const value = useMemo(() => ({ devotions, edition, source, loading, error, refresh }), [devotions, edition, source, loading, error, refresh]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) throw new Error('useContent must be used inside ContentProvider');
  return context;
}
