import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import { recordAnalyticsEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'daily-dew-devotional-state-v1';

type DevotionalState = {
  editionKey?: string;
  completedDays: number[];
  reflections: Record<string, string>;
  prayers: Record<string, string>;
  answeredPrayers: number[];
  bookmarks: number[];
};

const EMPTY_STATE: DevotionalState = {
  completedDays: [],
  reflections: {},
  prayers: {},
  answeredPrayers: [],
  bookmarks: [],
};

type DevotionalContextValue = DevotionalState & {
  hydrated: boolean;
  syncStatus: 'offline' | 'syncing' | 'synced' | 'error';
  syncError: string | null;
  syncNow: () => void;
  setReflection: (day: number, value: string) => void;
  setPrayer: (day: number, value: string) => void;
  toggleAnsweredPrayer: (day: number) => void;
  toggleCompleted: (day: number) => void;
  toggleBookmark: (day: number) => void;
};

const DevotionalContext = createContext<DevotionalContextValue | null>(null);

export function DevotionalProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [state, setState] = useState<DevotionalState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'offline' | 'syncing' | 'synced' | 'error'>('offline');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncToken, setSyncToken] = useState(0);
  const [syncReady, setSyncReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          setState({ ...EMPTY_STATE, ...JSON.parse(stored) });
        }
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [hydrated, state]);

  const getEditionDayIds = useCallback(async () => {
    if (!supabase) throw new Error('Supabase unavailable');
    const { data: edition, error: editionError } = await supabase
      .from('editions')
      .select('id, slug, title')
      .eq('status', 'published')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (editionError) throw editionError;
    if (!edition) {
      const { data: draftEdition } = await supabase
        .from('editions')
        .select('title, status')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();
      throw new Error(draftEdition?.status === 'draft'
        ? `${draftEdition.title} is still a draft. Publish it from the admin Content tab.`
        : 'Published edition unavailable');
    }
    const { data: devotionRows, error: devotionError } = await supabase
      .from('devotions')
      .select('id, day_number')
      .eq('edition_id', edition.id);
    if (devotionError) throw devotionError;
    return { key: edition.slug, dayIds: new Map((devotionRows ?? []).map((row) => [row.day_number, row.id])) };
  }, []);

  const pushState = useCallback(async (nextState: DevotionalState, dayIds: Map<number, string>) => {
    if (!supabase || !session) return;
    const client = supabase;
    const devotionIds = Array.from(dayIds.values());
    const progressRows = nextState.completedDays
      .map((day) => dayIds.get(day + 1))
      .filter((devotionId): devotionId is string => Boolean(devotionId))
      .map((devotion_id) => ({ user_id: session.user.id, devotion_id }));
    const bookmarkRows = nextState.bookmarks
      .map((day) => dayIds.get(day + 1))
      .filter((devotionId): devotionId is string => Boolean(devotionId))
      .map((devotion_id) => ({ user_id: session.user.id, devotion_id }));
    const journalDays = new Set([
      ...Object.keys(nextState.reflections),
      ...Object.keys(nextState.prayers),
      ...nextState.answeredPrayers.map(String),
    ]);
    const journalRows = Array.from(journalDays).map((day) => {
      const devotion_id = dayIds.get(Number(day) + 1);
      return devotion_id ? {
        user_id: session.user.id,
        devotion_id,
        reflection: nextState.reflections[day] ?? '',
        prayer: nextState.prayers[day] ?? '',
        answered_prayer: nextState.answeredPrayers.includes(Number(day)),
      } : null;
    }).filter((row): row is { user_id: string; devotion_id: string; reflection: string; prayer: string; answered_prayer: boolean } => row !== null);

    await Promise.all([
      client.from('user_progress').delete().eq('user_id', session.user.id).in('devotion_id', devotionIds),
      client.from('bookmarks').delete().eq('user_id', session.user.id).in('devotion_id', devotionIds),
    ]).then((results) => {
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    });

    const journalResult = journalRows.length
      ? await client.from('journal_entries').upsert(journalRows, { onConflict: 'user_id,devotion_id' })
      : { error: null };
    const journalError = journalResult.error?.message?.toLowerCase().includes('answered_prayer')
      ? (await client.from('journal_entries').upsert(journalRows.map(({ answered_prayer: _answered, ...legacyRow }) => legacyRow), { onConflict: 'user_id,devotion_id' })).error
      : journalResult.error;
    await Promise.all([
      client.from('user_progress').upsert(progressRows, { onConflict: 'user_id,devotion_id' }),
      client.from('bookmarks').upsert(bookmarkRows, { onConflict: 'user_id,devotion_id' }),
    ]).then((results) => {
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    });
    if (journalError) throw journalError;
  }, [session]);

  useEffect(() => {
    setSyncReady(false);
    if (!session || !supabase || !hydrated) {
      setSyncStatus('offline');
      setSyncError(!supabase ? 'Supabase is not configured.' : !session ? 'Sign in to sync your progress.' : null);
      return;
    }
    let cancelled = false;
    const syncAccountState = async () => {
      setSyncStatus('syncing');
      setSyncError(null);
      try {
        const { key: editionKey, dayIds } = await getEditionDayIds();
        const client = supabase;
        if (!client) throw new Error('Supabase unavailable');
        const [{ data: remoteProgress, error: progressError }, journalResponse, { data: remoteBookmarks, error: bookmarkError }] = await Promise.all([
          client.from('user_progress').select('devotion_id').eq('user_id', session.user.id),
          client.from('journal_entries').select('devotion_id, reflection, prayer, answered_prayer').eq('user_id', session.user.id),
          client.from('bookmarks').select('devotion_id').eq('user_id', session.user.id),
        ]);
        if (progressError) throw progressError;
        if (bookmarkError) throw bookmarkError;
        let remoteJournal: { devotion_id: string; reflection: string; prayer: string; answered_prayer?: boolean }[] = journalResponse.data ?? [];
        if (journalResponse.error?.message?.toLowerCase().includes('answered_prayer')) {
          const legacyJournal = await client.from('journal_entries').select('devotion_id, reflection, prayer').eq('user_id', session.user.id);
          if (legacyJournal.error) throw legacyJournal.error;
          remoteJournal = (legacyJournal.data ?? []).map((row) => ({ ...row, answered_prayer: false }));
        } else if (journalResponse.error) {
          throw journalResponse.error;
        }
        const idToDay = new Map(Array.from(dayIds.entries()).map(([day, id]) => [id, day]));
        const currentState = state.editionKey === editionKey ? state : { ...EMPTY_STATE, editionKey };
        const remoteCompleted = (remoteProgress ?? []).map((row) => idToDay.get(row.devotion_id)).filter((day): day is number => day !== undefined).map((day) => day - 1);
        const remoteBookmarked = (remoteBookmarks ?? []).map((row) => idToDay.get(row.devotion_id)).filter((day): day is number => day !== undefined).map((day) => day - 1);
        const remoteReflections: Record<string, string> = {};
        const remotePrayers: Record<string, string> = {};
        const remoteAnswered: number[] = [];
        (remoteJournal ?? []).forEach((row) => {
          const day = idToDay.get(row.devotion_id);
          if (day === undefined) return;
          if (row.reflection) remoteReflections[day - 1] = row.reflection;
          if (row.prayer) remotePrayers[day - 1] = row.prayer;
          if (row.answered_prayer) remoteAnswered.push(day - 1);
        });
        const mergedState: DevotionalState = {
          ...currentState,
          editionKey,
          completedDays: Array.from(new Set([...currentState.completedDays, ...remoteCompleted])),
          bookmarks: Array.from(new Set([...currentState.bookmarks, ...remoteBookmarked])),
          answeredPrayers: Array.from(new Set([...currentState.answeredPrayers, ...remoteAnswered])),
          reflections: { ...remoteReflections, ...currentState.reflections },
          prayers: { ...remotePrayers, ...currentState.prayers },
        };
        setState(mergedState);
        await pushState(mergedState, dayIds);
        if (!cancelled) {
          setSyncReady(true);
          setSyncStatus('synced');
        }
      } catch (syncErrorValue: unknown) {
        if (!cancelled) {
          setSyncStatus('error');
          setSyncError(syncErrorValue instanceof Error ? syncErrorValue.message : 'Unable to sync your progress.');
        }
      }
    };
    syncAccountState();
    return () => { cancelled = true; };
  // The initial account pull intentionally captures the hydrated snapshot; later local changes use the debounced push effect below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getEditionDayIds, hydrated, pushState, session, syncToken]);

  useEffect(() => {
    if (!syncReady || !session || !supabase) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSyncStatus('syncing');
      setSyncError(null);
      try {
        const { dayIds } = await getEditionDayIds();
        await pushState(state, dayIds);
        if (!cancelled) setSyncStatus('synced');
      } catch (syncErrorValue: unknown) {
        if (!cancelled) {
          setSyncStatus('error');
          setSyncError(syncErrorValue instanceof Error ? syncErrorValue.message : 'Unable to sync your progress.');
        }
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [getEditionDayIds, pushState, session, state, syncReady]);

  const updateState = (updater: (current: DevotionalState) => DevotionalState) => {
    setState((current) => {
      return updater(current);
    });
  };

  const recordEvent = useCallback((eventType: string, metadata: Record<string, number>) => {
    recordAnalyticsEvent(eventType, metadata, session?.user.id ?? null).catch(() => undefined);
  }, [session]);

  const value = useMemo<DevotionalContextValue>(
    () => ({
      ...state,
      hydrated,
      syncStatus,
      syncError,
      syncNow: () => setSyncToken((value) => value + 1),
      setReflection: (day, value) =>
        updateState((current) => ({
          ...current,
          reflections: { ...current.reflections, [day]: value },
        })),
      setPrayer: (day, value) =>
        updateState((current) => ({
          ...current,
          prayers: { ...current.prayers, [day]: value },
        })),
      toggleAnsweredPrayer: (day) =>
        updateState((current) => ({
          ...current,
          answeredPrayers: current.answeredPrayers.includes(day)
            ? current.answeredPrayers.filter((item) => item !== day)
            : [...current.answeredPrayers, day],
        })),
      toggleCompleted: (day) =>
        (() => {
          const completed = state.completedDays.includes(day);
          updateState((current) => ({ ...current, completedDays: completed ? current.completedDays.filter((item) => item !== day) : [...current.completedDays, day] }));
          if (!completed) recordEvent('meditation_completed', { day });
        })(),
      toggleBookmark: (day) =>
        (() => {
          const bookmarked = state.bookmarks.includes(day);
          updateState((current) => ({ ...current, bookmarks: bookmarked ? current.bookmarks.filter((item) => item !== day) : [...current.bookmarks, day] }));
          if (!bookmarked) recordEvent('meditation_bookmarked', { day });
        })(),
    }),
    [hydrated, recordEvent, state, syncError, syncStatus],
  );

  return <DevotionalContext.Provider value={value}>{children}</DevotionalContext.Provider>;
}

export function useDevotional() {
  const context = useContext(DevotionalContext);
  if (!context) {
    throw new Error('useDevotional must be used inside DevotionalProvider');
  }
  return context;
}
