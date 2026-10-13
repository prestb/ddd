import SymbolView from '@/components/app-icon';
import AppBottomNav from '@/components/app-bottom-nav';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { classifyAppError } from '@/lib/error-utils';

type PaymentStep = 'select' | 'review' | 'pending' | 'success' | 'failed';
type MobileMoneyProvider = 'mtn' | 'orange';

function normalizeCameroonPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('6')) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith('2376')) {
    return digits.slice(3);
  }
  if (digits.length === 10 && digits.startsWith('06')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Isolated Wallet Funding Service Boundary
 * Connects exclusively to the financial backend (create-wallet-deposit & payment_transactions).
 * Zero dependency on create-donation or donations table.
 */
export const walletFundingService = {
  async createDeposit({
    amount,
    phone,
    provider,
    email,
  }: {
    amount: number;
    phone: string;
    provider: MobileMoneyProvider;
    email: string;
  }): Promise<{ transId: string; externalReference: string; amount: number; phone: string }> {
    if (!supabase) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.functions.invoke('create-wallet-deposit', {
      body: { amount, phone, provider, email },
    });

    if (error || !data?.transId) {
      throw error ?? new Error('Payment initiation failed');
    }

    return {
      transId: data.transId,
      externalReference: data.externalReference ?? `deposit-${Date.now()}`,
      amount: data.amount ?? amount,
      phone: data.phone ?? phone,
    };
  },

  async verifyDepositStatus(transId: string): Promise<{
    status: 'pending' | 'successful' | 'failed' | 'cancelled' | 'verification_error';
    amount?: number;
  }> {
    if (!supabase) {
      return { status: 'verification_error' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-wallet-deposit-status', {
        body: { transId },
      });

      if (!error && data?.status) {
        return {
          status: data.status,
          amount: data.amount,
        };
      }
    } catch {
      // Verification error
    }

    return { status: 'verification_error' };
  },

  async getUserBalance(userId: string): Promise<number | null> {
    if (supabase && userId) {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data?.balance !== undefined) {
        return data.balance;
      }
    }
    return null;
  },
};

export default function AddFundsScreen() {
  const { session } = useAuth();
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';

  const [step, setStep] = useState<PaymentStep>('select');
  const [selectedAmount, setSelectedAmount] = useState<number>(5000);
  const [customAmountText, setCustomAmountText] = useState<string>('');
  const [provider, setProvider] = useState<MobileMoneyProvider>('mtn');
  const [phone, setPhone] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transId, setTransId] = useState<string | null>(null);
  const [updatedBalance, setUpdatedBalance] = useState<number | null>(null);
  const [verifiedAmount, setVerifiedAmount] = useState<number | null>(null);
  const [balanceUnavailable, setBalanceUnavailable] = useState(false);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);

  const isCheckingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    if (!session) {
      router.replace('/auth');
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [session]);

  const amount = customAmountText ? (parseInt(customAmountText, 10) || 0) : selectedAmount;

  const handleSelectPreset = (val: number) => {
    setSelectedAmount(val);
    setCustomAmountText('');
  };

  const handleProceedToReview = () => {
    if (!amount || amount < 100 || amount > 10000000) {
      setErrorMessage(language === 'fr' ? 'Saisissez un montant valide entre 100 et 10 000 000 XAF.' : 'Enter a valid amount between 100 and 10,000,000 XAF.');
      return;
    }
    const cleanPhone = normalizeCameroonPhone(phone);
    if (cleanPhone.length !== 9 || !cleanPhone.startsWith('6')) {
      setErrorMessage(language === 'fr' ? 'Saisissez un numéro Mobile Money valide (9 chiffres).' : 'Enter a valid 9-digit Mobile Money phone number.');
      return;
    }
    setPhone(cleanPhone); // Save canonical 9-digit format
    setErrorMessage(null);
    setStep('review');
  };

  const handleInitiatePayment = async () => {
    setBusy(true);
    setErrorMessage(null);
    setPollingTimedOut(false);

    try {
      const deposit = await walletFundingService.createDeposit({
        amount,
        phone: phone.trim(),
        provider,
        email: session?.user.email ?? '',
      });

      if (isMountedRef.current) {
        setTransId(deposit.transId);
        setStep('pending');
      }
    } catch (err) {
      if (isMountedRef.current) {
        const classified = classifyAppError(err, 'payment');
        setErrorMessage(t(language, classified.messageKey));
      }
    } finally {
      if (isMountedRef.current) {
        setBusy(false);
      }
    }
  };

  const handleVerifyBackendStatus = useCallback(async () => {
    if (!transId || isCheckingRef.current) return;
    isCheckingRef.current = true;
    if (isMountedRef.current) setBusy(true);

    try {
      const result = await walletFundingService.verifyDepositStatus(transId);

      if (!isMountedRef.current) return;

      if (result.status === 'successful') {
        if (result.amount) setVerifiedAmount(result.amount);
        const freshBalance = session?.user.id
          ? await walletFundingService.getUserBalance(session.user.id)
          : null;

        if (!isMountedRef.current) return;

        if (typeof freshBalance === 'number') {
          setUpdatedBalance(freshBalance);
          setBalanceUnavailable(false);
        } else {
          setUpdatedBalance(null);
          setBalanceUnavailable(true);
        }
        setErrorMessage(null);
        setStep('success');
      } else if (result.status === 'failed' || result.status === 'cancelled') {
        setErrorMessage(null);
        setStep('failed');
      } else if (result.status === 'verification_error') {
        setErrorMessage(
          language === 'fr'
            ? 'Le statut du paiement est temporairement indisponible. Nous continuerons à vérifier automatiquement.'
            : 'Payment status is temporarily unavailable. We’ll keep checking automatically.'
        );
      } else {
        // Still pending
        setErrorMessage(
          language === 'fr'
            ? 'Demande de rechargement envoyée ! Saisissez votre code secret USSD sur votre téléphone pour valider le paiement.'
            : 'Payment request sent! Please check your mobile phone for the USSD prompt and enter your PIN to authorize.'
        );
      }
    } catch {
      if (isMountedRef.current) {
        setErrorMessage(
          language === 'fr'
            ? 'Le statut du paiement est temporairement indisponible. Nous continuerons à vérifier automatiquement.'
            : 'Payment status is temporarily unavailable. We’ll keep checking automatically.'
        );
      }
    } finally {
      isCheckingRef.current = false;
      if (isMountedRef.current) setBusy(false);
    }
  }, [language, session, transId]);

  // Automatic Controlled Status Polling when step === 'pending'
  useEffect(() => {
    if (step !== 'pending' || !transId) return;

    let active = true;
    let pollCount = 0;
    const maxPolls = 20; // Poll every 3 seconds for 60 seconds

    handleVerifyBackendStatus();

    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount >= maxPolls || !active) {
        clearInterval(interval);
        if (active && isMountedRef.current) {
          setPollingTimedOut(true);
        }
        return;
      }
      if (active) {
        await handleVerifyBackendStatus();
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [step, transId, handleVerifyBackendStatus]);

  if (!session) {
    return (
      <View style={[styles.screen, isDark && styles.darkScreen]}>
        <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
          <DailyDewHeader />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <SymbolView name="lock" size={28} tintColor={DewDesign.colors.forest} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? DewDesign.colors.darkInk : DewDesign.colors.ink, marginTop: 12 }}>
              {language === 'fr' ? 'Connexion requise' : 'Sign-in required'}
            </Text>
            <Text style={{ fontSize: 14, color: isDark ? DewDesign.colors.darkMuted : DewDesign.colors.body, textAlign: 'center', marginTop: 8, marginBottom: 20 }}>
              {language === 'fr' ? 'Veuillez vous connecter pour recharger votre solde.' : 'Please sign in to add funds to your balance.'}
            </Text>
            <Pressable onPress={() => router.push('/auth')} style={[styles.primaryButton, { paddingHorizontal: 24 }]}>
              <Text style={styles.primaryButtonText}>{language === 'fr' ? 'Se connecter' : 'Sign in'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => (step === 'select' ? router.back() : setStep('select'))}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t(language, 'goBack')}>
            <SymbolView name="chevron.left" size={17} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.ink} />
            <Text style={[styles.backText, isDark && styles.darkInk]}>{t(language, 'back')}</Text>
          </Pressable>

          <Text style={styles.eyebrow}>DAILY DEW</Text>
          <Text style={[styles.title, isDark && styles.darkInk]}>{t(language, 'addFundsToBalance')}</Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>
            {language === 'fr' ? 'Rechargez votre solde via Mobile Money pour l’abonnement.' : 'Fund your account balance securely via Mobile Money.'}
          </Text>

          {/* STEP 1: AMOUNT & PROVIDER SELECTION */}
          {step === 'select' && (
            <>
              {/* Preset Amounts */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'chooseAmount')}</Text>
              </View>
              <View style={styles.presetRow}>
                {[500, 1000, 2500, 5000, 10000].map((val) => (
                  <Pressable
                    key={val}
                    onPress={() => handleSelectPreset(val)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedAmount === val && !customAmountText }}
                    style={[
                      styles.presetPill,
                      isDark && styles.darkCard,
                      selectedAmount === val && !customAmountText && styles.presetPillActive,
                    ]}>
                    <Text
                      style={[
                        styles.presetText,
                        isDark && styles.darkInk,
                        selectedAmount === val && !customAmountText && styles.presetTextActive,
                      ]}>
                      {`${val.toLocaleString()} XAF`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Custom Amount Input */}
              <View style={[styles.inputCard, isDark && styles.darkCard]}>
                <Text style={styles.cardLabel}>{language === 'fr' ? 'MONTANT PERSONNALISÉ' : 'CUSTOM AMOUNT'}</Text>
                <View style={styles.amountInputRow}>
                  <TextInput
                    value={customAmountText}
                    onChangeText={setCustomAmountText}
                    placeholder={`${selectedAmount}`}
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                    keyboardType="number-pad"
                    style={[styles.amountInput, isDark && styles.darkInk]}
                  />
                  <Text style={styles.currencyBadge}>XAF</Text>
                </View>
              </View>

              {/* Mobile Money Provider Selection */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'selectMobileMoney')}</Text>
              </View>
              <View style={styles.providerRow}>
                <Pressable
                  onPress={() => setProvider('mtn')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: provider === 'mtn' }}
                  style={[
                    styles.providerCard,
                    isDark && styles.darkCard,
                    provider === 'mtn' && styles.providerCardActive,
                  ]}>
                  <View style={[styles.providerDot, provider === 'mtn' && styles.providerDotActive]} />
                  <Text style={[styles.providerTitle, isDark && styles.darkInk]}>MTN MoMo</Text>
                  <Text style={[styles.providerMeta, isDark && styles.darkMuted]}>MTN Mobile Money</Text>
                </Pressable>

                <Pressable
                  onPress={() => setProvider('orange')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: provider === 'orange' }}
                  style={[
                    styles.providerCard,
                    isDark && styles.darkCard,
                    provider === 'orange' && styles.providerCardActive,
                  ]}>
                  <View style={[styles.providerDot, provider === 'orange' && styles.providerDotActive]} />
                  <Text style={[styles.providerTitle, isDark && styles.darkInk]}>Orange Money</Text>
                  <Text style={[styles.providerMeta, isDark && styles.darkMuted]}>Orange Cameroun</Text>
                </Pressable>
              </View>

              {/* Phone Input */}
              <View style={[styles.inputCard, isDark && styles.darkCard, { marginTop: 12 }]}>
                <Text style={styles.cardLabel}>{t(language, 'phoneNumberLabel')}</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="6XXXXXXXX"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                  keyboardType="phone-pad"
                  style={[styles.phoneInput, isDark && styles.darkInk]}
                />
              </View>

              {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

              <Pressable
                onPress={handleProceedToReview}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'reviewPayment')}>
                <Text style={styles.primaryButtonText}>{t(language, 'reviewPayment')}</Text>
                <SymbolView name="arrow.right" size={16} tintColor="#FFFFFF" />
              </Pressable>
            </>
          )}

          {/* STEP 2: REVIEW & CONFIRM */}
          {step === 'review' && (
            <View style={[styles.reviewCard, isDark && styles.darkCard]}>
              <Text style={styles.cardLabel}>{t(language, 'reviewPayment')}</Text>

              <View style={styles.reviewRow}>
                <Text style={[styles.reviewLabel, isDark && styles.darkMuted]}>{language === 'fr' ? 'Montant' : 'Amount'}</Text>
                <Text style={[styles.reviewValue, isDark && styles.darkInk]}>{`${amount.toLocaleString()} XAF`}</Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={[styles.reviewLabel, isDark && styles.darkMuted]}>{language === 'fr' ? 'Opérateur' : 'Provider'}</Text>
                <Text style={[styles.reviewValue, isDark && styles.darkInk]}>{provider === 'mtn' ? 'MTN Mobile Money' : 'Orange Money'}</Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={[styles.reviewLabel, isDark && styles.darkMuted]}>{language === 'fr' ? 'Téléphone' : 'Phone'}</Text>
                <Text style={[styles.reviewValue, isDark && styles.darkInk]}>{phone}</Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={[styles.reviewLabel, isDark && styles.darkMuted]}>{language === 'fr' ? 'Destination' : 'Destination'}</Text>
                <Text style={[styles.reviewValue, isDark && styles.darkInk]}>{language === 'fr' ? 'Solde du Compte Daily Dew' : 'Daily Dew Account Balance'}</Text>
              </View>

              {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

              <Pressable
                onPress={handleInitiatePayment}
                disabled={busy}
                style={({ pressed }) => [styles.primaryButton, busy && styles.disabledBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'initiatePayment')}>
                <SymbolView name="creditcard.fill" size={16} tintColor="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  {busy ? t(language, 'working') : t(language, 'initiatePayment')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* STEP 3: PAYMENT PENDING USSD PROMPT (AUTOMATIC STATUS MONITORING) */}
          {step === 'pending' && (
            <View style={[styles.pendingCard, isDark && styles.darkCard]}>
              <View style={styles.pendingIconCircle}>
                <SymbolView name="clock.fill" size={24} tintColor={DewDesign.colors.terracotta} />
              </View>
              <Text style={[styles.pendingTitle, isDark && styles.darkInk]}>{t(language, 'paymentInProgress')}</Text>
              <Text style={[styles.pendingText, isDark && styles.darkBody]}>{t(language, 'ussdInstructions')}</Text>

              {transId ? (
                <View style={styles.refRow}>
                  <Text style={[styles.refLabel, isDark && styles.darkMuted]}>{t(language, 'transactionRef')}</Text>
                  <Text style={[styles.refValue, isDark && styles.darkInk]}>{transId}</Text>
                </View>
              ) : null}

              {pollingTimedOut && (
                <Text style={[styles.balanceNotice, { color: DewDesign.colors.terracotta, fontStyle: 'italic', marginTop: 12 }]}>
                  {language === 'fr'
                    ? 'La vérification automatique est en pause. Votre paiement peut toujours être en cours de traitement. Appuyez sur « Vérifier le statut » pour vérifier à nouveau.'
                    : 'Automatic checking has paused. Your payment may still be processing. Tap “Check Status” to check again.'}
                </Text>
              )}

              {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

              <Pressable
                onPress={handleVerifyBackendStatus}
                disabled={busy}
                style={({ pressed }) => [styles.primaryButton, busy && styles.disabledBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'checkStatus')}>
                <SymbolView name="arrow.clockwise" size={16} tintColor="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  {busy ? t(language, 'working') : t(language, 'checkStatus')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* STEP 4: VERIFIED SUCCESS */}
          {step === 'success' && (
            <View style={[styles.successCard, isDark && styles.darkCard]}>
              <View style={styles.successIconCircle}>
                <SymbolView name="checkmark" size={24} tintColor="#FFFFFF" />
              </View>
              <Text style={[styles.successTitle, isDark && styles.darkInk]}>{t(language, 'paymentSuccessTitle')}</Text>

              <View style={styles.receiptBox}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>{language === 'fr' ? 'Rechargé' : 'Added'}</Text>
                  <Text style={styles.receiptAmount}>{`+${(verifiedAmount ?? amount).toLocaleString()} XAF`}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>{t(language, 'updatedBalance')}</Text>
                  <Text style={styles.receiptBalance}>
                    {updatedBalance !== null
                      ? `${updatedBalance.toLocaleString()} XAF`
                      : language === 'fr'
                      ? 'Indisponible'
                      : 'Unable to load'}
                  </Text>
                </View>
                {balanceUnavailable ? (
                  <Text style={styles.balanceNotice}>
                    {language === 'fr'
                      ? 'Votre paiement a été crédité avec succès, mais votre dernier solde n’a pas pu être chargé. Veuillez rafraîchir pour voir votre solde actuel.'
                      : 'Your payment was credited successfully, but your latest balance could not be loaded. Please refresh to see your current balance.'}
                  </Text>
                ) : null}
                {transId ? (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>{t(language, 'transactionRef')}</Text>
                    <Text style={styles.receiptRef}>{transId}</Text>
                  </View>
                ) : null}
              </View>

              <Pressable
                onPress={() => router.replace('/membership' as any)}
                style={({ pressed }) => [styles.primaryButton, styles.successBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'returnToMembership')}>
                <Text style={styles.primaryButtonText}>{t(language, 'returnToMembership')}</Text>
              </Pressable>
            </View>
          )}

          {/* STEP 5: FAILED / CANCELLED */}
          {step === 'failed' && (
            <View style={[styles.failedCard, isDark && styles.darkCard]}>
              <View style={styles.failedIconCircle}>
                <SymbolView name="xmark" size={24} tintColor={DewDesign.colors.terracotta} />
              </View>
              <Text style={[styles.failedTitle, isDark && styles.darkInk]}>{t(language, 'paymentFailedOrCancelled')}</Text>
              <Text style={[styles.failedText, isDark && styles.darkMuted]}>{t(language, 'noFundsDeducted')}</Text>

              <Pressable
                onPress={() => setStep('select')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'tryAgain')}>
                <Text style={styles.primaryButtonText}>{t(language, 'tryAgain')}</Text>
              </Pressable>
            </View>
          )}

          {/* Donation Separation Note */}
          <View style={[styles.noteBox, isDark && styles.darkNoteBox]}>
            <SymbolView name="heart" size={18} tintColor={DewDesign.colors.terracotta} />
            <Text style={[styles.noteText, isDark && styles.darkBody]}>
              {t(language, 'donationsDistinctNote')}
            </Text>
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
  darkScreen: { backgroundColor: DewDesign.colors.darkCanvas },
  content: { paddingHorizontal: DewDesign.spacing.screen, paddingTop: 12, paddingBottom: 110 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 18 },
  backText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
  eyebrow: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 34, fontWeight: '700', marginTop: 6 },
  subtitle: { color: DewDesign.colors.body, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 22 },
  sectionHeader: { marginTop: 14, marginBottom: 10 },
  sectionTitle: { color: DewDesign.colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  darkCard: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  darkInk: { color: DewDesign.colors.darkInk },
  darkBody: { color: DewDesign.colors.darkBody },
  darkMuted: { color: DewDesign.colors.darkMuted },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  presetPill: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, backgroundColor: DewDesign.colors.surfaceMuted, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: DewDesign.colors.line },
  presetPillActive: { backgroundColor: DewDesign.colors.forest, borderColor: DewDesign.colors.forest },
  presetText: { color: DewDesign.colors.body, fontSize: 12, fontWeight: '800' },
  presetTextActive: { color: '#FFFFFF' },
  inputCard: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 16, borderWidth: 1, borderColor: DewDesign.colors.line },
  cardLabel: { color: DewDesign.colors.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  amountInput: { flex: 1, fontFamily: 'serif', fontSize: 26, fontWeight: '700', color: DewDesign.colors.ink, paddingVertical: 4 },
  currencyBadge: { fontSize: 14, fontWeight: '900', color: DewDesign.colors.terracotta, marginLeft: 8 },
  providerRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  providerCard: { flex: 1, backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 14, borderWidth: 1, borderColor: DewDesign.colors.line },
  providerCardActive: { borderColor: DewDesign.colors.terracotta, borderWidth: 2 },
  providerDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: DewDesign.colors.surfaceMuted, marginBottom: 8 },
  providerDotActive: { backgroundColor: DewDesign.colors.terracotta },
  providerTitle: { fontSize: 14, fontWeight: '800', color: DewDesign.colors.ink },
  providerMeta: { fontSize: 11, color: DewDesign.colors.body, marginTop: 2 },
  phoneInput: { fontFamily: 'serif', fontSize: 20, fontWeight: '700', color: DewDesign.colors.ink, marginTop: 6, paddingVertical: 4 },
  errorText: { color: DewDesign.colors.terracotta, fontSize: 12, marginTop: 10, fontWeight: '700' },
  primaryButton: { height: 50, borderRadius: DewDesign.radius.control, backgroundColor: DewDesign.colors.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 18 },
  disabledBtn: { opacity: 0.6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  reviewCard: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 18, borderWidth: 1, borderColor: DewDesign.colors.line },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DewDesign.colors.surfaceMuted },
  reviewLabel: { fontSize: 13, color: DewDesign.colors.body, fontWeight: '600' },
  reviewValue: { fontSize: 14, color: DewDesign.colors.ink, fontWeight: '800' },
  pendingCard: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: DewDesign.colors.line },
  pendingIconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: DewDesign.colors.terracottaSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  pendingTitle: { fontSize: 20, fontWeight: '800', color: DewDesign.colors.ink, textAlign: 'center' },
  pendingText: { fontSize: 13, lineHeight: 20, color: DewDesign.colors.body, textAlign: 'center', marginTop: 8 },
  refRow: { marginTop: 16, alignItems: 'center' },
  refLabel: { fontSize: 10, fontWeight: '900', color: DewDesign.colors.muted, letterSpacing: 1 },
  refValue: { fontSize: 13, fontWeight: '800', color: DewDesign.colors.ink, marginTop: 2 },
  successCard: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: DewDesign.colors.line },
  successIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: DewDesign.colors.forest, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  successTitle: { fontSize: 22, fontWeight: '800', color: DewDesign.colors.ink, textAlign: 'center' },
  receiptBox: { width: '100%', backgroundColor: DewDesign.colors.forestSoft, borderRadius: 14, padding: 16, marginTop: 16 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  receiptLabel: { fontSize: 12, color: DewDesign.colors.body, fontWeight: '600' },
  receiptAmount: { fontSize: 16, fontWeight: '800', color: DewDesign.colors.forest },
  receiptBalance: { fontSize: 18, fontWeight: '900', color: DewDesign.colors.forest },
  receiptRef: { fontSize: 11, fontWeight: '800', color: DewDesign.colors.body },
  balanceNotice: { fontSize: 11, lineHeight: 16, color: DewDesign.colors.body, marginTop: 8, fontStyle: 'italic', textAlign: 'center' },
  successBtn: { width: '100%', backgroundColor: DewDesign.colors.forest, marginTop: 20 },
  failedCard: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: DewDesign.colors.line },
  failedIconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: DewDesign.colors.terracottaSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  failedTitle: { fontSize: 20, fontWeight: '800', color: DewDesign.colors.ink, textAlign: 'center' },
  failedText: { fontSize: 13, lineHeight: 20, color: DewDesign.colors.body, textAlign: 'center', marginTop: 8 },
  noteBox: { backgroundColor: DewDesign.colors.forestSoft, borderRadius: DewDesign.radius.card, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: DewDesign.colors.forestMuted, marginTop: 18 },
  darkNoteBox: { backgroundColor: DewDesign.colors.darkSurfaceMuted, borderColor: DewDesign.colors.darkLine },
  noteText: { flex: 1, color: DewDesign.colors.body, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.82 },
});
