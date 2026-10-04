import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

import { type Devotion } from '@/data/devotions';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/context/settings-context';
import { useAuth } from '@/context/auth-context';
import { getEditionCacheKey, validateDevotions } from '@/lib/content-validation';

export type NetworkStatus = 'online' | 'offline' | 'unknown';
export type ContentSource = 'cloud' | 'cache' | 'none';

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
  source: ContentSource;
  networkStatus: NetworkStatus;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const ContentContext = createContext<ContentContextValue | null>(null);
const contentCacheKey = (language: 'en' | 'fr', slug = 'fallback') => getEditionCacheKey(language, slug);
const latestCacheKey = (language: 'en' | 'fr', userId: string | null = null) => `daily-dew-latest-content-v4-${language}-${userId ?? 'anonymous'}`;

export function ContentProvider({ children }: PropsWithChildren) {
  const { language } = useSettings();
  const { session } = useAuth();
  const [devotions, setDevotions] = useState<Devotion[]>([]);
  const [edition, setEdition] = useState<ContentContextValue['edition']>(null);
  const [source, setSource] = useState<ContentSource>('none');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('unknown');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // In-Memory Content Owner State (Identifies which account identity owns the loaded content)
  const [contentOwnerId, setContentOwnerId] = useState<string | null>(null);

  // Authoritative cloud content lock ref to prevent stale cache overwrites
  const isCloudLoadedRef = useRef(false);

  // Immediately invalidate in-memory content when account session changes
  useEffect(() => {
    setDevotions([]);
    setEdition(null);
    setSource('none');
    setError(null);
    setLoading(true);
    setContentOwnerId(null);
    isCloudLoadedRef.current = false;
  }, [session?.user?.id]);

  useEffect(() => {
    isCloudLoadedRef.current = false;
  }, [language, reloadToken, session]);

  // Native NetInfo Connectivity Listener
  useEffect(() => {
    let active = true;
    let latestEventVersion = 0;

    const applyNetworkState = (state: NetInfoState) => {
      if (state.isConnected === true) {
        setNetworkStatus('online');
      } else if (state.isConnected === false) {
        setNetworkStatus('offline');
      } else {
        setNetworkStatus('unknown');
      }
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      latestEventVersion += 1;
      applyNetworkState(state);
    });

    const fetchVersion = latestEventVersion;

    NetInfo.fetch()
      .then((state) => {
        if (active && latestEventVersion === fetchVersion) {
          applyNetworkState(state);
        }
      })
      .catch(() => {
        if (active && latestEventVersion === fetchVersion) {
          setNetworkStatus('unknown');
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // 1. Account-Isolated Cache Hydration on Mount, Language Switch, or Account Session Change
  useEffect(() => {
    let active = true;
    async function hydrateCache() {
      try {
        const currentUserId = session?.user?.id ?? null;
        const cachedRaw = await AsyncStorage.getItem(latestCacheKey(language, currentUserId));
        if (cachedRaw && active && !isCloudLoadedRef.current) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed?.edition && Array.isArray(parsed?.devotions) && parsed.devotions.length > 0) {
            // Guard: Do not overwrite if authoritative cloud content has already committed
            if (isCloudLoadedRef.current || !active) return;

            const isPremiumEdition = parsed.edition.access_level === 'premium';
            const cachedUserId = parsed?.cachedUserId ?? null;
            const isOwnerMatch = Boolean(currentUserId && cachedUserId && currentUserId === cachedUserId);

            // Verify active subscription status & admin/editor role if session exists
            let isUserSubscribed = false;
            let isAdminOrEditor = false;

            if (supabase && session && currentUserId && isOwnerMatch) {
              const [{ data: subData }, { data: profileData }] = await Promise.all([
                supabase
                  .from('subscriptions')
                  .select('status, expires_at')
                  .eq('user_id', currentUserId)
                  .maybeSingle(),
                supabase
                  .from('profiles')
                  .select('role')
                  .eq('id', currentUserId)
                  .maybeSingle(),
              ]);

              if (subData?.status === 'active' && subData?.expires_at && new Date(subData.expires_at) > new Date()) {
                isUserSubscribed = true;
              }

              if (profileData?.role === 'admin' || profileData?.role === 'editor') {
                isAdminOrEditor = true;
              }
            }

            // Guard check again after async subscription lookups
            if (isCloudLoadedRef.current || !active) return;

            // 1. Evaluate full content access (Subscriber OR Admin OR Editor)
            const hasFullAccess = isUserSubscribed || isAdminOrEditor;

            // 2. Determine if sanitization is needed for Free / non-entitled or mismatched users
            const isOwnerMismatch = Boolean(cachedUserId && (!session || !isOwnerMatch));

            setContentOwnerId(currentUserId);

            if (!hasFullAccess) {
              // Free / Non-Entitled User
              const isEditionLocked = isPremiumEdition || isOwnerMismatch;
              setEdition({
                ...parsed.edition,
                isLocked: isEditionLocked,
              });
              setDevotions(
                parsed.devotions.map((d: Devotion) => {
                  const shouldLock = d.day > 3 || isEditionLocked;
                  return shouldLock
                    ? {
                        ...d,
                        meditation: '',
                        preview: '',
                        wisdom: '',
                        declaration: '',
                        furtherStudies: [],
                        isLocked: true,
                      }
                    : {
                        ...d,
                        isLocked: false,
                      };
                })
              );
            } else {
              // Active Verified Subscriber (Has Full Access)
              setEdition({
                ...parsed.edition,
                isLocked: false,
              });
              setDevotions(
                parsed.devotions.map((d: Devotion) => ({
                  ...d,
                  isLocked: false,
                }))
              );
            }
            setSource((prev) => (prev === 'cloud' ? 'cloud' : 'cache'));
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

  // 2. Fetch Latest Published Content from Supabase (Server-Enforced Day-Level & Edition-Level Gating via RPC)
  useEffect(() => {
    let cancelled = false;

    async function loadPublishedContent() {
      const client = supabase;
      if (!client) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        // Authoritative server-enforced day-level RPC
        const { data: rpcRows, error: rpcError } = await client.rpc('get_published_edition_devotions', {
          p_language: language,
        });

        if (!rpcError && Array.isArray(rpcRows) && rpcRows.length > 0 && !cancelled) {
          const first = rpcRows[0];
          const fetchedEdition: EditionMeta = {
            slug: first.edition_slug,
            title: first.edition_title,
            theme: first.edition_theme,
            introduction: first.edition_introduction ?? '',
            month: first.edition_month,
            year: first.edition_year,
            access_level: first.edition_access_level ?? 'free',
            isLocked: first.edition_access_level === 'premium' && Boolean(first.is_locked),
          };

          const nextDevotions: Devotion[] = rpcRows.map((row) => ({
            day: row.day_number,
            weekday: row.weekday,
            title: row.title,
            scripture: row.scripture_reference,
            preview: row.meditation ? row.meditation.slice(0, 220) : '',
            meditation: row.meditation ?? '',
            furtherStudies: Array.isArray(row.further_studies) ? row.further_studies : [],
            wisdom: row.wisdom_nugget ?? '',
            declaration: row.declaration ?? '',
            isLocked: Boolean(row.is_locked),
          }));

          const checked = validateDevotions(nextDevotions);
          if (checked.valid.length > 0) {
            isCloudLoadedRef.current = true; // Mark Cloud Content as Authoritatively Committed
            const currentUserId = session?.user?.id ?? null;
            setContentOwnerId(currentUserId);
            setDevotions(checked.valid);
            setEdition(fetchedEdition);
            setSource('cloud');
            setNetworkStatus('online');
            setError(null);

            const hasFullPremiumAccess = checked.valid.every((d) => !d.isLocked);
            const cachePayload = JSON.stringify({
              edition: fetchedEdition,
              devotions: checked.valid,
              cachedUserId: currentUserId,
              cachedUserEntitlement: hasFullPremiumAccess ? 'premium' : 'free',
            });

            AsyncStorage.multiSet([
              [contentCacheKey(language, fetchedEdition.slug), JSON.stringify(checked.valid)],
              [latestCacheKey(language, currentUserId), cachePayload],
            ]).catch(() => undefined);
            return;
          }
        }

        // If RPC is unavailable or returns an error, retain valid cached data
        if (!cancelled) {
          const isOfflineError = Boolean(
            rpcError?.message?.toLowerCase().includes('network') ||
            rpcError?.message?.toLowerCase().includes('fetch')
          );

          if (isOfflineError) {
            setNetworkStatus('offline');
          }

          setDevotions((prev) => {
            if (prev.length > 0) {
              setSource('cache');
              setError(
                rpcError?.message ||
                (language === 'fr'
                  ? 'Impossible de synchroniser avec le serveur. Affichage du contenu enregistré.'
                  : 'Unable to sync with cloud. Showing saved content.')
              );
            } else {
              setSource('none');
              setError(rpcError?.message || 'Content unavailable.');
            }
            return prev;
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          const isOfflineError = Boolean(
            err instanceof TypeError ||
            err?.message?.toLowerCase().includes('network') ||
            err?.message?.toLowerCase().includes('fetch')
          );

          if (isOfflineError) {
            setNetworkStatus('offline');
          }

          setDevotions((prev) => {
            if (prev.length > 0) {
              setSource('cache');
              setError(
                language === 'fr'
                  ? 'Impossible de synchroniser avec le serveur. Affichage du contenu enregistré.'
                  : 'Unable to sync with cloud. Showing saved content.'
              );
            } else {
              setSource('none');
              setError(err instanceof Error ? err.message : 'Content unavailable.');
            }
            return prev;
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPublishedContent();

    return () => { cancelled = true; };
  }, [language, reloadToken, session]);

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);

  const value = useMemo(() => {
    const currentUserId = session?.user?.id ?? null;
    const contentBelongsToCurrentAccount = contentOwnerId === currentUserId;

    return {
      devotions: contentBelongsToCurrentAccount ? devotions : [],
      edition: contentBelongsToCurrentAccount ? edition : null,
      source: contentBelongsToCurrentAccount ? source : 'none',
      networkStatus,
      loading,
      error,
      refresh,
    };
  }, [contentOwnerId, devotions, edition, error, loading, networkStatus, refresh, session?.user?.id, source]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) throw new Error('useContent must be used inside ContentProvider');
  return context;
}
