import SymbolView from '@/components/app-icon';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { localizeDevotion } from '@/data/devotions';
import { useDevotional } from '@/context/devotional-context';
import { useSettings } from '@/context/settings-context';
import { useContent } from '@/context/content-context';
import { DewDesign } from '@/constants/design';
import { greetingForHour, t } from '@/lib/i18n';
import DailyDewHeader from '@/components/daily-dew-header';
import FadeIn from '@/components/fade-in';
import ContentStatus from '@/components/content-status';

export default function HomeScreen() {
  const { language, reminderEnabled, themeMode } = useSettings();
  const isDark = themeMode === 'dark';
  const { devotions, edition, source, error: contentError, loading: contentLoading, refresh: refreshContent } = useContent();

  const calendarDate = new Date();
  const editionIsCurrentMonth = Boolean(edition && edition.year === calendarDate.getFullYear() && edition.month === calendarDate.getMonth() + 1);

  const hasDevotions = devotions.length > 0;
  const todayIndex = hasDevotions && editionIsCurrentMonth
    ? Math.min(Math.max(calendarDate.getDate() - 1, 0), Math.max(devotions.length - 1, 0))
    : 0;

  const today = hasDevotions ? localizeDevotion(devotions[todayIndex] ?? devotions[0], todayIndex, language) : null;
  const { completedDays } = useDevotional();
  const monthlyProgress = devotions.length ? completedDays.length / devotions.length : 0;
  const completed = hasDevotions && completedDays.includes(todayIndex);
  const [currentHour] = useState(() => new Date().getHours());

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ContentStatus loading={contentLoading} error={contentError} onRetry={refreshContent} />
        <FadeIn style={styles.motion}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.welcomeRow}>
              <Text style={[styles.greeting, isDark && styles.darkInk]}>{greetingForHour(currentHour, language)}</Text>
              <Text style={[styles.welcomeMeta, isDark && styles.darkMuted]}>{reminderEnabled ? t(language, 'rhythmSet') : t(language, 'momentAwaits')}</Text>
            </View>

            <View style={[styles.themeCard, isDark && styles.darkThemeCard]}>
              <View style={styles.themeBadgeRow}>
                <View style={styles.themeBadge}>
                  <Text style={styles.themeBadgeText}>{edition ? `${edition.title.toUpperCase()} EDITION` : t(language, 'comingSoon')}</Text>
                </View>
                {source === 'offline' && (
                  <View style={styles.offlineBadge}>
                    <SymbolView name="wifi.slash" size={11} tintColor="#E0B66A" />
                    <Text style={styles.offlineBadgeText}>{language === 'fr' ? 'Hors-Ligne (Cache)' : 'Offline (Cached)'}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.themeTitle}>{edition?.theme ?? 'This month’s devotional'}</Text>
              <Text style={styles.themeCopy}>{edition?.introduction || 'The devotional for this month will be available soon. Please check back shortly.'}</Text>
              <View style={styles.themeFooter}>
                <Text style={styles.themeMeta}>
                  {edition
                    ? `${completedDays.length} of ${devotions.length} days completed${source === 'offline' ? ' · Showing cached content' : ''}`
                    : 'Content will appear here when published'}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.max(monthlyProgress * 100, 3)}%` }]} />
                </View>
              </View>
            </View>

            <View style={styles.quickActions}>
              <Pressable onPress={() => router.push({ pathname: '/devotional', params: { day: String(todayIndex) } })} style={styles.quickAction}>
                <View style={[styles.quickIcon, styles.quickIconWarm]}><SymbolView name="book.closed.fill" size={18} tintColor="#B96A43" /></View>
                <Text style={[styles.quickLabel, isDark && styles.darkMuted]}>{t(language, 'today')}</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/explore')} style={styles.quickAction}>
                <View style={[styles.quickIcon, isDark && styles.darkQuickIcon]}><SymbolView name="books.vertical.fill" size={18} tintColor={isDark ? DewDesign.colors.darkInk : '#31543F'} /></View>
                <Text style={[styles.quickLabel, isDark && styles.darkMuted]}>{t(language, 'library')}</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/journey')} style={styles.quickAction}>
                <View style={[styles.quickIcon, isDark && styles.darkQuickIcon]}><SymbolView name="chart.bar.fill" size={18} tintColor={isDark ? DewDesign.colors.darkInk : '#31543F'} /></View>
                <Text style={[styles.quickLabel, isDark && styles.darkMuted]}>{t(language, 'journey')}</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/journey')} style={styles.quickAction}>
                <View style={[styles.quickIcon, isDark && styles.darkQuickIcon]}><SymbolView name="bookmark.fill" size={18} tintColor={isDark ? DewDesign.colors.darkInk : '#31543F'} /></View>
                <Text style={[styles.quickLabel, isDark && styles.darkMuted]}>{t(language, 'saved')}</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'todaysMeditation')}</Text>
              {today ? <Text style={[styles.sectionMeta, isDark && styles.darkMuted]}>{today.weekday}</Text> : null}
            </View>

            {/* Today's Meditation Content vs Empty State */}
            {!hasDevotions || !today ? (
              <View style={[styles.emptyMeditationCard, isDark && styles.darkDevotionCard]}>
                <View style={styles.emptyIcon}>
                  <SymbolView name="book.closed" size={24} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                </View>
                <Text style={[styles.emptyTitle, isDark && styles.darkInk]}>{t(language, 'noMeditationTodayTitle')}</Text>
                <Text style={[styles.emptyText, isDark && styles.darkMuted]}>{t(language, 'noMeditationTodayMsg')}</Text>
                <Pressable onPress={() => router.push('/explore')} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
                  <Text style={styles.secondaryActionText}>{t(language, 'exploreLibrary')}</Text>
                  <SymbolView name="arrow.right" size={16} tintColor={DewDesign.colors.forest} />
                </Pressable>
              </View>
            ) : completed ? (
              <View style={[styles.caughtUpCard, isDark && styles.darkDevotionCard]}>
                <View style={styles.caughtUpIcon}><SymbolView name="checkmark" size={22} tintColor="#FFFFFF" /></View>
                <Text style={[styles.caughtUpTitle, isDark && styles.darkInk]}>{t(language, 'allCaughtUp')}</Text>
                <Text style={[styles.caughtUpText, isDark && styles.darkMuted]}>{t(language, 'meditationCompleteMessage')}</Text>
                <Pressable onPress={() => router.push({ pathname: '/devotional', params: { day: String(todayIndex) } })} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
                  <Text style={styles.secondaryActionText}>{t(language, 'reviewMeditation')}</Text>
                  <SymbolView name="arrow.right" size={16} tintColor="#31543F" />
                </Pressable>
              </View>
            ) : (
              <View style={[styles.devotionCard, isDark && styles.darkDevotionCard]}>
                <View style={styles.devotionIcon}>
                  <SymbolView name="book.closed.fill" size={20} tintColor="#F5E6C8" />
                </View>
                <Text style={[styles.devotionTitle, isDark && styles.darkInk]}>{today.title}</Text>
                <Text style={[styles.scripture, isDark && { color: '#E4B98D' }]}>{today.scripture}</Text>
                <Text style={[styles.preview, isDark && styles.darkMuted]} numberOfLines={3}>
                  {today.preview}
                </Text>
                <Pressable
                  onPress={() => router.push({ pathname: '/devotional', params: { day: String(todayIndex) } })}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Begin today's meditation">
                  <Text style={styles.primaryButtonText}>{t(language, 'beginMeditation')}</Text>
                  <SymbolView name="arrow.right" size={16} tintColor="#FFFFFF" />
                </Pressable>
              </View>
            )}

            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'yourJourney')}</Text>
              <Text style={[styles.sectionMeta, isDark && styles.darkMuted]}>{completedDays.length} of 7 this week</Text>
            </View>
            <View style={[styles.weekCard, isDark && styles.darkWeekCard]}>
              <View style={styles.weekRow}>
                {['1', '2', '3', '4', '5', '6', '7'].map((day, index) => (
                  <View key={day} style={styles.dayItem}>
                    <Text style={[styles.dayLabel, isDark && styles.darkMuted]}>{['W', 'T', 'F', 'S', 'S', 'M', 'T'][index]}</Text>
                    <View style={[styles.dayCircle, isDark && styles.darkDayCircle, completedDays.includes(index) && styles.dayCircleActive]}>
                      {completedDays.includes(index) ? (
                        <SymbolView name="checkmark" size={14} tintColor="#FFFFFF" />
                      ) : (
                        <Text style={[styles.dayNumber, isDark && styles.darkInk]}>{day}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
              <View style={[styles.journeyFooter, isDark && { borderTopColor: DewDesign.colors.darkLine }]}>
                <SymbolView name="flame.fill" size={16} tintColor={DewDesign.colors.terracotta} />
                <Text style={[styles.streakText, isDark && styles.darkMuted]}>
                  {completedDays.length} day{completedDays.length === 1 ? '' : 's'} complete. {t(language, 'keepShowingUp')}
                </Text>
              </View>
            </View>
          </ScrollView>
        </FadeIn>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  safeArea: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  darkScreen: { backgroundColor: DewDesign.colors.darkCanvas },
  darkThemeCard: { backgroundColor: DewDesign.colors.darkSurface },
  darkDevotionCard: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  darkWeekCard: { backgroundColor: DewDesign.colors.darkSurface },
  darkDayCircle: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  darkQuickIcon: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  darkInk: { color: DewDesign.colors.darkInk },
  darkMuted: { color: DewDesign.colors.darkMuted },
  motion: { flex: 1 },
  content: {
    paddingHorizontal: DewDesign.spacing.screen,
    paddingTop: 14,
    paddingBottom: 110,
  },
  welcomeRow: { marginBottom: 18 },
  greeting: { color: DewDesign.colors.ink, fontSize: 28, fontWeight: '700', marginTop: 4 },
  welcomeMeta: { color: DewDesign.colors.body, fontSize: 12, fontWeight: '700', marginTop: 3 },
  themeCard: { backgroundColor: DewDesign.colors.forest, borderRadius: DewDesign.radius.feature, padding: 22, marginBottom: 26 },
  themeBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  themeBadge: { alignSelf: 'flex-start', backgroundColor: '#627966', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5 },
  themeBadgeText: { color: '#F5E6C8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6 },
  offlineBadgeText: { color: '#E0B66A', fontSize: 10, fontWeight: '800' },
  themeTitle: { color: '#FFFFFF', fontFamily: 'serif', fontSize: 30, fontWeight: '700', marginTop: 10 },
  themeCopy: { color: '#E6EDE3', fontSize: 14, lineHeight: 21, marginTop: 8 },
  themeFooter: { marginTop: 23 },
  themeMeta: { color: '#E6EDE3', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  syncHint: { color: '#F4D7C5', fontSize: 10, lineHeight: 15, marginBottom: 8 },
  progressTrack: { height: 5, backgroundColor: '#718875', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#E0B66A', borderRadius: 3 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  quickAction: { width: '23%', alignItems: 'center', gap: 7 },
  quickIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: DewDesign.colors.forestSoft, alignItems: 'center', justifyContent: 'center' },
  quickIconWarm: { backgroundColor: DewDesign.colors.terracottaSoft },
  quickLabel: { color: DewDesign.colors.body, fontSize: 11, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: DewDesign.colors.ink, fontSize: 18, fontWeight: '800' },
  sectionMeta: { color: DewDesign.colors.muted, fontSize: 12, fontWeight: '600' },
  devotionCard: { backgroundColor: DewDesign.colors.surface, borderRadius: 20, padding: 20, marginBottom: 26, borderWidth: 1, borderColor: DewDesign.colors.line },
  emptyMeditationCard: { backgroundColor: DewDesign.colors.surface, borderRadius: 20, padding: 22, marginBottom: 26, alignItems: 'center', borderWidth: 1, borderColor: DewDesign.colors.line },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: DewDesign.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: DewDesign.colors.body, fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: 'center', paddingHorizontal: 12 },
  caughtUpCard: { backgroundColor: DewDesign.colors.forestSoft, borderRadius: 20, padding: 20, marginBottom: 26, alignItems: 'center' },
  caughtUpIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: DewDesign.colors.forest, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  caughtUpTitle: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  caughtUpText: { color: DewDesign.colors.body, fontSize: 14, lineHeight: 21, marginTop: 6, textAlign: 'center' },
  secondaryAction: { minHeight: 44, borderRadius: 11, backgroundColor: DewDesign.colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18, marginTop: 18, borderWidth: 1, borderColor: DewDesign.colors.line },
  secondaryActionText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
  devotionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: DewDesign.colors.terracotta, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  devotionTitle: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 25, fontWeight: '700', lineHeight: 31 },
  scripture: { color: DewDesign.colors.terracotta, fontSize: 13, fontWeight: '800', marginTop: 8 },
  preview: { color: DewDesign.colors.body, fontSize: 14, lineHeight: 22, marginTop: 14 },
  primaryButton: { backgroundColor: DewDesign.colors.terracotta, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, marginTop: 20 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  weekCard: { backgroundColor: DewDesign.colors.surfaceMuted, borderRadius: 18, padding: 17 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayItem: { alignItems: 'center', gap: 8 },
  dayLabel: { color: DewDesign.colors.muted, fontSize: 11, fontWeight: '800' },
  dayCircle: { width: 31, height: 31, borderRadius: 16, backgroundColor: DewDesign.colors.surface, alignItems: 'center', justifyContent: 'center' },
  dayCircleActive: { backgroundColor: DewDesign.colors.terracotta },
  dayNumber: { color: DewDesign.colors.body, fontSize: 12, fontWeight: '700' },
  journeyFooter: { borderTopWidth: 1, borderTopColor: DewDesign.colors.line, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 13 },
  streakText: { color: DewDesign.colors.body, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.82 },
});
