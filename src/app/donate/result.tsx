import AppBottomNav from '@/components/app-bottom-nav';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { useSettings } from '@/context/settings-context';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DonationResultScreen() {
  const { themeMode } = useSettings();
  const isDark = themeMode === 'dark';
  return <View style={[styles.screen, isDark && styles.darkScreen]}><SafeAreaView style={styles.safeArea}>
    <DailyDewHeader />
    <View style={styles.content}>
      <Text style={[styles.kicker, isDark && styles.darkMuted]}>DONATION</Text>
      <Text style={[styles.title, isDark && styles.darkInk]}>Payment submitted</Text>
      <Text style={[styles.body, isDark && styles.darkMuted]}>Thank you for supporting Daily Dew Devotional. Your payment status will be confirmed shortly.</Text>
      <Pressable onPress={() => router.replace('/')} style={styles.button}><Text style={styles.buttonText}>Return home</Text></Pressable>
    </View>
    <AppBottomNav />
  </SafeAreaView></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DewDesign.colors.canvas }, safeArea: { flex: 1 }, darkScreen: { backgroundColor: '#17231D' }, content: { flex: 1, padding: 24, justifyContent: 'center' }, kicker: { color: DewDesign.colors.terracotta, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 }, title: { color: DewDesign.colors.ink, fontSize: 32, fontWeight: '800', marginTop: 10 }, body: { color: DewDesign.colors.body, fontSize: 16, lineHeight: 24, marginTop: 12 }, button: { backgroundColor: DewDesign.colors.forest, minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24 }, buttonText: { color: '#FFFFFF', fontWeight: '900' }, darkInk: { color: '#F5F1E9' }, darkMuted: { color: '#C6D0C8' },
});
