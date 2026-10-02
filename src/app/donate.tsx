import AppIcon from '@/components/app-icon';
import AppBottomNav from '@/components/app-bottom-nav';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

const presetAmounts = ['1000', '2500', '5000', '10000'];

export default function DonateScreen() {
  const { language, themeMode } = useSettings();
  const [amount, setAmount] = useState('2500');
  const [isLoading, setIsLoading] = useState(false);
  const isDark = themeMode === 'dark';

  const continueToPayment = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 500) {
      Alert.alert(t(language, 'donate'), language === 'fr' ? 'Le montant minimum est de 500 XAF.' : 'The minimum donation is 500 XAF.');
      return;
    }
    if (!supabase) {
      Alert.alert(t(language, 'donate'), t(language, 'donationUnavailable'));
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke('create-donation', { body: { amount: numericAmount } });
    setIsLoading(false);
    if (error || !data?.link) {
      let message = error?.message ?? t(language, 'donationUnavailable');
      if (error && 'context' in error && error.context?.json) {
        try {
          const details = await error.context.json();
          message = details?.error ?? message;
        } catch { /* Keep the SDK error when the response is not JSON. */ }
      }
      Alert.alert(t(language, 'donate'), message);
      return;
    }
    await WebBrowser.openAuthSessionAsync(data.link, Linking.createURL('donate/result'));
  };

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} style={styles.back}><AppIcon name="chevron.left" size={17} tintColor={isDark ? '#F5F1E9' : DewDesign.colors.ink} /><Text style={[styles.backText, isDark && styles.darkInk]}>{language === 'fr' ? 'Retour' : 'Back'}</Text></Pressable>
          <Text style={styles.kicker}>{language === 'fr' ? 'GÉNÉROSITÉ' : 'GENEROSITY'}</Text>
          <Text style={[styles.title, isDark && styles.darkInk]}>{t(language, 'supportMinistry')}</Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>{t(language, 'donationIntro')}</Text>
          <View style={[styles.card, isDark && styles.darkCard]}>
            <Text style={[styles.label, isDark && styles.darkInk]}>{t(language, 'donationAmount')} (XAF)</Text>
            <View style={styles.presets}>{presetAmounts.map((value) => <Pressable key={value} onPress={() => setAmount(value)} style={[styles.preset, amount === value && styles.presetActive]}><Text style={[styles.presetText, amount === value && styles.presetTextActive]}>{Number(value).toLocaleString()}</Text></Pressable>)}</View>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder={t(language, 'customAmount')} placeholderTextColor={isDark ? '#AEB9B1' : '#899189'} style={[styles.input, isDark && styles.darkInput]} />
            <Pressable disabled={isLoading} onPress={continueToPayment} style={[styles.primary, isLoading && styles.primaryDisabled]}><AppIcon name="heart" size={17} tintColor="#FFFFFF" /><Text style={styles.primaryText}>{isLoading ? (language === 'fr' ? 'Ouverture...' : 'Opening...') : t(language, 'continueDonation')}</Text></Pressable>
            <Text style={[styles.note, isDark && styles.darkBody]}>{t(language, 'donationNote')}</Text>
          </View>
        </ScrollView>
        <AppBottomNav />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  safeArea: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  darkScreen: { backgroundColor: '#17231D' },
  content: { paddingHorizontal: 22, paddingBottom: 32 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 24 },
  backText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
  kicker: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 34, fontWeight: '700', marginTop: 7 },
  subtitle: { color: DewDesign.colors.body, fontSize: 15, lineHeight: 23, marginTop: 8, marginBottom: 24 },
  card: { backgroundColor: DewDesign.colors.surface, borderRadius: 18, borderWidth: 1, borderColor: DewDesign.colors.line, padding: 17 },
  darkCard: { backgroundColor: '#26382D', borderColor: '#49614D' },
  label: { color: DewDesign.colors.ink, fontSize: 14, fontWeight: '900' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  preset: { minHeight: 42, flex: 1, minWidth: '22%', borderRadius: 10, backgroundColor: DewDesign.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  presetActive: { backgroundColor: DewDesign.colors.forest },
  presetText: { color: DewDesign.colors.forest, fontSize: 12, fontWeight: '900' },
  presetTextActive: { color: DewDesign.colors.white },
  input: { minHeight: 48, borderWidth: 1, borderColor: DewDesign.colors.line, borderRadius: 10, paddingHorizontal: 12, color: DewDesign.colors.ink, marginTop: 13 },
  darkInput: { backgroundColor: '#17231D', borderColor: '#49614D', color: '#F5F1E9' },
  primary: { minHeight: 48, borderRadius: 11, backgroundColor: DewDesign.colors.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 15 },
  primaryDisabled: { opacity: 0.65 },
  primaryText: { color: DewDesign.colors.white, fontSize: 13, fontWeight: '900' },
  note: { color: DewDesign.colors.body, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 13 },
  darkInk: { color: '#F5F1E9' },
  darkBody: { color: '#C6D0C8' },
});
