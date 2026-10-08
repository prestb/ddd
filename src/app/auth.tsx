import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppIcon from '@/components/app-icon';
import AppFeedback, { FeedbackType } from '@/components/app-feedback';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

import DailyDewHeader from '@/components/daily-dew-header';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { DewDesign } from '@/constants/design';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const { session, signIn, signUp, resetPassword, signOut } = useAuth();
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'recovery'>('signin');
  const [feedback, setFeedback] = useState<{ type: FeedbackType; title: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const processedUrlsRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    async function handleAuthDeepLink(url: string | null): Promise<boolean> {
      if (!url || !supabase) return false;

      if (processedUrlsRef.current.has(url)) return false;
      processedUrlsRef.current.add(url);

      try {
        const hash = url.split('#')[1] ?? '';
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error && data.session && !cancelled) {
            return true;
          }
        }

        const parsed = Linking.parse(url);
        const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session && !cancelled) {
            return true;
          }
        }

        const queryAccessToken = typeof parsed.queryParams?.access_token === 'string' ? parsed.queryParams.access_token : null;
        const queryRefreshToken = typeof parsed.queryParams?.refresh_token === 'string' ? parsed.queryParams.refresh_token : null;
        if (queryAccessToken && queryRefreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: queryAccessToken,
            refresh_token: queryRefreshToken,
          });
          if (!error && data.session && !cancelled) {
            return true;
          }
        }
      } catch {
        // Safely ignore deep link parse exceptions
      }
      return false;
    }

    async function checkInitialUrl() {
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (initialUrl) {
        await handleAuthDeepLink(initialUrl);
      }
    }

    checkInitialUrl();

    const subscription = Linking.addEventListener('url', (event) => {
      handleAuthDeepLink(event.url);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    supabase?.from('profiles').select('role').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      router.replace(data?.role === 'admin' || data?.role === 'editor' ? '/admin' as any : '/(tabs)/journey' as any);
    }, () => {
      if (!cancelled) router.replace('/(tabs)/journey' as any);
    });
    return () => { cancelled = true; };
  }, [session]);

  const submit = async () => {
    if (mode === 'recovery') {
      if (!email.trim() || !email.includes('@')) {
        setFeedback({
          type: 'warning',
          title: t(language, 'authFeedbackCheckEmailTitle'),
          message: t(language, 'authInvalidEmail'),
        });
        return;
      }
      setBusy(true);
      setFeedback(null);
      const result = await resetPassword(email, language);
      setBusy(false);

      if (result.error) {
        setFeedback({
          type: 'error',
          title: t(language, 'authFeedbackResetFailed'),
          message: result.error,
        });
      } else {
        // Anti-Account Enumeration Success Message
        setFeedback({
          type: 'info',
          title: t(language, 'resetSuccessTitle'),
          message: t(language, 'resetSuccessMessage'),
        });
      }
      return;
    }

    if (!email.trim() || password.length < 6) {
      setFeedback({
        type: 'warning',
        title: t(language, 'authFeedbackCheckDetailsTitle'),
        message: t(language, 'invalidCredentials'),
      });
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setFeedback({
        type: 'warning',
        title: t(language, 'authFeedbackCheckDetailsTitle'),
        message: t(language, 'passwordsDoNotMatch'),
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    const result = mode === 'signin' ? await signIn(email, password, language) : await signUp(email, password, language);
    setBusy(false);

    if (result.error) {
      setFeedback({
        type: 'error',
        title: mode === 'signin' ? t(language, 'authFeedbackSignInFailed') : t(language, 'authFeedbackSignUpFailed'),
        message: result.error,
      });
    } else if (result.needsConfirmation) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setMode('signin');
      setFeedback({
        type: 'info',
        title: t(language, 'authFeedbackCheckEmailTitle'),
        message: t(language, 'checkEmail'),
      });
    } else {
      setPassword('');
      setConfirmPassword('');
      setFeedback({
        type: 'success',
        title: t(language, 'authFeedbackSignedInTitle'),
        message: t(language, 'signedIn'),
      });
    }
  };

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>{t(language, 'accountJourney')}</Text>
          <Text style={[styles.title, isDark && styles.darkInk]}>
            {session
              ? t(language, 'yourAccount')
              : mode === 'recovery'
              ? t(language, 'resetPasswordHeading')
              : t(language, 'keepJourney')}
          </Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>
            {session
              ? t(language, 'accountReady')
              : mode === 'recovery'
              ? t(language, 'resetPasswordSubtext')
              : t(language, 'signInReady')}
          </Text>

          {session ? (
            <View style={[styles.card, isDark && styles.darkCard]}>
              <Text style={styles.cardLabel}>{t(language, 'signedInAs')}</Text>
              <Text style={[styles.email, isDark && styles.darkInk]}>{session.user.email}</Text>
              <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel={t(language, 'signOut')} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>{t(language, 'signOut')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.card, isDark && styles.darkCard]}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t(language, 'emailAddress')}
                placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                style={[styles.input, isDark && styles.darkInput]}
                accessibilityLabel={t(language, 'emailAddress')}
              />

              {mode !== 'recovery' && (
                <>
                  <View style={[styles.passwordRow, isDark && styles.darkInput]}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder={t(language, 'password')}
                      placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                      secureTextEntry={!showPassword}
                      style={[styles.passwordInput, isDark && styles.darkInk]}
                      accessibilityLabel={t(language, 'password')}
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? t(language, 'hidePassword') : t(language, 'showPassword')}>
                      <AppIcon name={showPassword ? 'eye.slash' : 'eye'} size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                    </Pressable>
                  </View>

                  {mode === 'signin' && (
                    <Pressable
                      onPress={() => { setMode('recovery'); setFeedback(null); }}
                      accessibilityRole="button"
                      accessibilityLabel={t(language, 'forgotPassword')}
                      style={styles.forgotButton}>
                      <Text style={styles.forgotText}>{t(language, 'forgotPassword')}</Text>
                    </Pressable>
                  )}

                  {mode === 'signup' && (
                    <View style={[styles.passwordRow, isDark && styles.darkInput]}>
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder={t(language, 'confirmPassword')}
                        placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                        secureTextEntry={!showConfirmPassword}
                        style={[styles.passwordInput, isDark && styles.darkInk]}
                        accessibilityLabel={t(language, 'confirmPassword')}
                      />
                      <Pressable
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        accessibilityRole="button"
                        accessibilityLabel={showConfirmPassword ? t(language, 'hidePassword') : t(language, 'showPassword')}>
                        <AppIcon name={showConfirmPassword ? 'eye.slash' : 'eye'} size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              <Pressable
                onPress={submit}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={
                  busy
                    ? t(language, 'working')
                    : mode === 'recovery'
                    ? t(language, 'sendResetLink')
                    : mode === 'signin'
                    ? t(language, 'login')
                    : t(language, 'createAccount')
                }
                style={styles.primaryButton}>
                <Text style={styles.primaryText}>
                  {busy
                    ? t(language, 'working')
                    : mode === 'recovery'
                    ? t(language, 'sendResetLink')
                    : mode === 'signin'
                    ? t(language, 'login')
                    : t(language, 'createAccount')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setFeedback(null);
                }}
                accessibilityRole="button"
                style={styles.modeButton}>
                <Text style={styles.modeText}>
                  {mode === 'recovery'
                    ? t(language, 'backToSignIn')
                    : mode === 'signin'
                    ? t(language, 'newHere')
                    : t(language, 'alreadyAccount')}
                </Text>
              </Pressable>

              {feedback ? (
                <AppFeedback
                  type={feedback.type}
                  title={feedback.title}
                  message={feedback.message}
                  isDark={isDark}
                />
              ) : null}
            </View>
          )}

          <View style={[styles.note, isDark && styles.darkCard]}>
            <Text style={[styles.noteTitle, isDark && styles.darkInk]}>{t(language, 'journeyYours')}</Text>
            <Text style={[styles.noteText, isDark && styles.darkBody]}>{t(language, 'syncAcross')}</Text>
          </View>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t(language, 'backToDailyDew')} style={styles.backButton}>
            <Text style={styles.backText}>{t(language, 'backToDailyDew')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  safeArea: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  darkScreen: { backgroundColor: DewDesign.colors.darkCanvas },
  content: { paddingHorizontal: DewDesign.spacing.screen, paddingTop: 16, paddingBottom: 40 },
  kicker: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 34, fontWeight: '700', marginTop: 5 },
  subtitle: { color: DewDesign.colors.body, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 24 },
  card: { backgroundColor: DewDesign.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: DewDesign.colors.line, padding: 17 },
  darkCard: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  darkInk: { color: DewDesign.colors.darkInk },
  darkBody: { color: DewDesign.colors.darkBody },
  darkInput: { backgroundColor: DewDesign.colors.darkSurfaceMuted, borderColor: DewDesign.colors.darkLine, color: DewDesign.colors.darkInk },
  cardLabel: { color: DewDesign.colors.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  email: { color: DewDesign.colors.ink, fontSize: 16, fontWeight: '800', marginTop: 9 },
  input: { height: 48, backgroundColor: DewDesign.colors.canvas, borderWidth: 1, borderColor: DewDesign.colors.line, borderRadius: 10, paddingHorizontal: 12, color: DewDesign.colors.ink, fontSize: 14, marginBottom: 10 },
  passwordRow: { minHeight: 48, backgroundColor: DewDesign.colors.canvas, borderWidth: 1, borderColor: DewDesign.colors.line, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingRight: 12, marginBottom: 10 },
  passwordInput: { flex: 1, height: 46, paddingHorizontal: 12, color: DewDesign.colors.ink, fontSize: 14 },
  forgotButton: { alignSelf: 'flex-end', marginTop: 2, marginBottom: 12 },
  forgotText: { color: DewDesign.colors.terracotta, fontSize: 12, fontWeight: '800' },
  primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: DewDesign.colors.forest, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modeButton: { alignItems: 'center', paddingVertical: 13 },
  modeText: { color: DewDesign.colors.terracotta, fontSize: 12, fontWeight: '800' },
  secondaryButton: { minHeight: 46, borderWidth: 1, borderColor: DewDesign.colors.forestMuted, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  secondaryText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
  note: { backgroundColor: DewDesign.colors.surfaceMuted, borderRadius: 14, padding: 16, marginTop: 18 },
  noteTitle: { color: DewDesign.colors.forest, fontFamily: 'serif', fontSize: 17, fontWeight: '700' },
  noteText: { color: DewDesign.colors.body, fontSize: 12, lineHeight: 17, marginTop: 5 },
  backButton: { alignItems: 'center', paddingVertical: 18 },
  backText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
});
