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
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
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

export default function ReferralScreen() {
  const { session } = useAuth();
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReferralData = useCallback(async () => {
    if (!session || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userId = session.user.id;

      // 1. Fetch user's profile referral code
      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.referral_code) {
        setReferralCode(profile.referral_code);
      } else {
        // Fallback fallback code if trigger hasn't populated yet
        const generated = 'DEW-' + userId.slice(0, 6).toUpperCase();
        setReferralCode(generated);
      }

      // 2. Fetch referrals made by this user
      const { data: referralRows } = await supabase
        .from('referrals')
        .select('id, referral_code, status, reward_amount_xaf, created_at')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      setReferrals((referralRows ?? []) as ReferralItem[]);
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
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>{t(language, 'referralSubtitle')}</Text>

          {loading ? (
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', paddingVertical: 32 }]}>
              <ActivityIndicator size="small" color={DewDesign.colors.forest} />
              <Text style={[styles.metaText, isDark && styles.darkMuted, { marginTop: 10 }]}>{t(language, 'working')}</Text>
            </View>
          ) : (
            <>
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

              {/* Referral History List */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'referralHistory')}</Text>
              </View>

              {referrals.length === 0 ? (
                <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', paddingVertical: 24 }]}>
                  <SymbolView name="person.3" size={24} tintColor={DewDesign.colors.terracotta} />
                  <Text style={[styles.emptyText, isDark && styles.darkMuted, { marginTop: 10, textAlign: 'center' }]}>
                    {t(language, 'noReferralsYet')}
                  </Text>
                </View>
              ) : (
                referrals.map((item) => (
                  <View key={item.id} style={[styles.referralRowCard, isDark && styles.darkCard]}>
                    <View style={styles.referralIconBox}>
                      <SymbolView name="person.crop.circle.badge.plus" size={18} tintColor={DewDesign.colors.forest} />
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={[styles.referralCodeLabel, isDark && styles.darkInk]}>{`Code: ${item.referral_code}`}</Text>
                      <Text style={[styles.referralDateText, isDark && styles.darkMuted]}>
                        {new Date(item.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, item.status === 'rewarded' ? styles.statusRewarded : styles.statusPending]}>
                      <Text style={item.status === 'rewarded' ? styles.statusRewardedText : styles.statusPendingText}>
                        {item.status === 'rewarded' ? t(language, 'referralRewarded') : t(language, 'referralPending')}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </>
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
  darkCard: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
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
  referralRowCard: { backgroundColor: DewDesign.colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: DewDesign.colors.line, flexDirection: 'row', alignItems: 'center' },
  referralIconBox: { width: 38, height: 38, borderRadius: 19, backgroundColor: DewDesign.colors.forestSoft, alignItems: 'center', justifyContent: 'center' },
  referralCodeLabel: { fontSize: 14, fontWeight: '800', color: DewDesign.colors.ink },
  referralDateText: { fontSize: 11, color: DewDesign.colors.body, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPending: { backgroundColor: DewDesign.colors.surfaceMuted },
  statusPendingText: { color: DewDesign.colors.body, fontSize: 10, fontWeight: '800' },
  statusRewarded: { backgroundColor: DewDesign.colors.forestSoft },
  statusRewardedText: { color: DewDesign.colors.forest, fontSize: 10, fontWeight: '900' },
  emptyText: { color: DewDesign.colors.body, fontSize: 13, lineHeight: 20 },
  metaText: { color: DewDesign.colors.body, fontSize: 12 },
  pressed: { opacity: 0.82 },
});
