import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'daily-dew-settings-v1';

type SettingsContextValue = {
  fontScale: number;
  setFontScale: (value: number) => void;
  language: 'en' | 'fr';
  setLanguage: (value: 'en' | 'fr') => void;
  reminderEnabled: boolean;
  setReminderEnabled: (value: boolean) => void;
  reminderHour: number;
  setReminderHour: (value: number) => void;
  newsletterEnabled: boolean;
  setNewsletterEnabled: (value: boolean) => void;
  themeMode: 'light' | 'dark';
  setThemeMode: (value: 'light' | 'dark') => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [fontScale, setFontScaleState] = useState(1);
  const [language, setLanguageState] = useState<'en' | 'fr'>('en');
  const [reminderEnabled, setReminderEnabledState] = useState(false);
  const [reminderHour, setReminderHourState] = useState(7);
  const [newsletterEnabled, setNewsletterEnabledState] = useState(false);
  const [themeMode, setThemeModeState] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          const settings = JSON.parse(stored);
          setFontScaleState(settings.fontScale ?? 1);
          setLanguageState(settings.language ?? 'en');
          setReminderEnabledState(Boolean(settings.reminderEnabled));
          setReminderHourState(Number.isInteger(settings.reminderHour) ? settings.reminderHour : 7);
          setNewsletterEnabledState(Boolean(settings.newsletterEnabled));
          setThemeModeState(settings.themeMode === 'dark' ? 'dark' : 'light');
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setNewsletterEnabledState(false);
      return;
    }
    supabase.from('newsletter_subscribers').select('opted_in').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setNewsletterEnabledState(Boolean(data?.opted_in)), () => undefined);
  }, [session]);

  const value = useMemo(
    () => ({
      fontScale,
      setFontScale: (value: number) => {
        const next = Math.min(Math.max(value, 0.9), 1.2);
        setFontScaleState(next);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ fontScale: next, language, reminderEnabled, reminderHour, newsletterEnabled, themeMode })).catch(() => undefined);
      },
      language,
      setLanguage: (value: 'en' | 'fr') => {
        setLanguageState(value);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ fontScale, language: value, reminderEnabled, reminderHour, newsletterEnabled, themeMode })).catch(() => undefined);
      },
      reminderEnabled,
      setReminderEnabled: (value: boolean) => {
        setReminderEnabledState(value);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ fontScale, language, reminderEnabled: value, reminderHour, newsletterEnabled, themeMode })).catch(() => undefined);
      },
      reminderHour,
      setReminderHour: (value: number) => {
        const next = Math.min(Math.max(Math.round(value), 0), 23);
        setReminderHourState(next);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ fontScale, language, reminderEnabled, reminderHour: next, newsletterEnabled, themeMode })).catch(() => undefined);
      },
      newsletterEnabled,
      setNewsletterEnabled: (value: boolean) => {
        setNewsletterEnabledState(value);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ fontScale, language, reminderEnabled, reminderHour, newsletterEnabled: value, themeMode })).catch(() => undefined);
        if (supabase && session?.user.email) {
          supabase.from('newsletter_subscribers').upsert({ user_id: session.user.id, email: session.user.email, opted_in: value }, { onConflict: 'user_id' }).then(() => undefined);
        }
      },
      themeMode,
      setThemeMode: (value: 'light' | 'dark') => {
        setThemeModeState(value);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ fontScale, language, reminderEnabled, reminderHour, newsletterEnabled, themeMode: value })).catch(() => undefined);
      },
    }),
    [fontScale, language, reminderEnabled, reminderHour, newsletterEnabled, themeMode, session],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
