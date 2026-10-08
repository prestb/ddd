import AppIcon from '@/components/app-icon';
import AppBottomNav from '@/components/app-bottom-nav';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { useSettings } from '@/context/settings-context';
import { classifyAppError } from '@/lib/error-utils';
import { t } from '@/lib/i18n';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

const presetAmounts = ['1000', '2500', '5000', '10000'];
type MobileMoneyProvider = 'mtn' | 'orange';
type DonationStep = 'form' | 'pending' | 'success' | 'failed';

export default function DonateScreen() {
  const { language, themeMode } = useSettings();
  const [amount, setAmount] = useState('2500');
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState<MobileMoneyProvider>('mtn');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<DonationStep>('form');
  const [transId, setTransId] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-donation', {
        body: { amount: numericAmount, phone: phone.trim(), provider },
      });

      if (error || !data?.transId) {
        const classified = classifyAppError(
          error ?? data?.error ?? data?.message,
          'donation'
        );
        Alert.alert(
          t(language, 'donate'),
          t(language, classified.messageKey)
        );
        return;
      }

      setTransId(data.transId);
      if (data.verificationToken) {
        setVerificationToken(data.verificationToken);
      }
      setStep('pending');
    } catch (err: unknown) {
      const classified = classifyAppError(err, 'donation');
      Alert.alert(
        t(language, 'donate'),
        t(language, classified.messageKey)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyDonationStatus = useCallback(async () => {
    if (!transId || !supabase) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('check-donation-status', {
        body: { transId, verificationToken },
      });

      if (error || !data?.status) {
        setErrorMessage(
          language === 'fr'
            ? "Nous n'avons pas pu vérifier le statut du don pour le moment. Veuillez réessayer."
            : "We couldn't verify the donation status right now. Please try again."
        );
        return;
      }

      if (data.status === 'successful') {
        setErrorMessage(null);
        setStep('success');
      } else if (data.status === 'failed') {
        setErrorMessage(null);
        setStep('failed');
      } else {
        setErrorMessage(
          language === 'fr'
            ? 'Demande de don en cours. Saisissez votre code secret USSD sur votre téléphone pour valider.'
            : 'Donation request pending. Please check your phone for the USSD prompt and enter your PIN.'
        );
      }
    } catch {
      setErrorMessage(
        language === 'fr'
          ? "Nous n'avons pas pu vérifier le statut du don pour le moment. Veuillez réessayer."
          : "We couldn't verify the donation status right now. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [language, transId, verificationToken]);

  // Automatic Controlled Status Polling when step === 'pending'
  useEffect(() => {
    if (step !== 'pending' || !transId) return;

    let active = true;
    let pollCount = 0;
    const maxPolls = 20; // Poll every 3 seconds for 60 seconds

    handleVerifyDonationStatus();

    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount >= maxPolls || !active) {
        clearInterval(interval);
        return;
      }
      await handleVerifyDonationStatus();
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [step, transId, handleVerifyDonationStatus]);

  const resetForm = () => {
    setTransId(null);
    setVerificationToken(null);
    setStep('form');
    setErrorMessage(null);
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

          {/* STEP 1: FORM */}
          {step === 'form' && (
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

          {/* STEP 2: PENDING USSD PROMPT (AUTOMATIC STATUS MONITORING) */}
          {step === 'pending' && (
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', padding: 22 }]}>
              <AppIcon name="clock.fill" size={44} tintColor={DewDesign.colors.terracotta} />
              <Text style={[styles.pendingTitle, isDark && styles.darkInk]}>
                {language === 'fr' ? 'Demande de don envoyée !' : 'Donation Request Sent!'}
              </Text>
              <Text style={[styles.pendingBody, isDark && styles.darkBody]}>
                {language === 'fr'
                  ? 'Veuillez consulter votre téléphone et composer votre code secret USSD pour valider votre don.'
                  : 'Please check your mobile phone for the USSD prompt from your Mobile Money provider and enter your PIN to authorize.'}
              </Text>
              {transId ? (
                <Text style={styles.transRef}>
                  {`${language === 'fr' ? 'Référence' : 'Reference'}: ${transId}`}
                </Text>
              ) : null}

              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

              <Pressable disabled={isLoading} onPress={handleVerifyDonationStatus} style={[styles.primary, { width: '100%', marginTop: 18 }, isLoading && styles.primaryDisabled]}>
                <AppIcon name="arrow.clockwise" size={17} tintColor="#FFFFFF" />
                <Text style={styles.primaryText}>
                  {isLoading ? (language === 'fr' ? 'Vérification...' : 'Checking...') : (language === 'fr' ? 'Vérifier le statut' : 'Check Donation Status')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* STEP 3: VERIFIED THANK YOU NOTICE */}
          {step === 'success' && (
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', padding: 24 }]}>
              <View style={styles.successIconBadge}>
                <AppIcon name="heart.fill" size={32} tintColor="#FFFFFF" />
              </View>
              <Text style={[styles.thankYouHeading, isDark && styles.darkInk]}>
                {language === 'fr' ? 'Merci pour votre généreux soutien.' : 'Thank you for your generous support.'}
              </Text>
              <Text style={[styles.thankYouBody, isDark && styles.darkBody]}>
                {language === 'fr'
                  ? `Votre don de ${Number(amount).toLocaleString()} XAF a été reçu avec succès. Votre générosité contribue au soutien du ministère Daily Dew.`
                  : `Your donation of ${Number(amount).toLocaleString()} XAF has been received successfully. Your generosity helps support the Daily Dew ministry.`}
              </Text>
              {transId ? (
                <Text style={styles.transRef}>
                  {`${language === 'fr' ? 'Référence' : 'Reference'}: ${transId}`}
                </Text>
              ) : null}

              <Pressable onPress={resetForm} style={[styles.primary, { width: '100%', marginTop: 22 }]}>
                <Text style={styles.primaryText}>
                  {language === 'fr' ? 'Faire un autre don' : 'Make Another Donation'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* STEP 4: FAILED */}
          {step === 'failed' && (
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', padding: 22 }]}>
              <AppIcon name="xmark.circle.fill" size={44} tintColor={DewDesign.colors.terracotta} />
              <Text style={[styles.pendingTitle, isDark && styles.darkInk]}>
                {language === 'fr' ? 'Don non validé' : 'Donation Unsuccessful'}
              </Text>
              <Text style={[styles.pendingBody, isDark && styles.darkBody]}>
                {language === 'fr'
                  ? 'Le paiement a été annulé ou a échoué. Aucun fonds n’a été prélevé.'
                  : 'The payment was cancelled or failed. No funds were deducted from your Mobile Money account.'}
              </Text>
              <Pressable onPress={resetForm} style={[styles.primary, { width: '100%', marginTop: 18 }]}>
                <Text style={styles.primaryText}>{language === 'fr' ? 'Réessayer' : 'Try Again'}</Text>
              </Pressable>
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
  thankYouHeading: { fontSize: 22, fontWeight: '800', fontFamily: 'serif', color: DewDesign.colors.ink, textAlign: 'center', marginTop: 14 },
  thankYouBody: { fontSize: 14, lineHeight: 22, color: DewDesign.colors.body, textAlign: 'center', marginTop: 10 },
  successIconBadge: { width: 60, height: 60, borderRadius: 30, backgroundColor: DewDesign.colors.forest, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  errorText: { color: DewDesign.colors.terracotta, fontSize: 12, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  darkInk: { color: '#F5F1E9' },
  darkBody: { color: '#C6D0C8' },
});
