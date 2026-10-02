import { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { recordAnalyticsEvent } from '@/lib/analytics';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session) {
        recordAnalyticsEvent('app_open', {}, data.session.user.id).catch(() => undefined);
        if (data.session.user.email) client.from('newsletter_subscribers').upsert({ user_id: data.session.user.id, email: data.session.user.email }, { onConflict: 'user_id' }).then(() => undefined);
      } else recordAnalyticsEvent('app_open').catch(() => undefined);
    }).catch(() => setLoading(false));

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (nextSession) {
        recordAnalyticsEvent('app_open', {}, nextSession.user.id).catch(() => undefined);
        if (nextSession.user.email) client.from('newsletter_subscribers').upsert({ user_id: nextSession.user.id, email: nextSession.user.email }, { onConflict: 'user_id' }).then(() => undefined);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading,
    signIn: async (email, password) => {
      if (!supabase) return { error: 'Cloud account service is not configured.' };
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? { error: error.message } : {};
    },
    signUp: async (email, password) => {
      if (!supabase) return { error: 'Cloud account service is not configured.' };
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      return error
        ? { error: error.message }
        : { needsConfirmation: !data.session };
    },
    signOut: async () => {
      await supabase?.auth.signOut();
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
