import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppIcon from '@/components/app-icon';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import DailyDewHeader from '@/components/daily-dew-header';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { DewDesign } from '@/constants/design';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const { session, signIn, signUp, signOut } = useAuth();
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
    if (!email.trim() || password.length < 6) {
      setMessage(t(language, 'invalidCredentials'));
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setMessage(t(language, 'passwordsDoNotMatch'));
      return;
    }
    setBusy(true);
    setMessage('');
    const result = mode === 'signin' ? await signIn(email, password, language) : await signUp(email, password, language);
    setBusy(false);
    if (result.error) setMessage(result.error);
    else if (result.needsConfirmation) setMessage(t(language, 'checkEmail'));
    else { setPassword(''); setMessage(t(language, 'signedIn')); }
  };

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>{t(language, 'accountJourney')}</Text>
          <Text style={[styles.title, isDark && styles.darkInk]}>{session ? t(language, 'yourAccount') : t(language, 'keepJourney')}</Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>{session ? t(language, 'accountReady') : t(language, 'signInReady')}</Text>

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
                style={[styles.input, isDark && styles.darkInput]}
                accessibilityRole="search"
                accessibilityLabel={t(language, 'emailAddress')}
              />
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
              <Pressable
                onPress={submit}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={busy ? t(language, 'working') : mode === 'signin' ? t(language, 'login') : t(language, 'createAccount')}
                style={styles.primaryButton}>
                <Text style={styles.primaryText}>
                  {busy ? t(language, 'working') : mode === 'signin' ? t(language, 'login') : t(language, 'createAccount')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}
                accessibilityRole="button"
                style={styles.modeButton}>
                <Text style={styles.modeText}>{mode === 'signin' ? t(language, 'newHere') : t(language, 'alreadyAccount')}</Text>
              </Pressable>
              {!!message && <Text style={styles.message}>{message}</Text>}
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
  primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: DewDesign.colors.forest, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modeButton: { alignItems: 'center', paddingVertical: 13 },
  modeText: { color: DewDesign.colors.terracotta, fontSize: 12, fontWeight: '800' },
  message: { color: DewDesign.colors.terracotta, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  secondaryButton: { minHeight: 46, borderWidth: 1, borderColor: DewDesign.colors.forestMuted, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  secondaryText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
  note: { backgroundColor: DewDesign.colors.surfaceMuted, borderRadius: 14, padding: 16, marginTop: 18 },
  noteTitle: { color: DewDesign.colors.forest, fontFamily: 'serif', fontSize: 17, fontWeight: '700' },
  noteText: { color: DewDesign.colors.body, fontSize: 12, lineHeight: 17, marginTop: 5 },
  backButton: { alignItems: 'center', paddingVertical: 18 },
  backText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
});
