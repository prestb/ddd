import { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { recordAnalyticsEvent } from '@/lib/analytics';
import { AppLanguage, t } from '@/lib/i18n';

const REDIRECT_RECOVERY_URL = 'devotionalapp://reset-password';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string, language?: AppLanguage) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signUp: (email: string, password: string, language?: AppLanguage) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  resetPassword: (email: string, language?: AppLanguage) => Promise<{ error?: string }>;
  updatePassword: (password: string, language?: AppLanguage) => Promise<{ error?: string }>;
  changePassword: (currentPassword: string, newPassword: string, language?: AppLanguage) => Promise<{ error?: string }>;
  changeEmail: (currentPassword: string, newEmail: string, language?: AppLanguage) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
};

export function mapAuthError(
  rawError: { message?: string; name?: string; status?: number } | string | null | undefined,
  mode: 'signin' | 'signup' | 'reset',
  language: AppLanguage = 'en'
): string {
  if (!rawError) return '';
  const msg = typeof rawError === 'string' ? rawError.toLowerCase() : (rawError.message ?? '').toLowerCase();

  // Network / Fetch errors
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
    return t(language, 'authNetworkError');
  }

  // Too many attempts / Rate limit
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('429')) {
    return t(language, 'authTooManyAttempts');
  }

  // Invalid Email
  if (msg.includes('invalid email') || msg.includes('email address is invalid') || msg.includes('email_invalid')) {
    return t(language, 'authInvalidEmail');
  }

  // Weak Password (policy / length)
  if (msg.includes('password') && (msg.includes('weak') || msg.includes('at least') || msg.includes('short') || msg.includes('policy'))) {
    return t(language, 'authWeakPassword');
  }

  // Reset Password specific generic error
  if (mode === 'reset') {
    if (msg.includes('unable to send') || msg.includes('recovery')) {
      return t(language, 'authResetSendError');
    }
  }

  // Sign Up specific: Existing account
  if (mode === 'signup') {
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user_already_exists') || msg.includes('email_exists')) {
      return t(language, 'authExistingAccount');
    }
  }

  // Sign In specific: Invalid credentials (security anti-enumeration rule: same generic message)
  if (mode === 'signin') {
    if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials') || msg.includes('user not found') || msg.includes('wrong password') || msg.includes('invalid_grant')) {
      return t(language, 'authInvalidCredentials');
    }
  }

  // Safe Fallback for any other provider / technical error
  return t(language, 'authGenericError');
}

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
    signIn: async (email, password, language = 'en') => {
      if (!supabase) return { error: t(language, 'authGenericError') };
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? { error: mapAuthError(error, 'signin', language) } : {};
    },
    signUp: async (email, password, language = 'en') => {
      if (!supabase) return { error: t(language, 'authGenericError') };
      const cleanEmail = email.trim();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: 'devotionalapp://auth',
        },
      });
      if (error) {
        return { error: mapAuthError(error, 'signup', language) };
      }

      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInError) {
          return { needsConfirmation: true };
        }
      }

      return {};
    },
    resetPassword: async (email, language = 'en') => {
      if (!supabase) return { error: t(language, 'authGenericError') };
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        return { error: t(language, 'authInvalidEmail') };
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: REDIRECT_RECOVERY_URL,
        });

        if (error) {
          return { error: mapAuthError(error, 'reset', language) };
        }

        return {};
      } catch (err: any) {
        return { error: mapAuthError(err, 'reset', language) };
      }
    },
    updatePassword: async (password, language = 'en') => {
      if (!supabase) return { error: t(language, 'authPasswordUpdateFailed') };
      if (!password || password.length < 6) {
        return { error: t(language, 'authWeakPassword') };
      }

      try {
        const { error } = await supabase.auth.updateUser({
          password,
        });

        if (error) {
          return { error: t(language, 'authPasswordUpdateFailed') };
        }

        return {};
      } catch {
        return { error: t(language, 'authPasswordUpdateFailed') };
      }
    },
    changePassword: async (currentPassword: string, newPassword: string, language: AppLanguage = 'en') => {
      if (!supabase) return { error: t(language, 'authPasswordUpdateFailed') };
      if (!session?.user?.email) {
        return { error: t(language, 'authGenericError') };
      }

      const trimmedCurrent = currentPassword;
      const trimmedNew = newPassword;

      if (!trimmedCurrent || !trimmedNew || trimmedNew.length < 6) {
        return { error: t(language, 'authWeakPassword') };
      }

      try {
        // 1. Verify current credentials against session email
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: trimmedCurrent,
        });

        if (signInError) {
          return { error: t(language, 'authCurrentPasswordIncorrect') };
        }

        // 2. Update password after successful verification
        const { error: updateError } = await supabase.auth.updateUser({
          password: trimmedNew,
        });

        if (updateError) {
          return { error: t(language, 'authPasswordUpdateFailed') };
        }

        return {};
      } catch {
        return { error: t(language, 'authPasswordUpdateFailed') };
      }
    },
    changeEmail: async (currentPassword: string, newEmail: string, language: AppLanguage = 'en') => {
      if (!supabase) return { error: t(language, 'authEmailUpdateFailed') };
      if (!session?.user?.email) {
        return { error: t(language, 'authGenericError') };
      }

      const trimmedCurrentPassword = currentPassword;
      const normalizedNewEmail = newEmail.trim().toLowerCase();

      if (!trimmedCurrentPassword) {
        return { error: t(language, 'currentPasswordRequired') };
      }

      if (!normalizedNewEmail || !normalizedNewEmail.includes('@')) {
        return { error: t(language, 'authInvalidEmail') };
      }

      if (normalizedNewEmail === session.user.email.toLowerCase()) {
        return { error: t(language, 'authSameEmailError') };
      }

      try {
        // 1. Verify current credentials against session email
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: trimmedCurrentPassword,
        });

        if (signInError) {
          return { error: t(language, 'authCurrentPasswordIncorrect') };
        }

        // 2. Request email update after successful verification
        const { error: updateError } = await supabase.auth.updateUser({
          email: normalizedNewEmail,
        });

        if (updateError) {
          return { error: t(language, 'authEmailUpdateFailed') };
        }

        return { needsConfirmation: true };
      } catch {
        return { error: t(language, 'authEmailUpdateFailed') };
      }
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
