import AppIcon from '@/components/app-icon';
import AppBottomNav from '@/components/app-bottom-nav';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';

const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'info@ptsmination.com';

export default function LegalScreen() {
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t(language, 'goBack')}>
            <AppIcon name="chevron.left" size={17} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.ink} />
            <Text style={[styles.backText, isDark && styles.darkInk]}>{t(language, 'back')}</Text>
          </Pressable>
          <Text style={styles.eyebrow}>DAILY DEW DEVOTIONAL</Text>
          <Text style={[styles.title, isDark && styles.darkInk]}>{t(language, 'aboutSupport')}</Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>A quiet place for Scripture, meditation, prayer, and reflection.</Text>

          {/* 1. ABOUT THE APP */}
          <View style={[styles.card, isDark && styles.darkCard]}>
            <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'aboutApp')}</Text>
            <Text style={[styles.body, isDark && styles.darkBody]}>
              Daily Dew Devotional turns the monthly devotional into an interactive daily rhythm. Read, listen, reflect, pray, save meaningful moments, and continue your journey wherever you are.
            </Text>
          </View>

          {/* 2. PRAYER OF SALVATION */}
          <View style={[styles.card, styles.prayerCard, isDark && styles.darkPrayerCard]}>
            <View style={styles.prayerHeadingRow}>
              <AppIcon name="hands.sparkles.fill" size={18} tintColor={DewDesign.colors.forest} />
              <Text style={[styles.sectionTitle, styles.prayerTitle, isDark && styles.darkInk]}>
                {language === 'fr' ? 'PRIÈRE DE SALUT' : 'PRAYER OF SALVATION'}
              </Text>
            </View>
            <Text style={[styles.body, styles.prayerBody, isDark && styles.darkBody]}>
              {language === 'fr'
                ? 'Dieu de Miséricorde et de Vérité, je reconnais que je suis un pécheur et je viens à toi au Nom de Jésus-Christ, ton Fils bien-aimé. Ta Parole déclare : « Car quiconque invoquera le nom du Seigneur sera sauvé » (Romains 10:13). Je crois dans mon cœur que Jésus-Christ a été baptisé, est mort et est ressuscité pour ma rédemption et ma justification. Je demande à Jésus de venir dans ma vie et d’être le Seigneur et Sauveur de ma vie. Par la foi, je reçois maintenant la vie éternelle dans mon esprit. Je déclare que je suis sauvé ; je suis né de nouveau ; je suis un enfant de Dieu. Mon passé est révolu, et j’ai maintenant une nouvelle vie en Christ, au Nom de Jésus. AMEN.'
                : 'God of Mercy and Truth; I acknowledge that I am a sinner and I come to you in the Name of Jesus Christ your beloved Son. Your Word declares, “For whoever calls on the name of The Lord shall be saved” (Romans 10:13). I believe in my heart that Jesus Christ was baptized, died and resurrected for my redemption and justification. I ask Jesus to come into my life and be The Lord and Saviour of my life. By faith, I receive Eternal life now into my spirit. I declare I am saved; I am born again; I am a child of God. My past is over, and I have a new life now in Christ, in Jesus’ Name. AMEN.'}
            </Text>
          </View>

          {/* 3. CONTACT SUPPORT EMAIL */}
          <Pressable
            onPress={() => Linking.openURL(`mailto:${supportEmail}`)}
            style={styles.supportButton}
            accessibilityRole="button"
            accessibilityLabel={t(language, 'contactSupport')}>
            <AppIcon name="envelope" size={17} tintColor={DewDesign.colors.white} />
            <View style={styles.supportCopy}>
              <Text style={styles.supportTitle}>{t(language, 'contactSupport')}</Text>
              <Text style={styles.supportEmail}>{supportEmail}</Text>
            </View>
            <AppIcon name="chevron.right" size={16} tintColor={DewDesign.colors.white} />
          </Pressable>

          <Text style={[styles.version, isDark && styles.darkMuted]}>Daily Dew Devotional · Version 1.0</Text>
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
  content: { paddingHorizontal: DewDesign.spacing.screen, paddingBottom: 110 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 24 },
  backText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
  eyebrow: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 34, fontWeight: '700', marginTop: 8 },
  subtitle: { color: DewDesign.colors.body, fontSize: 15, lineHeight: 23, marginTop: 8, marginBottom: 24 },
  card: { backgroundColor: DewDesign.colors.surface, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: DewDesign.colors.line },
  sectionTitle: { color: DewDesign.colors.ink, fontSize: 17, fontWeight: '900', marginBottom: 8 },
  body: { color: DewDesign.colors.body, fontSize: 14, lineHeight: 22 },
  prayerCard: { backgroundColor: DewDesign.colors.forestSoft, borderLeftWidth: 4, borderLeftColor: DewDesign.colors.forest, padding: 20 },
  darkPrayerCard: { backgroundColor: DewDesign.colors.darkSurfaceMuted, borderLeftColor: DewDesign.colors.forest },
  prayerHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  prayerTitle: { color: DewDesign.colors.forest, fontSize: 14, fontWeight: '900', letterSpacing: 1.2, marginBottom: 0 },
  prayerBody: { fontFamily: 'serif', fontSize: 15, lineHeight: 25, fontStyle: 'italic' },
  supportButton: { backgroundColor: DewDesign.colors.forest, borderRadius: 14, minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 8 },
  supportCopy: { flex: 1 },
  supportTitle: { color: DewDesign.colors.white, fontSize: 14, fontWeight: '900' },
  supportEmail: { color: DewDesign.colors.forestSoft, fontSize: 12, marginTop: 3 },
  version: { color: DewDesign.colors.muted, textAlign: 'center', fontSize: 11, marginTop: 18, marginBottom: 6 },
});
