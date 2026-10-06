import SymbolView from '@/components/app-icon';
import AppBottomNav from '@/components/app-bottom-nav';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { useContent } from '@/context/content-context';
import { classifyAppError } from '@/lib/error-utils';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

type PlanChoice = 'monthly' | 'annual';

export default function MembershipScreen() {
  const { session } = useAuth();
  const { language, themeMode } = useSettings();
  const { refresh: refreshContent } = useContent();
  const isDark = themeMode === 'dark';

  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>('annual');
  const [autoRenew, setAutoRenew] = useState(true);
  const [balance, setBalance] = useState(0); // Authoritative account balance XAF
  const [isPremium, setIsPremium] = useState(false); // Premium active status
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [updatingAutoRenew, setUpdatingAutoRenew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch authoritative user wallet balance & subscription state
  useEffect(() => {
    if (!session || !supabase) {
      setLoadingAccount(false);
      return;
    }
    const client = supabase;
    const userId = session.user.id;
    let cancelled = false;

    async function loadAccountData() {
      try {
        setLoadingAccount(true);
        setAccountError(null);
        const [{ data: walletData }, { data: subData }] = await Promise.all([
          client.from('wallets').select('balance').eq('user_id', userId).maybeSingle(),
          client.from('subscriptions').select('status, expires_at, auto_renew').eq('user_id', userId).maybeSingle(),
        ]);

        if (cancelled) return;
        if (walletData?.balance !== undefined) setBalance(walletData.balance);
        if (subData) {
          setIsPremium(subData.status === 'active');
          setAutoRenew(Boolean(subData.auto_renew));
          if (subData.expires_at) {
            setExpiresAt(new Date(subData.expires_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
          }
        }
      } catch {
        if (!cancelled) {
          setAccountError(language === 'fr' ? 'Impossible de charger les détails du compte.' : 'Could not load account details.');
        }
      } finally {
        if (!cancelled) setLoadingAccount(false);
      }
    }

    loadAccountData();
    return () => { cancelled = true; };
  }, [session, language]);

  const handlePurchaseSubscription = async () => {
    if (!session) {
      router.push('/auth');
      return;
    }

    setBusy(true);
    setMessage(null);

    const targetPlanName = selectedPlan === 'annual' ? 'Annual' : 'Monthly';

    try {
      if (!supabase) {
        throw new Error('Supabase client is unavailable.');
      }

      const idempotencyKey = `purchase-${session.user.id}-${selectedPlan}-${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('purchase-subscription', {
        body: {
          planName: targetPlanName,
          idempotencyKey,
        },
      });

      if (error || !data?.success) {
        let rawErrorMsg = error?.message || data?.error || 'Purchase failed.';
        if (error && 'context' in error && error.context?.json) {
          try {
            const details = await error.context.json();
            rawErrorMsg = details?.error ?? details?.message ?? rawErrorMsg;
          } catch { /* Keep SDK error */ }
        }

        if (rawErrorMsg.includes('INSUFFICIENT_BALANCE') || data?.code === 'INSUFFICIENT_BALANCE') {
          Alert.alert(
            t(language, 'membership'),
            language === 'fr'
              ? 'Solde du compte insuffisant. Veuillez recharger votre solde.'
              : 'Your account balance is insufficient for this plan. Please tap Add Funds to top up.',
            [
              { text: t(language, 'cancel'), style: 'cancel' },
              { text: t(language, 'addFunds'), onPress: () => router.push('/add-funds' as any) },
            ]
          );
        } else {
          const classified = classifyAppError(
            error ?? data?.error ?? data?.message,
            'subscription'
          );
          setMessage(t(language, classified.messageKey));
        }
        return;
      }

      // Authoritative purchase completed
      setIsPremium(true);
      refreshContent();
      if (data?.result?.remaining_balance !== undefined) setBalance(data.result.remaining_balance);
      if (data?.result?.expires_at) {
        setExpiresAt(new Date(data.result.expires_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
      }
      setMessage(language === 'fr' ? 'Abonnement Daily Dew Premium activé avec succès !' : 'Daily Dew Premium membership activated!');
    } catch (err: unknown) {
      const classified = classifyAppError(err, 'subscription');
      setMessage(t(language, classified.messageKey));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (updatingAutoRenew || !session || !supabase) return;
    const targetVal = !autoRenew;
    setUpdatingAutoRenew(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('update-auto-renew-preference', {
        body: { autoRenew: targetVal },
      });

      if (error || !data?.success) {
        setMessage(
          language === 'fr'
            ? "Impossible de mettre à jour le renouvellement automatique. Veuillez réessayer."
            : "We couldn't update auto-renewal. Please try again."
        );
        return;
      }

      setAutoRenew(Boolean(data.autoRenew));
      setMessage(
        language === 'fr'
          ? "Préférence de renouvellement automatique mise à jour."
          : "Auto-renewal preference updated."
      );
    } catch {
      setMessage(
        language === 'fr'
          ? "Impossible de mettre à jour le renouvellement automatique. Veuillez réessayer."
          : "We couldn't update auto-renewal. Please try again."
      );
    } finally {
      setUpdatingAutoRenew(false);
    }
  };

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t(language, 'goBack')}>
            <SymbolView name="chevron.left" size={17} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.ink} />
            <Text style={[styles.backText, isDark && styles.darkInk]}>{t(language, 'back')}</Text>
          </Pressable>

          <Text style={[styles.title, isDark && styles.darkInk]}>{t(language, 'dailyDewPremium')}</Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>{t(language, 'premiumSubtitle')}</Text>

          {loadingAccount ? (
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', paddingVertical: 24 }]}>
              <ActivityIndicator size="small" color={DewDesign.colors.forest} />
              <Text style={[styles.cardBodyText, isDark && styles.darkMuted, { marginTop: 8 }]}>
                {language === 'fr' ? 'Chargement des détails du compte...' : 'Loading account details...'}
              </Text>
            </View>
          ) : accountError ? (
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', paddingVertical: 18 }]}>
              <Text style={[styles.messageText, { marginTop: 0 }]}>{accountError}</Text>
            </View>
          ) : (
            <>
              {/* Membership Status Card */}
              <View style={[styles.statusCard, isDark && styles.darkCard, isPremium && styles.statusCardPremium]}>
                <View style={styles.statusBadgeRow}>
                  <View style={[styles.statusBadge, isPremium && styles.statusBadgeActive]}>
                    <Text style={[styles.statusBadgeText, isPremium && styles.statusBadgeActiveText]}>
                      {isPremium ? 'PREMIUM MEMBER' : t(language, 'freeEdition')}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusInfoGrid}>
                  {/* Account Email */}
                  <View style={styles.statusInfoRow}>
                    <Text style={[styles.statusInfoLabel, isPremium && styles.statusInfoLabelPremium, isDark && !isPremium && styles.darkMuted]}>
                      {language === 'fr' ? 'Courriel :' : 'Account Email:'}
                    </Text>
                    <Text style={[styles.statusInfoValue, isPremium && styles.statusInfoValuePremium, isDark && !isPremium && styles.darkInk]} numberOfLines={1}>
                      {session?.user.email ?? (language === 'fr' ? 'Invité' : 'Guest / Signed Out')}
                    </Text>
                  </View>

                  {/* Account Status */}
                  <View style={styles.statusInfoRow}>
                    <Text style={[styles.statusInfoLabel, isPremium && styles.statusInfoLabelPremium, isDark && !isPremium && styles.darkMuted]}>
                      {language === 'fr' ? 'Statut :' : 'Account Status:'}
                    </Text>
                    <Text style={[styles.statusInfoValue, isPremium && styles.statusInfoValuePremium, isDark && !isPremium && styles.darkInk]}>
                      {isPremium
                        ? (language === 'fr' ? 'Abonnement Actif' : 'Active Subscription')
                        : (language === 'fr' ? 'Édition Gratuite (Jours 1–3)' : 'Free Access (Days 1–3)')}
                    </Text>
                  </View>

                  {/* Membership Duration / Expiration */}
                  <View style={styles.statusInfoRow}>
                    <Text style={[styles.statusInfoLabel, isPremium && styles.statusInfoLabelPremium, isDark && !isPremium && styles.darkMuted]}>
                      {language === 'fr' ? 'Échéance :' : 'Duration / Expires:'}
                    </Text>
                    <Text style={[styles.statusInfoValue, isPremium && styles.statusInfoValuePremium, isDark && !isPremium && styles.darkInk]}>
                      {isPremium
                        ? (expiresAt ? `${language === 'fr' ? 'Valide jusqu’au' : 'Valid until'} ${expiresAt}` : (language === 'fr' ? 'Accès Premium Actif' : 'Active Premium Access'))
                        : (language === 'fr' ? 'Accès Gratuit Permanent' : 'Ongoing Free Access')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Account Balance Card */}
              <View style={[styles.card, isDark && styles.darkCard]}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderIcon}>
                    <SymbolView name="creditcard" size={18} tintColor={DewDesign.colors.terracotta} />
                  </View>
                  <View style={styles.cardHeaderCopy}>
                    <Text style={styles.cardLabel}>{t(language, 'accountBalance')}</Text>
                    <Text style={[styles.balanceValue, isDark && styles.darkInk]}>{`${balance.toLocaleString()} XAF`}</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/add-funds' as any)}
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'addFunds')}
                    style={styles.addFundsBtn}>
                    <SymbolView name="plus" size={14} tintColor="#FFFFFF" />
                    <Text style={styles.addFundsText}>{t(language, 'addFunds')}</Text>
                  </Pressable>
                </View>
                <Text style={[styles.cardBodyText, isDark && styles.darkMuted]}>{t(language, 'accountBalanceNote')}</Text>
              </View>
            </>
          )}

          {/* Plan Choice Cards */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>
              {language === 'fr' ? 'CHOISIR UN PLAN' : 'SELECT MEMBERSHIP PLAN'}
            </Text>
          </View>

          <View style={styles.plansRow}>
            {/* Monthly Plan */}
            <Pressable
              onPress={() => setSelectedPlan('monthly')}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedPlan === 'monthly' }}
              style={[
                styles.planCard,
                isDark && styles.darkCard,
                selectedPlan === 'monthly' && styles.planCardSelected,
              ]}>
              <View style={styles.planBadgeRow}>
                <Text style={[styles.planTitle, isDark && styles.darkInk]}>{t(language, 'monthlyPlan')}</Text>
                {selectedPlan === 'monthly' ? (
                  <SymbolView name="checkmark.circle.fill" size={18} tintColor={DewDesign.colors.terracotta} />
                ) : null}
              </View>
              <Text style={[styles.planPrice, isDark && styles.darkInk]}>{t(language, 'perMonth')}</Text>
              <Text style={[styles.planMeta, isDark && styles.darkMuted]}>
                {language === 'fr' ? 'Accès mensuel flexible' : 'Flexible monthly access'}
              </Text>
            </Pressable>

            {/* Annual Plan */}
            <Pressable
              onPress={() => setSelectedPlan('annual')}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedPlan === 'annual' }}
              style={[
                styles.planCard,
                isDark && styles.darkCard,
                selectedPlan === 'annual' && styles.planCardSelected,
              ]}>
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>{t(language, 'saveAmount')}</Text>
              </View>
              <View style={styles.planBadgeRow}>
                <Text style={[styles.planTitle, isDark && styles.darkInk]}>{t(language, 'annualPlan')}</Text>
                {selectedPlan === 'annual' ? (
                  <SymbolView name="checkmark.circle.fill" size={18} tintColor={DewDesign.colors.terracotta} />
                ) : null}
              </View>
              <Text style={[styles.planPrice, isDark && styles.darkInk]}>{t(language, 'perYear')}</Text>
              <Text style={[styles.planMeta, isDark && styles.darkMuted]}>
                {language === 'fr' ? 'Meilleure valeur pour l’année' : 'Best value for the year'}
              </Text>
            </Pressable>
          </View>

          {/* Auto-Renewal Explanation */}
          <View style={[styles.card, isDark && styles.darkCard, { marginTop: 14 }]}>
            <Pressable
              disabled={updatingAutoRenew}
              onPress={handleToggleAutoRenew}
              style={styles.toggleRow}
              accessibilityRole="switch"
              accessibilityState={{
                checked: autoRenew,
                disabled: updatingAutoRenew,
              }}
              accessibilityLabel={t(language, 'autoRenewTitle')}>
              <View style={styles.toggleCopy}>
                <Text style={styles.cardLabel}>{t(language, 'autoRenewTitle')}</Text>
                <Text style={[styles.toggleTitle, isDark && styles.darkInk]}>
                  {language === 'fr' ? 'Renouvellement automatique' : 'Auto-renew membership'}
                </Text>
              </View>
              {updatingAutoRenew ? (
                <ActivityIndicator size="small" color={DewDesign.colors.forest} />
              ) : (
                <View style={[styles.toggleSwitch, autoRenew && styles.toggleSwitchActive]}>
                  <View style={[styles.toggleKnob, autoRenew && styles.toggleKnobActive]} />
                </View>
              )}
            </Pressable>
            <Text style={[styles.cardBodyText, isDark && styles.darkMuted, { marginTop: 10 }]}>
              {t(language, 'autoRenewExplain')}
            </Text>
          </View>

          {message ? <Text style={styles.messageText}>{message}</Text> : null}

          <Pressable
            onPress={handlePurchaseSubscription}
            disabled={busy}
            style={({ pressed }) => [styles.actionButton, busy && styles.disabledBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t(language, 'selectPlan')}>
            <SymbolView name="sparkles" size={18} tintColor="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {busy ? t(language, 'working') : t(language, 'selectPlan')}
            </Text>
          </Pressable>

          {/* Separate Donation Link Box */}
          <View style={[styles.noteBox, isDark && styles.darkNoteBox]}>
            <SymbolView name="heart" size={18} tintColor={DewDesign.colors.terracotta} />
            <Text style={[styles.noteText, isDark && styles.darkBody]}>
              {t(language, 'donationsDistinctNote')}
            </Text>
            <Pressable
              onPress={() => router.push('/donate')}
              accessibilityRole="button"
              accessibilityLabel={t(language, 'donate')}
              style={styles.noteBtn}>
              <Text style={styles.noteBtnText}>{t(language, 'donate')}</Text>
            </Pressable>
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
  statusCard: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: DewDesign.colors.line },
  statusCardPremium: { backgroundColor: DewDesign.colors.forest, borderColor: DewDesign.colors.forestMuted },
  darkCard: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  darkInk: { color: DewDesign.colors.darkInk },
  darkBody: { color: DewDesign.colors.darkBody },
  darkMuted: { color: DewDesign.colors.darkMuted },
  statusBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  statusBadge: { backgroundColor: DewDesign.colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeActive: { backgroundColor: DewDesign.colors.terracotta },
  statusBadgeText: { color: DewDesign.colors.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statusBadgeActiveText: { color: DewDesign.colors.white },
  statusInfoGrid: { marginTop: 10, gap: 8 },
  statusInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusInfoLabel: { fontSize: 12, color: DewDesign.colors.muted, fontWeight: '600' },
  statusInfoLabelPremium: { color: '#C9D8C7' },
  statusInfoValue: { fontSize: 13, color: DewDesign.colors.ink, fontWeight: '800', textAlign: 'right', flex: 1, marginLeft: 8 },
  statusInfoValuePremium: { color: '#FFFFFF' },
  userEmail: { color: DewDesign.colors.muted, fontSize: 12, fontWeight: '600' },
  statusDesc: { color: DewDesign.colors.body, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: DewDesign.colors.line },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeaderIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: DewDesign.colors.terracottaSoft, alignItems: 'center', justifyContent: 'center' },
  cardHeaderCopy: { flex: 1 },
  cardLabel: { color: DewDesign.colors.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  balanceValue: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 24, fontWeight: '700', marginTop: 2 },
  addFundsBtn: { height: 36, backgroundColor: DewDesign.colors.terracotta, borderRadius: DewDesign.radius.full, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addFundsText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  cardBodyText: { color: DewDesign.colors.body, fontSize: 12, lineHeight: 18, marginTop: 8 },
  sectionHeader: { marginTop: 12, marginBottom: 10 },
  sectionTitle: { color: DewDesign.colors.ink, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  plansRow: { gap: 10 },
  planCard: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 16, borderWidth: 1, borderColor: DewDesign.colors.line, position: 'relative' },
  planCardSelected: { borderColor: DewDesign.colors.terracotta, borderWidth: 2 },
  saveBadge: { position: 'absolute', top: 12, right: 14, backgroundColor: DewDesign.colors.forestSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  saveBadgeText: { color: DewDesign.colors.forest, fontSize: 9, fontWeight: '900' },
  planBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  planTitle: { fontSize: 16, fontWeight: '800', color: DewDesign.colors.ink },
  planPrice: { fontFamily: 'serif', fontSize: 22, fontWeight: '700', color: DewDesign.colors.terracotta, marginBottom: 4 },
  planMeta: { fontSize: 12, color: DewDesign.colors.body },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleCopy: { flex: 1, marginRight: 10 },
  toggleTitle: { fontSize: 15, fontWeight: '800', color: DewDesign.colors.ink, marginTop: 3 },
  toggleSwitch: { width: 46, height: 28, borderRadius: 14, backgroundColor: DewDesign.colors.surfaceMuted, padding: 3, justifyContent: 'center' },
  toggleSwitchActive: { backgroundColor: DewDesign.colors.forest },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  toggleKnobActive: { alignSelf: 'flex-end' },
  messageText: { color: DewDesign.colors.terracotta, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  actionButton: { height: 50, borderRadius: DewDesign.radius.control, backgroundColor: DewDesign.colors.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16, marginBottom: 18 },
  disabledBtn: { opacity: 0.6 },
  actionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  noteBox: { backgroundColor: DewDesign.colors.forestSoft, borderRadius: DewDesign.radius.card, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: DewDesign.colors.forestMuted },
  darkNoteBox: { backgroundColor: DewDesign.colors.darkSurfaceMuted, borderColor: DewDesign.colors.darkLine },
  noteText: { flex: 1, color: DewDesign.colors.body, fontSize: 12, lineHeight: 18 },
  noteBtn: { height: 32, paddingHorizontal: 12, borderRadius: 8, backgroundColor: DewDesign.colors.terracotta, justifyContent: 'center', alignItems: 'center' },
  noteBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.82 },
});
