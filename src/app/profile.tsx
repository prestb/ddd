import AppFeedback, { FeedbackType } from '@/components/app-feedback';
import AppIcon from '@/components/app-icon';
import AppBottomNav from '@/components/app-bottom-nav';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { session } = useAuth();
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';

  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('reader');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: FeedbackType; title: string; message: string } | null>(null);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadProfile() {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (active) {
        if (error) {
          setFeedback({
            type: 'error',
            title: language === 'fr' ? 'Erreur de profil' : 'Could not load profile',
            message: language === 'fr'
              ? 'Nous n’avons pas pu charger votre profil pour le moment. Veuillez réessayer.'
              : 'Could not load your profile details right now. Please try again.',
          });
        } else if (data) {
          setDisplayName(data.display_name ?? '');
          setRole(data.role ?? 'reader');
        } else {
          // Missing profile row (data is null, error is null)
          setDisplayName('');
          setRole('reader');
        }
        setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [language, session]);

  const handleSaveProfile = async () => {
    if (!session || !supabase) return;
    const trimmedName = displayName.trim().slice(0, 80);

    setSaving(true);
    setFeedback(null);

    // Strictly write ONLY id and display_name to protect administrative roles
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        display_name: trimmedName,
      }, { onConflict: 'id' });

    setSaving(false);

    if (error) {
      setFeedback({
        type: 'error',
        title: language === 'fr' ? 'Échec de la mise à jour' : 'Profile update failed',
        message: language === 'fr'
          ? 'Nous n’avons pas pu mettre à jour votre profil pour le moment. Veuillez réessayer.'
          : 'Could not update your profile right now. Please try again.',
      });
    } else {
      setDisplayName(trimmedName);
      setFeedback({
        type: 'success',
        title: t(language, 'profileSavedTitle'),
        message: t(language, 'profileSavedMsg'),
      });
    }
  };

  const getRoleLabel = (r: string) => {
    if (r === 'admin') return t(language, 'roleAdmin');
    if (r === 'editor') return t(language, 'roleEditor');
    return t(language, 'roleReader');
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

          <Text style={styles.kicker}>{t(language, 'accountJourney')}</Text>
          <Text style={[styles.title, isDark && styles.darkInk]}>{t(language, 'profileHeading')}</Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>{t(language, 'profileSubtext')}</Text>

          {!session ? (
            /* Signed Out View */
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', paddingVertical: 28 }]}>
              <AppIcon name="person.crop.circle" size={32} tintColor={DewDesign.colors.terracotta} />
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
          ) : loading ? (
            /* Loading State */
            <View style={[styles.card, isDark && styles.darkCard, { alignItems: 'center', paddingVertical: 30 }]}>
              <ActivityIndicator color={DewDesign.colors.forest} size="small" />
              <Text style={[styles.cardBodyText, isDark && styles.darkMuted, { marginTop: 12 }]}>{t(language, 'working')}</Text>
            </View>
          ) : (
            /* Signed In Profile Form */
            <>
              {/* Display Name Section */}
              <View style={[styles.card, isDark && styles.darkCard]}>
                <Text style={[styles.cardLabel, isDark && styles.darkLabel]}>{t(language, 'displayNameLabel')}</Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t(language, 'yourNamePlaceholder')}
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                  maxLength={80}
                  autoCapitalize="words"
                  textContentType="name"
                  style={[styles.input, isDark && styles.darkInput]}
                  accessibilityLabel={t(language, 'displayNameLabel')}
                />
                <Pressable
                  onPress={handleSaveProfile}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={saving ? t(language, 'working') : t(language, 'saveProfileBtn')}
                  style={[styles.primaryButton, saving && styles.disabledButton]}>
                  <Text style={styles.primaryText}>
                    {saving ? t(language, 'working') : t(language, 'saveProfileBtn')}
                  </Text>
                </Pressable>
              </View>

              {/* Account Identity Details Section */}
              <View style={[styles.card, isDark && styles.darkCard]}>
                <Text style={[styles.cardLabel, isDark && styles.darkLabel, { marginBottom: 12 }]}>
                  {language === 'fr' ? 'DÉTAILS DU COMPTE' : 'ACCOUNT DETAILS'}
                </Text>

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, isDark && styles.darkMuted]}>{t(language, 'emailAddress')}</Text>
                  <Text style={[styles.infoValue, isDark && styles.darkInk]} numberOfLines={1}>{session.user.email}</Text>
                </View>

                <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <Text style={[styles.infoLabel, isDark && styles.darkMuted]}>{language === 'fr' ? 'Rôle' : 'Role'}</Text>
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>{getRoleLabel(role)}</Text>
                  </View>
                </View>
              </View>

              {/* Security & Password Section */}
              <View style={[styles.card, isDark && styles.darkCard]}>
                <Text style={[styles.cardLabel, isDark && styles.darkLabel, { marginBottom: 12 }]}>
                  {t(language, 'securitySectionTitle')}
                </Text>

                <Pressable
                  onPress={() => router.push('/change-email' as any)}
                  style={[styles.securityRow, { marginBottom: 10 }]}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'changeEmailBtn')}>
                  <View style={styles.securityIconBox}>
                    <AppIcon name="envelope" size={16} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                  </View>
                  <Text style={[styles.securityRowTitle, isDark && styles.darkInk]}>
                    {t(language, 'changeEmailBtn')}
                  </Text>
                  <AppIcon name="chevron.right" size={16} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                </Pressable>

                <Pressable
                  onPress={() => router.push('/change-password' as any)}
                  style={styles.securityRow}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'changePasswordBtn')}>
                  <View style={styles.securityIconBox}>
                    <AppIcon name="lock" size={16} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                  </View>
                  <Text style={[styles.securityRowTitle, isDark && styles.darkInk]}>
                    {t(language, 'changePasswordBtn')}
                  </Text>
                  <AppIcon name="chevron.right" size={16} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                </Pressable>
              </View>

              {feedback ? (
                <AppFeedback
                  type={feedback.type}
                  title={feedback.title}
                  message={feedback.message}
                  isDark={isDark}
                />
              ) : null}
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
  cardLabel: { color: DewDesign.colors.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  darkLabel: { color: DewDesign.colors.terracotta },
  cardTitle: { fontSize: 18, fontWeight: '800', color: DewDesign.colors.ink },
  cardBodyText: { fontSize: 13, lineHeight: 19, color: DewDesign.colors.body },
  input: { height: 48, backgroundColor: DewDesign.colors.canvas, borderWidth: 1, borderColor: DewDesign.colors.line, borderRadius: 10, paddingHorizontal: 12, color: DewDesign.colors.ink, fontSize: 14, marginBottom: 14 },
  darkInput: { backgroundColor: DewDesign.colors.darkSurfaceMuted, borderColor: DewDesign.colors.darkLine, color: DewDesign.colors.darkInk },
  primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: DewDesign.colors.forest, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DewDesign.colors.line },
  infoLabel: { fontSize: 12, fontWeight: '700', color: DewDesign.colors.muted },
  infoValue: { fontSize: 13, fontWeight: '800', color: DewDesign.colors.ink, flex: 1, textAlign: 'right', marginLeft: 12 },
  rolePill: { backgroundColor: DewDesign.colors.forestSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  rolePillText: { color: DewDesign.colors.forest, fontSize: 11, fontWeight: '900' },
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  securityIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: DewDesign.colors.forestSoft, alignItems: 'center', justifyContent: 'center' },
  securityRowTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: DewDesign.colors.ink },
});
