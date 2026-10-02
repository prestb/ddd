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
  return (
    <View style={[styles.screen, themeMode === 'dark' && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, themeMode === 'dark' && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
            <AppIcon name="chevron.left" size={17} tintColor={DewDesign.colors.ink} />
            <Text style={styles.backText}>{t(language, 'back')}</Text>
          </Pressable>
          <Text style={styles.eyebrow}>DAILY DEW DEVOTIONAL</Text>
          <Text style={[styles.title, themeMode === 'dark' && { color: '#F5F1E9' }]}>{t(language, 'aboutSupport')}</Text>
          <Text style={[styles.subtitle, themeMode === 'dark' && { color: '#C6D0C8' }]}>A quiet place for Scripture, meditation, prayer, and reflection.</Text>

          <View style={[styles.card, themeMode === 'dark' && styles.darkCard]}>
            <Text style={[styles.sectionTitle, themeMode === 'dark' && { color: '#F5F1E9' }]}>{t(language, 'aboutApp')}</Text>
            <Text style={[styles.body, themeMode === 'dark' && { color: '#C6D0C8' }]}>Daily Dew Devotional turns the monthly devotional into an interactive daily rhythm. Read, listen, reflect, pray, save meaningful moments, and continue your journey wherever you are.</Text>
          </View>

          <View style={[styles.card, themeMode === 'dark' && styles.darkCard]}>
            <Text style={[styles.sectionTitle, themeMode === 'dark' && { color: '#F5F1E9' }]}>{t(language, 'privacy')}</Text>
            <Text style={[styles.body, themeMode === 'dark' && { color: '#C6D0C8' }]}>Your reflections, prayers, bookmarks, and progress are stored on your device. When you sign in, this personal data can sync to your account so you can continue across devices. We do not sell personal devotional data.</Text>
          </View>

          <View style={[styles.card, themeMode === 'dark' && styles.darkCard]}>
            <Text style={[styles.sectionTitle, themeMode === 'dark' && { color: '#F5F1E9' }]}>{t(language, 'contentPermissions')}</Text>
            <Text style={[styles.body, themeMode === 'dark' && { color: '#C6D0C8' }]}>Devotional text and Scripture quotations are published with ministry permission. Bible translation usage, editorial review, and monthly content permissions remain the responsibility of the ministry before public release.</Text>
          </View>

          <View style={[styles.card, themeMode === 'dark' && styles.darkCard]}>
            <Text style={[styles.sectionTitle, themeMode === 'dark' && { color: '#F5F1E9' }]}>{t(language, 'terms')}</Text>
            <Text style={[styles.body, themeMode === 'dark' && { color: '#C6D0C8' }]}>This app provides spiritual reading and reflection content. It is not a substitute for pastoral care, professional counselling, or emergency support.</Text>
          </View>

          <Pressable onPress={() => Linking.openURL(`mailto:${supportEmail}`)} style={styles.supportButton}>
            <AppIcon name="envelope" size={17} tintColor={DewDesign.colors.white} />
            <View style={styles.supportCopy}><Text style={styles.supportTitle}>{t(language, 'contactSupport')}</Text><Text style={styles.supportEmail}>{supportEmail}</Text></View>
            <AppIcon name="chevron.right" size={16} tintColor={DewDesign.colors.white} />
          </Pressable>
          <Text style={styles.version}>Daily Dew Devotional · Version 1.0</Text>
        </ScrollView>
        <AppBottomNav />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DewDesign.colors.canvas }, darkScreen: { backgroundColor: '#17231D' }, safeArea: { flex: 1 }, content: { paddingHorizontal: 22, paddingBottom: 30 }, backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 24 }, backText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' }, eyebrow: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 }, title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 34, fontWeight: '700', marginTop: 8 }, subtitle: { color: DewDesign.colors.body, fontSize: 15, lineHeight: 23, marginTop: 8, marginBottom: 24 }, card: { backgroundColor: DewDesign.colors.surface, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: DewDesign.colors.line }, darkCard: { backgroundColor: '#26382D', borderColor: '#49614D' }, sectionTitle: { color: DewDesign.colors.ink, fontSize: 17, fontWeight: '900', marginBottom: 8 }, body: { color: DewDesign.colors.body, fontSize: 14, lineHeight: 22 }, supportButton: { backgroundColor: DewDesign.colors.forest, borderRadius: 14, minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 8 }, supportCopy: { flex: 1 }, supportTitle: { color: DewDesign.colors.white, fontSize: 14, fontWeight: '900' }, supportEmail: { color: DewDesign.colors.forestSoft, fontSize: 12, marginTop: 3 }, version: { color: DewDesign.colors.muted, textAlign: 'center', fontSize: 11, marginTop: 18, marginBottom: 6 }
});
