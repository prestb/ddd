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
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';
  const { devotions, edition, source, networkStatus, error: contentError, loading: contentLoading, refresh: refreshContent } = useContent();

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

  // Derive rhythm block strictly bounded by available edition length
  const totalDevotions = devotions.length;
  const rhythmStart = totalDevotions > 0 ? Math.floor(todayIndex / 7) * 7 : 0;
  const rhythmDays = Array.from(
    { length: Math.min(7, Math.max(0, totalDevotions - rhythmStart)) },
    (_, i) => rhythmStart + i
  );
  const rhythmCompletedCount = rhythmDays.filter((dayIdx) => completedDays.includes(dayIdx)).length;
  const totalRhythmDays = rhythmDays.length;

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ContentStatus loading={contentLoading} error={contentError} onRetry={refreshContent} />
        <FadeIn style={styles.motion}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* 1. GREETING */}
            <View style={styles.welcomeRow}>
              <Text style={[styles.greeting, isDark && styles.darkInk]}>{greetingForHour(currentHour, language)}</Text>
              <Text style={[styles.welcomeMeta, isDark && styles.darkMuted]}>{t(language, 'momentAwaits')}</Text>
            </View>

            {/* 2. TODAY'S DEW (Primary Focused Call-to-Action) */}
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'todaysDew')}</Text>
              {today ? <Text style={[styles.sectionMeta, isDark && styles.darkMuted]}>{today.weekday.toUpperCase()}</Text> : null}
            </View>

            {!hasDevotions || !today ? (
              <View style={[styles.emptyMeditationCard, isDark && styles.darkDevotionCard]}>
                <View style={styles.emptyIcon}>
                  <SymbolView name="book.closed" size={24} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                </View>
                <Text style={[styles.emptyTitle, isDark && styles.darkInk]}>{t(language, 'noMeditationTodayTitle')}</Text>
                <Text style={[styles.emptyText, isDark && styles.darkMuted]}>{t(language, 'noMeditationTodayMsg')}</Text>
                <Pressable
                  onPress={() => router.push('/explore')}
                  style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'exploreLibrary')}>
                  <Text style={styles.secondaryActionText}>{t(language, 'exploreLibrary')}</Text>
                  <SymbolView name="arrow.right" size={16} tintColor={DewDesign.colors.forest} />
                </Pressable>
              </View>
            ) : (
              <View style={[styles.devotionCard, isDark && styles.darkDevotionCard]}>
                <View style={styles.devotionHeaderRow}>
                  <View style={styles.devotionIcon}>
                    <SymbolView name="book.closed.fill" size={20} tintColor="#F5E6C8" />
                  </View>
                  {completed && (
                    <View style={styles.completedBadge}>
                      <SymbolView name="checkmark" size={12} tintColor="#FFFFFF" />
                      <Text style={styles.completedBadgeText}>{t(language, 'completedTag')}</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.devotionTitle, isDark && styles.darkInk]}>{today.title}</Text>
                <Text style={[styles.scripture, isDark && { color: '#E4B98D' }]}>{today.scripture}</Text>
                <Text style={[styles.preview, isDark && styles.darkMuted]} numberOfLines={3}>
                  {today.preview}
                </Text>

                <Pressable
                  onPress={() => router.push({ pathname: '/devotional', params: { day: String(todayIndex) } })}
                  style={({ pressed }) => [styles.primaryButton, completed && styles.primaryButtonCompleted, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={completed ? t(language, 'continueReading') : t(language, 'beginMeditation')}>
                  <Text style={styles.primaryButtonText}>
                    {completed ? t(language, 'continueReading') : t(language, 'beginMeditation')}
                  </Text>
                  <SymbolView name="arrow.right" size={16} tintColor="#FFFFFF" />
                </Pressable>
              </View>
            )}

            {/* 3. YOUR RHYTHM & PROGRESS */}
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'yourRhythm')}</Text>
              <Text style={[styles.sectionMeta, isDark && styles.darkMuted]}>
                {totalRhythmDays > 0
                  ? `${rhythmCompletedCount} / ${totalRhythmDays} ${rhythmCompletedCount === 1 ? t(language, 'dayCompletedSuffix') : t(language, 'daysCompletedSuffix')}`
                  : ''}
              </Text>
            </View>
            <View style={[styles.weekCard, isDark && styles.darkWeekCard]}>
              <View style={styles.weekRow}>
                {rhythmDays.map((dayIdx) => {
                  const isDone = completedDays.includes(dayIdx);
                  const isTarget = dayIdx === todayIndex;
                  return (
                    <View key={dayIdx} style={styles.dayItem}>
                      <Text style={[styles.dayLabel, isDark && styles.darkMuted, isTarget && styles.dayLabelTarget]}>
                        {`D${dayIdx + 1}`}
                      </Text>
                      <View style={[styles.dayCircle, isDark && styles.darkDayCircle, isDone && styles.dayCircleActive, isTarget && !isDone && styles.dayCircleTarget]}>
                        {isDone ? (
                          <SymbolView name="checkmark" size={14} tintColor="#FFFFFF" />
                        ) : (
                          <Text style={[styles.dayNumber, isDark && styles.darkInk, isTarget && styles.dayNumberTarget]}>
                            {dayIdx + 1}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={[styles.journeyFooter, isDark && { borderTopColor: DewDesign.colors.darkLine }]}>
                <SymbolView name="sparkles" size={16} tintColor={DewDesign.colors.terracotta} />
                <Text style={[styles.streakText, isDark && styles.darkMuted]}>
                  {`${completedDays.length} ${completedDays.length === 1 ? t(language, 'dayCompletedSuffix') : t(language, 'daysCompletedSuffix')} · ${t(language, 'aSteadyStep')}`}
                </Text>
              </View>
            </View>

            {/* 4. THIS MONTH'S THEME */}
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'thisMonthsTheme')}</Text>
            </View>
            <View style={[styles.themeCard, isDark && styles.darkThemeCard]}>
              <View style={styles.themeBadgeRow}>
                <View style={styles.themeBadge}>
                  <Text style={styles.themeBadgeText}>
                    {edition ? `${edition.title.toUpperCase()} ${t(language, 'editionLabel')}` : t(language, 'comingSoon')}
                  </Text>
                </View>
                {source === 'cache' && networkStatus === 'offline' && (
                  <View style={styles.offlineBadge}>
                    <SymbolView name="wifi.slash" size={11} tintColor="#E0B66A" />
                    <Text style={styles.offlineBadgeText}>{t(language, 'offlineShowingCache')}</Text>
                  </View>
                )}
                {source === 'cache' && networkStatus !== 'offline' && (
                  <View style={styles.offlineBadge}>
                    <SymbolView name="arrow.clockwise" size={11} tintColor="#E0B66A" />
                    <Text style={styles.offlineBadgeText}>{t(language, 'syncFailedShowingCache')}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.themeTitle}>{edition?.theme ?? t(language, 'thisMonthsDevotionalFallback')}</Text>
              <Text style={styles.themeCopy} numberOfLines={4} ellipsizeMode="tail">
                {edition?.introduction || t(language, 'thisMonthsDevotionalUpcoming')}
              </Text>
              <View style={styles.themeFooter}>
                <Text style={styles.themeMeta}>
                  {edition
                    ? `${completedDays.length} / ${devotions.length} ${completedDays.length === 1 ? t(language, 'dayCompletedSuffix') : t(language, 'daysCompletedSuffix')}${source === 'cache' ? ` · ${t(language, 'showingCachedContent')}` : ''}`
                    : t(language, 'contentWillAppear')}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.max(monthlyProgress * 100, 3)}%` }]} />
                </View>
              </View>
            </View>

            {/* 5. SECONDARY QUICK ACCESS */}
            <View style={styles.quickActions}>
              <Pressable
                onPress={() => router.push({ pathname: '/devotional', params: { day: String(todayIndex) } })}
                style={styles.quickAction}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'today')}>
                <View style={[styles.quickIcon, styles.quickIconWarm]}><SymbolView name="book.closed.fill" size={18} tintColor="#B96A43" /></View>
                <Text style={[styles.quickLabel, isDark && styles.darkMuted]}>{t(language, 'today')}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/explore')}
                style={styles.quickAction}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'library')}>
                <View style={[styles.quickIcon, isDark && styles.darkQuickIcon]}><SymbolView name="books.vertical.fill" size={18} tintColor={isDark ? DewDesign.colors.darkInk : '#31543F'} /></View>
                <Text style={[styles.quickLabel, isDark && styles.darkMuted]}>{t(language, 'library')}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/journey')}
                style={styles.quickAction}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'journey')}>
                <View style={[styles.quickIcon, isDark && styles.darkQuickIcon]}><SymbolView name="chart.bar.fill" size={18} tintColor={isDark ? DewDesign.colors.darkInk : '#31543F'} /></View>
                <Text style={[styles.quickLabel, isDark && styles.darkMuted]}>{t(language, 'journey')}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/journey')}
                style={styles.quickAction}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'saved')}>
                <View style={[styles.quickIcon, isDark && styles.darkQuickIcon]}><SymbolView name="bookmark.fill" size={18} tintColor={isDark ? DewDesign.colors.darkInk : '#31543F'} /></View>
                <Text style={[styles.quickLabel, isDark && styles.darkMuted]}>{t(language, 'saved')}</Text>
              </Pressable>
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
  devotionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  devotionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: DewDesign.colors.terracotta, alignItems: 'center', justifyContent: 'center' },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: DewDesign.colors.forest, paddingHorizontal: 10, paddingVertical: 5, borderRadius: DewDesign.radius.full },
  completedBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
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
  devotionTitle: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 25, fontWeight: '700', lineHeight: 31 },
  scripture: { color: DewDesign.colors.terracotta, fontSize: 13, fontWeight: '800', marginTop: 8 },
  preview: { color: DewDesign.colors.body, fontSize: 14, lineHeight: 22, marginTop: 14 },
  primaryButton: { backgroundColor: DewDesign.colors.terracotta, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, marginTop: 20 },
  primaryButtonCompleted: { backgroundColor: DewDesign.colors.forest },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  weekCard: { backgroundColor: DewDesign.colors.surfaceMuted, borderRadius: 18, padding: 17 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayItem: { alignItems: 'center', gap: 8 },
  dayLabel: { color: DewDesign.colors.muted, fontSize: 11, fontWeight: '800' },
  dayLabelTarget: { color: DewDesign.colors.terracotta },
  dayCircle: { width: 31, height: 31, borderRadius: 16, backgroundColor: DewDesign.colors.surface, alignItems: 'center', justifyContent: 'center' },
  dayCircleActive: { backgroundColor: DewDesign.colors.terracotta },
  dayCircleTarget: { borderWidth: 2, borderColor: DewDesign.colors.terracotta },
  dayNumber: { color: DewDesign.colors.body, fontSize: 12, fontWeight: '700' },
  dayNumberTarget: { color: DewDesign.colors.terracotta, fontWeight: '900' },
  journeyFooter: { borderTopWidth: 1, borderTopColor: DewDesign.colors.line, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 13 },
  streakText: { color: DewDesign.colors.body, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.82 },
});
