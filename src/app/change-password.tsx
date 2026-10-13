import AppFeedback, { FeedbackType } from '@/components/app-feedback';
import AppIcon from '@/components/app-icon';
import AppBottomNav from '@/components/app-bottom-nav';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChangePasswordScreen() {
  const { session, changePassword } = useAuth();
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [feedback, setFeedback] = useState<{ type: FeedbackType; title: string; message: string } | null>(null);

  const handleSubmit = async () => {
    if (!currentPassword) {
      setFeedback({
        type: 'warning',
        title: t(language, 'authFeedbackCheckDetailsTitle'),
        message: t(language, 'currentPasswordRequired'),
      });
      return;
    }

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
    const result = await changePassword(currentPassword, newPassword, language);
    setBusy(false);

    if (result.error) {
      setFeedback({
        type: 'error',
        title: t(language, 'authFeedbackResetFailed'),
        message: result.error,
      });
    } else {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangeSuccess(true);
      setFeedback({
        type: 'success',
        title: t(language, 'changePasswordSuccessTitle'),
        message: t(language, 'changePasswordSuccessMsg'),
      });
    }
  };

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t(language, 'goBack')}>
            <AppIcon name="chevron.left" size={17} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.ink} />
            <Text style={[styles.backText, isDark && styles.darkInk]}>{t(language, 'back')}</Text>
          </Pressable>

          <Text style={styles.kicker}>{t(language, 'securitySectionTitle')}</Text>
          <Text style={[styles.title, isDark && styles.darkInk]}>{t(language, 'changePasswordHeading')}</Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>{t(language, 'changePasswordSubtext')}</Text>

          {!session ? (
            /* Signed Out Guard */
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', paddingVertical: 28 }]}>
              <AppIcon name="lock" size={32} tintColor={DewDesign.colors.terracotta} />
              <Text style={[styles.cardTitle, isDark && styles.darkInk, { marginTop: 12 }]}>{t(language, 'guestUser')}</Text>
              <Text style={[styles.cardBodyText, isDark && styles.darkMuted, { textAlign: 'center', marginBottom: 18 }]}>
                {t(language, 'signedOutDesc')}
              </Text>
              <Pressable
                onPress={() => router.push('/auth')}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'login')}
                style={styles.primaryButton}>
                <Text style={styles.primaryText}>{t(language, 'login')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.card, isDark && styles.darkCard]}>
              {!changeSuccess ? (
                <>
                  {/* Current Password Field */}
                  <View style={[styles.passwordRow, isDark && styles.darkInput]}>
                    <TextInput
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder={t(language, 'currentPasswordLabel')}
                      placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                      secureTextEntry={!showCurrentPassword}
                      textContentType="password"
                      autoComplete="password"
                      style={[styles.passwordInput, isDark && styles.darkInk]}
                      accessibilityLabel={t(language, 'currentPasswordLabel')}
                    />
                    <Pressable
                      onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                      accessibilityRole="button"
                      accessibilityLabel={showCurrentPassword ? t(language, 'hidePassword') : t(language, 'showPassword')}>
                      <AppIcon name={showCurrentPassword ? 'eye.slash' : 'eye'} size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                    </Pressable>
                  </View>

                  {/* New Password Field */}
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

                  {/* Confirm New Password Field */}
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
                    onPress={handleSubmit}
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

              {changeSuccess && (
                <Pressable
                  onPress={() => router.push('/profile' as any)}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'returnToProfileBtn')}
                  style={[styles.primaryButton, { marginTop: 12 }]}>
                  <Text style={styles.primaryText}>{t(language, 'returnToProfileBtn')}</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
        <AppBottomNav />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  safeArea: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  darkScreen: { backgroundColor: DewDesign.colors.darkCanvas },
  content: { paddingHorizontal: DewDesign.spacing.screen, paddingTop: 16, paddingBottom: 110 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 20 },
  backText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
  kicker: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 34, fontWeight: '700', marginTop: 5 },
  subtitle: { color: DewDesign.colors.body, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 24 },
  card: { backgroundColor: DewDesign.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: DewDesign.colors.line, padding: 18, marginBottom: 14 },
  darkCard: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  darkInk: { color: DewDesign.colors.darkInk },
  darkBody: { color: DewDesign.colors.darkBody },
  darkMuted: { color: DewDesign.colors.darkMuted },
  cardTitle: { fontSize: 18, fontWeight: '800', color: DewDesign.colors.ink },
  cardBodyText: { fontSize: 13, lineHeight: 19, color: DewDesign.colors.body },
  passwordRow: { minHeight: 48, backgroundColor: DewDesign.colors.canvas, borderWidth: 1, borderColor: DewDesign.colors.line, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingRight: 12, marginBottom: 12 },
  darkInput: { backgroundColor: DewDesign.colors.darkSurfaceMuted, borderColor: DewDesign.colors.darkLine, color: DewDesign.colors.darkInk },
  passwordInput: { flex: 1, height: 46, paddingHorizontal: 12, color: DewDesign.colors.ink, fontSize: 14 },
  primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: DewDesign.colors.forest, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
