import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppIcon from '@/components/app-icon';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import DailyDewHeader from '@/components/daily-dew-header';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const { session, signIn, signUp, signOut } = useAuth();
  const { language, themeMode } = useSettings();
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
    if (mode === 'signup' && password !== confirmPassword) { setMessage(language === 'fr' ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.'); return; }
    setBusy(true);
    setMessage('');
    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (result.error) setMessage(result.error);
    else if (result.needsConfirmation) setMessage(t(language, 'checkEmail'));
    else { setPassword(''); setMessage(t(language, 'signedIn')); }
  };

  return (
    <View style={[styles.screen, themeMode === 'dark' && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, themeMode === 'dark' && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>{t(language, 'accountJourney')}</Text>
          <Text style={[styles.title, themeMode === 'dark' && styles.darkInk]}>{session ? t(language, 'yourAccount') : t(language, 'keepJourney')}</Text>
          <Text style={[styles.subtitle, themeMode === 'dark' && styles.darkBody]}>{session ? t(language, 'accountReady') : t(language, 'signInReady')}</Text>

          {session ? (
            <View style={[styles.card, themeMode === 'dark' && styles.darkCard]}>
              <Text style={styles.cardLabel}>{t(language, 'signedInAs')}</Text>
              <Text style={[styles.email, themeMode === 'dark' && styles.darkInk]}>{session.user.email}</Text>
              <Pressable onPress={signOut} style={styles.secondaryButton}><Text style={styles.secondaryText}>{t(language, 'signOut')}</Text></Pressable>
            </View>
          ) : (
            <View style={[styles.card, themeMode === 'dark' && styles.darkCard]}>
              <TextInput value={email} onChangeText={setEmail} placeholder={t(language, 'emailAddress')} placeholderTextColor="#A8ADA7" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
              <View style={styles.passwordRow}><TextInput value={password} onChangeText={setPassword} placeholder={t(language, 'password')} placeholderTextColor="#A8ADA7" secureTextEntry={!showPassword} style={styles.passwordInput} /><Pressable onPress={() => setShowPassword(!showPassword)} accessibilityLabel="Show or hide password"><AppIcon name={showPassword ? 'eye.slash' : 'eye'} size={18} tintColor="#49614D" /></Pressable></View>
              {mode === 'signup' && <View style={styles.passwordRow}><TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder={language === 'fr' ? 'Confirmer le mot de passe' : 'Confirm password'} placeholderTextColor="#A8ADA7" secureTextEntry={!showConfirmPassword} style={styles.passwordInput} /><Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} accessibilityLabel="Show or hide password confirmation"><AppIcon name={showConfirmPassword ? 'eye.slash' : 'eye'} size={18} tintColor="#49614D" /></Pressable></View>}
              <Pressable onPress={submit} disabled={busy} style={styles.primaryButton}><Text style={styles.primaryText}>{busy ? t(language, 'working') : mode === 'signin' ? t(language, 'login') : t(language, 'createAccount')}</Text></Pressable>
              <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }} style={styles.modeButton}>
                <Text style={styles.modeText}>{mode === 'signin' ? t(language, 'newHere') : t(language, 'alreadyAccount')}</Text>
              </Pressable>
              {!!message && <Text style={styles.message}>{message}</Text>}
            </View>
          )}

          <View style={styles.note}><Text style={styles.noteTitle}>{t(language, 'journeyYours')}</Text><Text style={styles.noteText}>{t(language, 'syncAcross')}</Text></View>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>{t(language, 'backToDailyDew')}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F1E9' },
  safeArea: { flex: 1, backgroundColor: '#F5F1E9' },
  darkScreen: { backgroundColor: '#17231D' },
  content: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40 },
  kicker: { color: '#B96A43', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#1E2A24', fontFamily: 'serif', fontSize: 34, fontWeight: '700', marginTop: 5 },
  subtitle: { color: '#5F6B63', fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 24 },
  card: { backgroundColor: '#FFFCF7', borderRadius: 16, borderWidth: 1, borderColor: '#E0DBD0', padding: 17 },
  darkCard: { backgroundColor: '#26382D', borderColor: '#49614D' }, darkInk: { color: '#F5F1E9' }, darkBody: { color: '#C6D0C8' },
  cardLabel: { color: '#B96A43', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  email: { color: '#1E2A24', fontSize: 16, fontWeight: '800', marginTop: 9 },
  input: { height: 48, backgroundColor: '#F5F1E9', borderWidth: 1, borderColor: '#E0DBD0', borderRadius: 10, paddingHorizontal: 12, color: '#1E2A24', fontSize: 14, marginBottom: 10 },
  passwordRow: { minHeight: 48, backgroundColor: '#F5F1E9', borderWidth: 1, borderColor: '#E0DBD0', borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingRight: 12, marginBottom: 10 },
  passwordInput: { flex: 1, height: 46, paddingHorizontal: 12, color: '#1E2A24', fontSize: 14 },
  primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: '#31543F', alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modeButton: { alignItems: 'center', paddingVertical: 13 },
  modeText: { color: '#B96A43', fontSize: 12, fontWeight: '800' },
  message: { color: '#B96A43', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  secondaryButton: { minHeight: 46, borderWidth: 1, borderColor: '#C8D3C4', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  secondaryText: { color: '#31543F', fontSize: 13, fontWeight: '800' },
  note: { backgroundColor: '#E9E7DF', borderRadius: 14, padding: 16, marginTop: 18 },
  noteTitle: { color: '#31543F', fontFamily: 'serif', fontSize: 17, fontWeight: '700' },
  noteText: { color: '#5F6B63', fontSize: 12, lineHeight: 17, marginTop: 5 },
  backButton: { alignItems: 'center', paddingVertical: 18 },
  backText: { color: '#31543F', fontSize: 13, fontWeight: '800' },
});
