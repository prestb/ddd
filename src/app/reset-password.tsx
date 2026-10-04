import AppFeedback, { FeedbackType } from '@/components/app-feedback';
import AppIcon from '@/components/app-icon';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verifyingSession, setVerifyingSession] = useState(true);
  const [hasValidRecoverySession, setHasValidRecoverySession] = useState(false);
  const [feedback, setFeedback] = useState<{ type: FeedbackType; title: string; message: string } | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function processRecoveryUrl(url: string | null): Promise<boolean> {
      if (!url || !supabase) return false;
      try {
        const hash = url.split('#')[1] ?? '';
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

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
      } catch {
        // Ignore deep link parse exceptions
      }
      return false;
    }

    async function initializeRecoveryCheck() {
      setVerifyingSession(true);
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      let isValidRecovery = false;

      if (initialUrl) {
        isValidRecovery = await processRecoveryUrl(initialUrl);
      }

      if (!cancelled) {
        setHasValidRecoverySession(isValidRecovery);
        setVerifyingSession(false);
      }
    }

    initializeRecoveryCheck();

    const subscription = Linking.addEventListener('url', (event) => {
      processRecoveryUrl(event.url).then((isValid) => {
        if (!cancelled) {
          setHasValidRecoverySession(isValid);
          setVerifyingSession(false);
        }
      });
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const submitPasswordReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      setFeedback({
        type: 'warning',
        title: t(language, 'authFeedbackCheckDetailsTitle'),
        message: t(language, 'authWeakPassword'),
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({
        type: 'warning',
        title: t(language, 'authFeedbackCheckDetailsTitle'),
        message: t(language, 'passwordsDoNotMatch'),
      });
      return;
    }

    setBusy(true);
    setFeedback(null);
    const result = await updatePassword(newPassword, language);
    setBusy(false);

    if (result.error) {
      setFeedback({
        type: 'error',
        title: t(language, 'authFeedbackResetFailed'),
        message: result.error,
      });
    } else {
      setNewPassword('');
      setConfirmPassword('');
      setUpdateSuccess(true);
      setFeedback({
        type: 'success',
        title: t(language, 'passwordUpdatedTitle'),
        message: t(language, 'passwordUpdatedMsg'),
      });
    }
  };

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.push('/auth' as any)} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t(language, 'backToSignIn')}>
            <AppIcon name="chevron.left" size={17} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.ink} />
            <Text style={[styles.backText, isDark && styles.darkInk]}>{t(language, 'backToSignIn')}</Text>
          </Pressable>

          <Text style={styles.kicker}>{t(language, 'accountJourney')}</Text>
          <Text style={[styles.title, isDark && styles.darkInk]}>{t(language, 'createNewPassword')}</Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>{t(language, 'enterNewPasswordSubtext')}</Text>

          {verifyingSession ? (
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', paddingVertical: 30 }]}>
              <ActivityIndicator color={DewDesign.colors.forest} size="small" />
              <Text style={[styles.emptyText, isDark && styles.darkMuted, { marginTop: 12 }]}>{t(language, 'working')}</Text>
            </View>
          ) : !hasValidRecoverySession ? (
            /* Expired / Invalid Recovery Link State */
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', padding: 22 }]}>
              <View style={styles.expiredIconBox}>
                <AppIcon name="clock.fill" size={24} tintColor={DewDesign.colors.terracotta} />
              </View>
              <Text style={[styles.expiredTitle, isDark && styles.darkInk]}>{t(language, 'resetLinkExpiredTitle')}</Text>
              <Text style={[styles.expiredText, isDark && styles.darkMuted]}>{t(language, 'resetLinkExpiredMsg')}</Text>
              <Pressable
                onPress={() => router.push('/auth' as any)}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'requestNewLinkBtn')}
                style={styles.primaryButton}>
                <Text style={styles.primaryText}>{t(language, 'requestNewLinkBtn')}</Text>
              </Pressable>
            </View>
          ) : (
            /* Active Valid Recovery Session Form */
            <View style={[styles.card, isDark && styles.darkCard]}>
              {!updateSuccess ? (
                <>
                  <View style={[styles.passwordRow, isDark && styles.darkInput]}>
                    <TextInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder={t(language, 'newPasswordLabel')}
                      placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                      secureTextEntry={!showNewPassword}
                      textContentType="newPassword"
                      autoComplete="password-new"
                      style={[styles.passwordInput, isDark && styles.darkInk]}
                      accessibilityLabel={t(language, 'newPasswordLabel')}
                    />
                    <Pressable
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      accessibilityRole="button"
                      accessibilityLabel={showNewPassword ? t(language, 'hidePassword') : t(language, 'showPassword')}>
                      <AppIcon name={showNewPassword ? 'eye.slash' : 'eye'} size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                    </Pressable>
                  </View>

                  <View style={[styles.passwordRow, isDark && styles.darkInput]}>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder={t(language, 'confirmNewPasswordLabel')}
                      placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                      secureTextEntry={!showConfirmPassword}
                      textContentType="newPassword"
                      autoComplete="password-new"
                      style={[styles.passwordInput, isDark && styles.darkInk]}
                      accessibilityLabel={t(language, 'confirmNewPasswordLabel')}
                    />
                    <Pressable
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      accessibilityRole="button"
                      accessibilityLabel={showConfirmPassword ? t(language, 'hidePassword') : t(language, 'showPassword')}>
                      <AppIcon name={showConfirmPassword ? 'eye.slash' : 'eye'} size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={submitPasswordReset}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={busy ? t(language, 'working') : t(language, 'updatePasswordBtn')}
                    style={[styles.primaryButton, busy && styles.disabledButton]}>
                    <Text style={styles.primaryText}>
                      {busy ? t(language, 'working') : t(language, 'updatePasswordBtn')}
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {feedback ? (
                <AppFeedback
                  type={feedback.type}
                  title={feedback.title}
                  message={feedback.message}
                  isDark={isDark}
                />
              ) : null}

              {updateSuccess && (
                <Pressable
                  onPress={() => router.push('/auth' as any)}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'backToSignIn')}
                  style={[styles.primaryButton, { marginTop: 12 }]}>
                  <Text style={styles.primaryText}>{t(language, 'backToSignIn')}</Text>
                </Pressable>
              )}
            </View>
          )}
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
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 20 },
  backText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
  kicker: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 34, fontWeight: '700', marginTop: 5 },
  subtitle: { color: DewDesign.colors.body, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 24 },
  card: { backgroundColor: DewDesign.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: DewDesign.colors.line, padding: 17 },
  darkCard: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  darkInk: { color: DewDesign.colors.darkInk },
  darkBody: { color: DewDesign.colors.darkBody },
  darkMuted: { color: DewDesign.colors.darkMuted },
  passwordRow: { minHeight: 48, backgroundColor: DewDesign.colors.canvas, borderWidth: 1, borderColor: DewDesign.colors.line, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingRight: 12, marginBottom: 12 },
  darkInput: { backgroundColor: DewDesign.colors.darkSurfaceMuted, borderColor: DewDesign.colors.darkLine, color: DewDesign.colors.darkInk },
  passwordInput: { flex: 1, height: 46, paddingHorizontal: 12, color: DewDesign.colors.ink, fontSize: 14 },
  primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: DewDesign.colors.forest, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  expiredIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: DewDesign.colors.terracottaSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  expiredTitle: { fontSize: 20, fontWeight: '800', color: DewDesign.colors.ink, textAlign: 'center', marginBottom: 6 },
  expiredText: { fontSize: 13, lineHeight: 20, color: DewDesign.colors.body, textAlign: 'center', marginBottom: 18 },
  emptyText: { color: DewDesign.colors.body, fontSize: 13, textAlign: 'center' },
});
