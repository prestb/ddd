import AppIcon from '@/components/app-icon';
import AppBottomNav from '@/components/app-bottom-nav';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

const presetAmounts = ['1000', '2500', '5000', '10000'];
type MobileMoneyProvider = 'mtn' | 'orange';

export default function DonateScreen() {
  const { language, themeMode } = useSettings();
  const [amount, setAmount] = useState('2500');
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState<MobileMoneyProvider>('mtn');
  const [isLoading, setIsLoading] = useState(false);
  const [transId, setTransId] = useState<string | null>(null);
  const isDark = themeMode === 'dark';

  const continueToPayment = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 100) {
      Alert.alert(t(language, 'donate'), language === 'fr' ? 'Le montant minimum est de 100 XAF.' : 'The minimum donation is 100 XAF.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      Alert.alert(t(language, 'donate'), language === 'fr' ? 'Saisissez un numéro Mobile Money valide (9 chiffres).' : 'Enter a valid 9-digit Mobile Money phone number.');
      return;
    }
    if (!supabase) {
      Alert.alert(t(language, 'donate'), t(language, 'donationUnavailable'));
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-donation', {
        body: { amount: numericAmount, phone: phone.trim(), provider },
      });

      if (error || !data?.transId) {
        let message = error?.message ?? t(language, 'donationUnavailable');
        if (error && 'context' in error && error.context?.json) {
          try {
            const details = await error.context.json();
            message = details?.error ?? message;
          } catch { /* Keep SDK error */ }
        }
        Alert.alert(t(language, 'donate'), message);
        return;
      }

      setTransId(data.transId);
    } catch (err) {
      Alert.alert(t(language, 'donate'), err instanceof Error ? err.message : t(language, 'donationUnavailable'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <AppIcon name="chevron.left" size={17} tintColor={isDark ? '#F5F1E9' : DewDesign.colors.ink} />
            <Text style={[styles.backText, isDark && styles.darkInk]}>{language === 'fr' ? 'Retour' : 'Back'}</Text>
          </Pressable>

          <Text style={styles.kicker}>{language === 'fr' ? 'GÉNÉROSITÉ' : 'GENEROSITY'}</Text>
          <Text style={[styles.title, isDark && styles.darkInk]}>{t(language, 'supportMinistry')}</Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>{t(language, 'donationIntro')}</Text>

          {transId ? (
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', padding: 22 }]}>
              <AppIcon name="checkmark.circle.fill" size={44} tintColor={DewDesign.colors.forest} />
              <Text style={[styles.pendingTitle, isDark && styles.darkInk]}>
                {language === 'fr' ? 'Demande de don envoyée !' : 'Donation Request Sent!'}
              </Text>
              <Text style={[styles.pendingBody, isDark && styles.darkBody]}>
                {language === 'fr'
                  ? 'Veuillez consulter votre téléphone et composer votre code secret USSD pour valider votre don.'
                  : 'Please check your mobile phone for the USSD prompt from your Mobile Money provider and enter your PIN to authorize.'}
              </Text>
              <Text style={styles.transRef}>
                {`${language === 'fr' ? 'Référence' : 'Reference'}: ${transId}`}
              </Text>
              <Pressable onPress={() => setTransId(null)} style={[styles.primary, { width: '100%', marginTop: 18 }]}>
                <Text style={styles.primaryText}>{language === 'fr' ? 'Nouveau don' : 'Make Another Donation'}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.card, isDark && styles.darkCard]}>
              <Text style={[styles.label, isDark && styles.darkInk]}>{t(language, 'donationAmount')} (XAF)</Text>
              <View style={styles.presets}>
                {presetAmounts.map((value) => (
                  <Pressable key={value} onPress={() => setAmount(value)} style={[styles.preset, amount === value && styles.presetActive]}>
                    <Text style={[styles.presetText, amount === value && styles.presetTextActive]}>{Number(value).toLocaleString()}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                placeholder={t(language, 'customAmount')}
                placeholderTextColor={isDark ? '#AEB9B1' : '#899189'}
                style={[styles.input, isDark && styles.darkInput]}
              />

              <Text style={[styles.label, isDark && styles.darkInk, { marginTop: 16 }]}>{t(language, 'selectMobileMoney')}</Text>
              <View style={styles.providerRow}>
                <Pressable
                  onPress={() => setProvider('mtn')}
                  style={[styles.providerBtn, provider === 'mtn' && styles.providerBtnActive]}>
                  <Text style={[styles.providerText, provider === 'mtn' && styles.providerTextActive]}>MTN MoMo</Text>
                </Pressable>
                <Pressable
                  onPress={() => setProvider('orange')}
                  style={[styles.providerBtn, provider === 'orange' && styles.providerBtnActive]}>
                  <Text style={[styles.providerText, provider === 'orange' && styles.providerTextActive]}>Orange Money</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, isDark && styles.darkInk, { marginTop: 14 }]}>{t(language, 'phoneNumberLabel')}</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="6XXXXXXXX"
                placeholderTextColor={isDark ? '#AEB9B1' : '#899189'}
                style={[styles.input, isDark && styles.darkInput]}
              />

              <Pressable disabled={isLoading} onPress={continueToPayment} style={[styles.primary, isLoading && styles.primaryDisabled]}>
                <AppIcon name="heart" size={17} tintColor="#FFFFFF" />
                <Text style={styles.primaryText}>{isLoading ? (language === 'fr' ? 'Envoi...' : 'Sending...') : t(language, 'continueDonation')}</Text>
              </Pressable>
              <Text style={[styles.note, isDark && styles.darkBody]}>{t(language, 'donationNote')}</Text>
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
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  preset: { minHeight: 42, flex: 1, minWidth: '22%', borderRadius: 10, backgroundColor: DewDesign.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  presetActive: { backgroundColor: DewDesign.colors.forest },
  presetText: { color: DewDesign.colors.forest, fontSize: 12, fontWeight: '900' },
  presetTextActive: { color: DewDesign.colors.white },
  input: { minHeight: 48, borderWidth: 1, borderColor: DewDesign.colors.line, borderRadius: 10, paddingHorizontal: 12, color: DewDesign.colors.ink, marginTop: 8 },
  darkInput: { backgroundColor: '#17231D', borderColor: '#49614D', color: '#F5F1E9' },
  providerRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  providerBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: DewDesign.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  providerBtnActive: { backgroundColor: DewDesign.colors.forest },
  providerText: { color: DewDesign.colors.body, fontSize: 12, fontWeight: '800' },
  providerTextActive: { color: '#FFFFFF' },
  primary: { minHeight: 48, borderRadius: 11, backgroundColor: DewDesign.colors.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 18 },
  primaryDisabled: { opacity: 0.65 },
  primaryText: { color: DewDesign.colors.white, fontSize: 13, fontWeight: '900' },
  note: { color: DewDesign.colors.body, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 13 },
  pendingTitle: { fontSize: 20, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  pendingBody: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  transRef: { fontSize: 12, fontWeight: '700', color: DewDesign.colors.terracotta, marginTop: 12 },
  darkInk: { color: '#F5F1E9' },
  darkBody: { color: '#C6D0C8' },
});
