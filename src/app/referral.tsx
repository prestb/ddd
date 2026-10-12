import SymbolView from '@/components/app-icon';
import AppBottomNav from '@/components/app-bottom-nav';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ReferralItem = {
  id: string;
  referral_code: string;
  status: 'pending' | 'qualified' | 'rewarded';
  reward_amount_xaf: number;
  created_at: string;
};

type WalletTxItem = {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
};

type HistoryFilter = 'all' | 'deposits' | 'withdrawals' | 'transfers' | 'referrals';
type MobileMoneyProvider = 'mtn' | 'orange';

export default function ReferralScreen() {
  const { session } = useAuth();
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [depositBalance, setDepositBalance] = useState(0);
  const [referralBalance, setReferralBalance] = useState(0);
  const [referralPercentage, setReferralPercentage] = useState('10');
  const [transactions, setTransactions] = useState<WalletTxItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('1000');
  const [withdrawProvider, setWithdrawProvider] = useState<MobileMoneyProvider>('mtn');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalMessage, setModalMessage] = useState<string | null>(null);

  const loadReferralData = useCallback(async () => {
    if (!session || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userId = session.user.id;

      // 1. Fetch user's profile referral code & active percentage
      const [{ data: profile }, { data: walletData }, { data: settingsRow }] = await Promise.all([
        supabase.from('profiles').select('referral_code').eq('id', userId).maybeSingle(),
        supabase.from('wallets').select('balance, referral_balance').eq('user_id', userId).maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'referral_percentage').maybeSingle(),
      ]);

      if (profile?.referral_code) {
        setReferralCode(profile.referral_code);
      } else {
        setReferralCode('DEW-' + userId.slice(0, 6).toUpperCase());
      }

      if (walletData) {
        setDepositBalance(walletData.balance ?? 0);
        setReferralBalance(walletData.referral_balance ?? 0);
      }

      if (settingsRow?.value) {
        setReferralPercentage(settingsRow.value);
      }

      // 2. Fetch referrals made by this user
      const { data: referralRows } = await supabase
        .from('referrals')
        .select('id, referral_code, status, reward_amount_xaf, created_at')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      setReferrals((referralRows ?? []) as ReferralItem[]);

      // 3. Fetch wallet transaction logs
      const { data: txRows } = await supabase
        .from('wallet_transactions')
        .select('id, type, amount, description, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      setTransactions((txRows ?? []) as WalletTxItem[]);
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    loadReferralData();
  }, [loadReferralData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReferralData();
  };

  const handleShareInvite = async () => {
    if (!referralCode) return;
    const shareText = t(language, 'inviteShareMessage').replace('{code}', referralCode);
    try {
      await Share.share({
        message: shareText,
        title: t(language, 'referralTitle'),
      });
    } catch {
      // User cancelled share
    }
  };

  const handleExecuteTransfer = async () => {
    if (!supabase || !session) return;
    const numAmount = parseInt(transferAmount, 10);
    if (!numAmount || numAmount < 100) {
      setModalMessage(language === 'fr' ? 'Le montant minimum est de 100 XAF.' : 'Minimum transfer amount is 100 XAF.');
      return;
    }
    if (numAmount > referralBalance) {
      setModalMessage(language === 'fr' ? 'Solde de parrainage insuffisant.' : 'Insufficient referral wallet balance.');
      return;
    }

    setBusy(true);
    setModalMessage(null);
    try {
      const { data, error } = await supabase.rpc('transfer_referral_to_deposit_wallet', {
        p_user_id: session.user.id,
        p_amount_xaf: numAmount,
      });

      if (error || !data?.success) {
        setModalMessage(data?.error ?? (language === 'fr' ? 'Échec du transfert.' : 'Transfer failed.'));
      } else {
        setShowTransferModal(false);
        setTransferAmount('');
        Alert.alert(t(language, 'transferSuccessTitle'), t(language, 'transferSuccessMsg'));
        await loadReferralData();
      }
    } catch {
      setModalMessage(language === 'fr' ? 'Échec du transfert.' : 'Transfer failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleExecuteWithdrawal = async () => {
    if (!supabase || !session) return;
    const numAmount = parseInt(withdrawAmount, 10);
    if (!numAmount || numAmount < 1000) {
      setModalMessage(t(language, 'minWithdrawalNotice'));
      return;
    }
    if (numAmount > referralBalance) {
      setModalMessage(language === 'fr' ? 'Solde de parrainage insuffisant.' : 'Insufficient referral wallet balance.');
      return;
    }
    const cleanPhone = withdrawPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 9 || !cleanPhone.startsWith('6')) {
      setModalMessage(language === 'fr' ? 'Saisissez un numéro Mobile Money valide (9 chiffres).' : 'Enter a valid 9-digit Mobile Money phone number.');
      return;
    }

    setBusy(true);
    setModalMessage(null);
    try {
      const { data, error } = await supabase.rpc('request_wallet_withdrawal', {
        p_user_id: session.user.id,
        p_amount_xaf: numAmount,
        p_provider: withdrawProvider,
        p_phone: cleanPhone,
      });

      if (error || !data?.success) {
        setModalMessage(data?.error ?? (language === 'fr' ? 'Échec du retrait.' : 'Withdrawal request failed.'));
      } else {
        setShowWithdrawModal(false);
        setWithdrawAmount('1000');
        setWithdrawPhone('');
        Alert.alert(t(language, 'withdrawalRequestedTitle'), t(language, 'withdrawalRequestedMsg'));
        await loadReferralData();
      }
    } catch {
      setModalMessage(language === 'fr' ? 'Échec du retrait.' : 'Withdrawal request failed.');
    } finally {
      setBusy(false);
    }
  };

  const filteredTxs = transactions.filter((tx) => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'deposits') return tx.type === 'deposit' || tx.type === 'credit';
    if (historyFilter === 'withdrawals') return tx.type === 'withdrawal_request' || tx.type === 'withdrawal_declined_refund';
    if (historyFilter === 'transfers') return tx.type === 'transfer_to_deposit';
    if (historyFilter === 'referrals') return tx.type === 'referral_credit';
    return true;
  });

  const totalRewardsXaf = referrals
    .filter((r) => r.status === 'rewarded')
    .reduce((sum, r) => sum + (r.reward_amount_xaf || 500), 0);

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
              {language === 'fr' ? 'Veuillez vous connecter pour accéder à votre espace de parrainage.' : 'Please sign in to access your referral dashboard.'}
            </Text>
            <Pressable onPress={() => router.push('/auth')} style={[styles.primaryBtn, { paddingHorizontal: 24 }]}>
              <Text style={styles.primaryBtnText}>{language === 'fr' ? 'Se connecter' : 'Sign in'}</Text>
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
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DewDesign.colors.forest} />}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t(language, 'goBack')}>
            <SymbolView name="chevron.left" size={17} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.ink} />
            <Text style={[styles.backText, isDark && styles.darkInk]}>{t(language, 'back')}</Text>
          </Pressable>

          <Text style={styles.eyebrow}>DAILY DEW</Text>
          <Text style={[styles.title, isDark && styles.darkInk]}>{t(language, 'referralTitle')}</Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>
            {`${t(language, 'referralSubtitle')} (${referralPercentage}% commission)`}
          </Text>

          {loading ? (
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', paddingVertical: 32 }]}>
              <ActivityIndicator size="small" color={DewDesign.colors.forest} />
              <Text style={[styles.metaText, isDark && styles.darkMuted, { marginTop: 10 }]}>{t(language, 'working')}</Text>
            </View>
          ) : (
            <>
              {/* Dual Wallets Card */}
              <View style={[styles.card, isDark && styles.darkCard]}>
                <View style={styles.walletHeaderRow}>
                  <View>
                    <Text style={styles.cardLabel}>{t(language, 'referralWallet')}</Text>
                    <Text style={[styles.balanceValue, { color: DewDesign.colors.forest }]}>
                      {`${referralBalance.toLocaleString()} XAF`}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.cardLabel}>{t(language, 'depositWallet')}</Text>
                    <Text style={[styles.balanceValue, isDark && styles.darkInk, { fontSize: 20 }]}>
                      {`${depositBalance.toLocaleString()} XAF`}
                    </Text>
                  </View>
                </View>

                <View style={styles.walletActionRow}>
                  <Pressable
                    onPress={() => { setModalMessage(null); setShowTransferModal(true); }}
                    style={[styles.actionBtnPill, isDark && styles.darkActionBtnPill]}>
                    <SymbolView name="arrow.left.arrow.right" size={14} tintColor={DewDesign.colors.forest} />
                    <Text style={styles.actionBtnText}>{t(language, 'transferToDeposit')}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => { setModalMessage(null); setShowWithdrawModal(true); }}
                    style={[styles.actionBtnPill, { backgroundColor: DewDesign.colors.terracotta }]}>
                    <SymbolView name="banknote" size={14} tintColor="#FFFFFF" />
                    <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>{t(language, 'withdrawEarnings')}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Referral Code Card */}
              <View style={[styles.card, isDark && styles.darkCard]}>
                <Text style={styles.cardLabel}>{t(language, 'yourReferralCode')}</Text>
                <View style={styles.codeRow}>
                  <Text style={[styles.codeText, isDark && styles.darkInk]}>{referralCode ?? 'DEW-MEMBER'}</Text>
                </View>

                <Pressable
                  onPress={handleShareInvite}
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'inviteFriends')}>
                  <SymbolView name="square.and.arrow.up" size={17} tintColor="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>{t(language, 'inviteFriends')}</Text>
                </Pressable>
              </View>

              {/* Referral Metrics Grid */}
              <View style={styles.metricGrid}>
                <View style={[styles.metricCard, isDark && styles.darkCard]}>
                  <Text style={[styles.metricValue, isDark && styles.darkInk]}>{referrals.length}</Text>
                  <Text style={[styles.metricLabel, isDark && styles.darkMuted]}>{t(language, 'friendsInvited')}</Text>
                </View>
                <View style={[styles.metricCard, isDark && styles.darkCard]}>
                  <Text style={[styles.metricValue, { color: DewDesign.colors.forest }]}>{`${totalRewardsXaf.toLocaleString()} XAF`}</Text>
                  <Text style={[styles.metricLabel, isDark && styles.darkMuted]}>{t(language, 'walletRewardsEarned')}</Text>
                </View>
              </View>

              {/* Filterable History Tabs */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'referralHistory')}</Text>
              </View>

              <View style={styles.filterPillsRow}>
                {(['all', 'deposits', 'withdrawals', 'transfers', 'referrals'] as HistoryFilter[]).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setHistoryFilter(f)}
                    style={[
                      styles.filterPill,
                      isDark && styles.darkCard,
                      historyFilter === f && styles.activeFilterPill,
                    ]}>
                    <Text style={[styles.filterPillText, historyFilter === f && styles.activeFilterPillText]}>
                      {t(language, (f + 'History') as any)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {filteredTxs.length === 0 ? (
                <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', paddingVertical: 24 }]}>
                  <SymbolView name="person.3" size={24} tintColor={DewDesign.colors.terracotta} />
                  <Text style={[styles.emptyText, isDark && styles.darkMuted, { marginTop: 10, textAlign: 'center' }]}>
                    {t(language, 'noReferralsYet')}
                  </Text>
                </View>
              ) : (
                filteredTxs.map((tx) => {
                  const isCredit = tx.type === 'credit' || tx.type === 'referral_credit' || tx.type === 'withdrawal_declined_refund';
                  return (
                    <View key={tx.id} style={[styles.referralRowCard, isDark && styles.darkCard]}>
                      <View style={[styles.referralIconBox, isCredit ? styles.iconCredit : styles.iconDebit]}>
                        <SymbolView
                          name={isCredit ? 'arrow.down.circle' : 'arrow.up.circle'}
                          size={18}
                          tintColor={isCredit ? DewDesign.colors.forest : DewDesign.colors.terracotta}
                        />
                      </View>
                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text style={[styles.referralCodeLabel, isDark && styles.darkInk]} numberOfLines={1}>
                          {tx.description || tx.type.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                        <Text style={[styles.referralDateText, isDark && styles.darkMuted]}>
                          {new Date(tx.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                      <Text style={[styles.txAmountText, isCredit ? styles.amountCredit : styles.amountDebit]}>
                        {`${isCredit ? '+' : '-'}${tx.amount.toLocaleString()} XAF`}
                      </Text>
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>

        {/* Modal 1: Transfer Referral Balance -> Deposit Balance */}
        <Modal visible={showTransferModal} transparent animationType="slide" onRequestClose={() => setShowTransferModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
            <View style={[styles.modalPanel, isDark && styles.darkCard]}>
              <Text style={[styles.modalTitle, isDark && styles.darkInk]}>{t(language, 'transferToDeposit')}</Text>
              <Text style={[styles.modalSubtext, isDark && styles.darkMuted]}>
                {`${language === 'fr' ? 'Solde de parrainage disponible:' : 'Available referral balance:'} ${referralBalance.toLocaleString()} XAF`}
              </Text>

              <Text style={[styles.inputLabel, isDark && styles.darkInk]}>{t(language, 'transferAmountLabel')}</Text>
              <TextInput
                value={transferAmount}
                onChangeText={setTransferAmount}
                placeholder="1000"
                placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                keyboardType="number-pad"
                style={[styles.modalInput, isDark && styles.darkInput]}
              />

              {modalMessage && <Text style={styles.errorText}>{modalMessage}</Text>}

              <View style={styles.modalBtnRow}>
                <Pressable onPress={() => setShowTransferModal(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>{t(language, 'cancel')}</Text>
                </Pressable>

                <Pressable disabled={busy} onPress={handleExecuteTransfer} style={[styles.primaryBtn, { flex: 1 }]}>
                  <Text style={styles.primaryBtnText}>{busy ? t(language, 'working') : t(language, 'transferToDeposit')}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Modal 2: Withdraw Earnings */}
        <Modal visible={showWithdrawModal} transparent animationType="slide" onRequestClose={() => setShowWithdrawModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
            <View style={[styles.modalPanel, isDark && styles.darkCard]}>
              <Text style={[styles.modalTitle, isDark && styles.darkInk]}>{t(language, 'withdrawEarnings')}</Text>
              <Text style={[styles.modalSubtext, isDark && styles.darkMuted]}>{t(language, 'minWithdrawalNotice')}</Text>

              <Text style={[styles.inputLabel, isDark && styles.darkInk]}>{t(language, 'withdrawAmountLabel')}</Text>
              <TextInput
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="1000"
                placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                keyboardType="number-pad"
                style={[styles.modalInput, isDark && styles.darkInput]}
              />

              <Text style={[styles.inputLabel, isDark && styles.darkInk, { marginTop: 12 }]}>{t(language, 'selectMobileMoney')}</Text>
              <View style={styles.providerRow}>
                <Pressable
                  onPress={() => setWithdrawProvider('mtn')}
                  style={[styles.providerBtn, withdrawProvider === 'mtn' && styles.providerBtnActive]}>
                  <Text style={[styles.providerBtnText, withdrawProvider === 'mtn' && styles.providerBtnTextActive]}>MTN MoMo</Text>
                </Pressable>
                <Pressable
                  onPress={() => setWithdrawProvider('orange')}
                  style={[styles.providerBtn, withdrawProvider === 'orange' && styles.providerBtnActive]}>
                  <Text style={[styles.providerBtnText, withdrawProvider === 'orange' && styles.providerBtnTextActive]}>Orange Money</Text>
                </Pressable>
              </View>

              <Text style={[styles.inputLabel, isDark && styles.darkInk, { marginTop: 12 }]}>{t(language, 'phoneNumberLabel')}</Text>
              <TextInput
                value={withdrawPhone}
                onChangeText={setWithdrawPhone}
                placeholder="6XXXXXXXX"
                placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                keyboardType="phone-pad"
                style={[styles.modalInput, isDark && styles.darkInput]}
              />

              {modalMessage && <Text style={styles.errorText}>{modalMessage}</Text>}

              <View style={styles.modalBtnRow}>
                <Pressable onPress={() => setShowWithdrawModal(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>{t(language, 'cancel')}</Text>
                </Pressable>

                <Pressable disabled={busy} onPress={handleExecuteWithdrawal} style={[styles.primaryBtn, { flex: 1, backgroundColor: DewDesign.colors.terracotta }]}>
                  <Text style={styles.primaryBtnText}>{busy ? t(language, 'working') : t(language, 'withdrawEarnings')}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <AppBottomNav />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  safeArea: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  darkScreen: { backgroundColor: DewDesign.colors.darkCanvas },
  darkCard: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  darkInput: { backgroundColor: DewDesign.colors.darkSurfaceMuted, borderColor: DewDesign.colors.darkLine, color: DewDesign.colors.darkInk },
  darkInk: { color: DewDesign.colors.darkInk },
  darkBody: { color: DewDesign.colors.darkBody },
  darkMuted: { color: DewDesign.colors.darkMuted },
  content: { paddingHorizontal: DewDesign.spacing.screen, paddingTop: 12, paddingBottom: 110 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 18 },
  backText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
  eyebrow: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 32, fontWeight: '700', marginTop: 6 },
  subtitle: { color: DewDesign.colors.body, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 22 },
  card: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: DewDesign.colors.line },
  cardLabel: { color: DewDesign.colors.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  walletHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  balanceValue: { fontFamily: 'serif', fontSize: 24, fontWeight: '800', marginTop: 2 },
  walletActionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtnPill: { flex: 1, height: 40, borderRadius: 10, backgroundColor: DewDesign.colors.forestSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  darkActionBtnPill: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  actionBtnText: { color: DewDesign.colors.forest, fontSize: 11, fontWeight: '800' },
  codeRow: { marginTop: 10, marginBottom: 16, backgroundColor: DewDesign.colors.forestSoft, borderRadius: 12, padding: 14, alignItems: 'center' },
  codeText: { fontFamily: 'serif', fontSize: 26, fontWeight: '800', color: DewDesign.colors.forest, letterSpacing: 2 },
  primaryBtn: { height: 48, borderRadius: DewDesign.radius.control, backgroundColor: DewDesign.colors.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  metricGrid: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  metricCard: { flex: 1, backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 16, borderWidth: 1, borderColor: DewDesign.colors.line, alignItems: 'center' },
  metricValue: { fontSize: 24, fontWeight: '900', color: DewDesign.colors.ink },
  metricLabel: { fontSize: 11, fontWeight: '700', color: DewDesign.colors.body, marginTop: 4, textAlign: 'center' },
  sectionHeader: { marginTop: 6, marginBottom: 12 },
  sectionTitle: { color: DewDesign.colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  filterPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: DewDesign.colors.surfaceMuted, borderWidth: 1, borderColor: DewDesign.colors.line },
  filterPillText: { fontSize: 11, color: DewDesign.colors.body, fontWeight: '700' },
  activeFilterPill: { backgroundColor: DewDesign.colors.forest, borderColor: DewDesign.colors.forest },
  activeFilterPillText: { color: '#FFFFFF' },
  referralRowCard: { backgroundColor: DewDesign.colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: DewDesign.colors.line, flexDirection: 'row', alignItems: 'center' },
  referralIconBox: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  iconCredit: { backgroundColor: DewDesign.colors.forestSoft },
  iconDebit: { backgroundColor: DewDesign.colors.terracottaSoft },
  referralCodeLabel: { fontSize: 13, fontWeight: '800', color: DewDesign.colors.ink },
  referralDateText: { fontSize: 11, color: DewDesign.colors.body, marginTop: 2 },
  txAmountText: { fontSize: 14, fontWeight: '900' },
  amountCredit: { color: DewDesign.colors.forest },
  amountDebit: { color: DewDesign.colors.terracotta },
  emptyText: { color: DewDesign.colors.body, fontSize: 13, lineHeight: 20 },
  metaText: { color: DewDesign.colors.body, fontSize: 12 },
  errorText: { color: DewDesign.colors.terracotta, fontSize: 12, fontWeight: '700', marginTop: 10 },
  pressed: { opacity: 0.82 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalPanel: { backgroundColor: DewDesign.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: DewDesign.colors.ink },
  modalSubtext: { fontSize: 12, color: DewDesign.colors.body, marginTop: 4, marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: DewDesign.colors.ink, marginBottom: 6 },
  modalInput: { height: 46, borderWidth: 1, borderColor: DewDesign.colors.line, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, fontWeight: '700' },
  providerRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  providerBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: DewDesign.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  providerBtnActive: { backgroundColor: DewDesign.colors.forest },
  providerBtnText: { fontSize: 12, fontWeight: '800', color: DewDesign.colors.body },
  providerBtnTextActive: { color: '#FFFFFF' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { height: 48, paddingHorizontal: 16, borderRadius: 10, backgroundColor: DewDesign.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: DewDesign.colors.body, fontSize: 13, fontWeight: '800' },
});
