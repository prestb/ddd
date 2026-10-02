import SymbolView from '@/components/app-icon';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDevotional } from '@/context/devotional-context';
import { useContent } from '@/context/content-context';
import { localizeDevotion } from '@/data/devotions';
import { useSettings } from '@/context/settings-context';
import { DewDesign } from '@/constants/design';
import DailyDewHeader from '@/components/daily-dew-header';
import FadeIn from '@/components/fade-in';
import ContentStatus from '@/components/content-status';
import SpiritualMilestones from '@/components/spiritual-milestones';
import { t } from '@/lib/i18n';

type SavedFilter = 'bookmarks' | 'reflections' | 'prayers';

export default function JourneyScreen() {
  const { completedDays, bookmarks, reflections, prayers, answeredPrayers, toggleAnsweredPrayer } = useDevotional();
  const { devotions, edition, loading: contentLoading, error: contentError, refresh: refreshContent } = useContent();
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';
  const [savedFilter, setSavedFilter] = useState<SavedFilter>('bookmarks');

  const notesCount = Object.values(reflections).filter(Boolean).length;
  const prayersCount = Object.values(prayers).filter(Boolean).length;
  const answeredCount = answeredPrayers.length;

  const days = Array.from({ length: devotions.length }, (_, index) => index);
  const progress = Math.round((completedDays.length / Math.max(devotions.length, 1)) * 100);

  const savedDays = savedFilter === 'bookmarks'
    ? bookmarks
    : Object.keys(savedFilter === 'reflections' ? reflections : prayers)
      .filter((day) => Boolean((savedFilter === 'reflections' ? reflections : prayers)[day]))
      .map(Number);

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ContentStatus loading={contentLoading} error={contentError} onRetry={refreshContent} />
        <FadeIn style={styles.motion}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.kicker}>{t(language, 'yourWalk')}</Text>
            <Text style={[styles.title, isDark && styles.darkInk]}>{t(language, 'journey')}</Text>
            <Text style={[styles.subtitle, isDark && styles.darkBody]}>{t(language, 'noticeGrowth')}</Text>

            <View style={styles.hero}>
              <View>
                <Text style={styles.heroLabel}>{edition ? `${edition.title.toUpperCase()} · ${edition.month}/${edition.year}` : 'CURRENT EDITION'}</Text>
                <Text style={styles.heroValue}>{completedDays.length} days completed</Text>
                <Text style={styles.heroMeta}>A steady step is still a step.</Text>
              </View>
              <View style={styles.progressCircle}>
                <Text style={styles.progressValue}>{progress}%</Text>
              </View>
            </View>

            {/* Spiritual Milestones Badges */}
            <SpiritualMilestones
              completedDaysCount={completedDays.length}
              reflectionsCount={notesCount}
              prayersCount={prayersCount}
              answeredPrayersCount={answeredCount}
              language={language}
              isDark={isDark}
            />

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'yourMonth')}</Text>
              <Text style={[styles.sectionMeta, isDark && styles.darkBody]}>{completedDays.length} of {devotions.length}</Text>
            </View>
            <View style={[styles.calendar, isDark && styles.darkCard]}>
              {days.map((day) => {
                const complete = completedDays.includes(day);
                const bookmarked = bookmarks.includes(day);
                return (
                  <Pressable
                    key={day}
                    accessibilityLabel={`Open day ${day + 1}`}
                    onPress={() => router.push({ pathname: '/devotional', params: { day: String(day) } })}
                    style={[styles.day, isDark && styles.darkDay, complete && styles.dayComplete, bookmarked && !complete && styles.dayBookmarked]}>
                    {complete ? <SymbolView name="checkmark" size={13} tintColor="#FFFFFF" /> : <Text style={[styles.dayText, bookmarked && styles.dayTextBookmarked]}>{day + 1}</Text>}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'savedWithIntention')}</Text>
            </View>
            <View style={styles.statsRow}>
              <Pressable style={[styles.stat, isDark && styles.darkCard]} onPress={() => setSavedFilter('bookmarks')}>
                <SymbolView name="bookmark.fill" size={20} tintColor={DewDesign.colors.terracotta} />
                <Text style={[styles.statValue, isDark && styles.darkInk]}>{bookmarks.length}</Text>
                <Text style={[styles.statLabel, isDark && styles.darkMuted]}>{t(language, 'bookmarks')}</Text>
              </Pressable>
              <Pressable style={[styles.stat, isDark && styles.darkCard]} onPress={() => setSavedFilter('reflections')}>
                <SymbolView name="pencil.line" size={20} tintColor={DewDesign.colors.forest} />
                <Text style={[styles.statValue, isDark && styles.darkInk]}>{notesCount}</Text>
                <Text style={[styles.statLabel, isDark && styles.darkMuted]}>{t(language, 'reflections')}</Text>
              </Pressable>
              <Pressable style={[styles.stat, isDark && styles.darkCard]} onPress={() => setSavedFilter('prayers')}>
                <SymbolView name="hands.sparkles.fill" size={20} tintColor={DewDesign.colors.forest} />
                <Text style={[styles.statValue, isDark && styles.darkInk]}>{prayersCount}</Text>
                <Text style={[styles.statLabel, isDark && styles.darkMuted]}>{t(language, 'prayers')}</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'savedMoments')}</Text>
              <Text style={[styles.sectionMeta, isDark && styles.darkBody]}>{savedDays.length} saved</Text>
            </View>
            <View style={styles.filterRow}>
              {([
                ['bookmarks', t(language, 'bookmarks')],
                ['reflections', t(language, 'reflections')],
                ['prayers', t(language, 'prayers')],
              ] as const).map(([filter, label]) => (
                <Pressable key={filter} accessibilityRole="button" onPress={() => setSavedFilter(filter)} style={[styles.filter, isDark && styles.darkCard, savedFilter === filter && styles.filterActive]}>
                  <Text numberOfLines={1} style={[styles.filterText, isDark && styles.darkInk, savedFilter === filter && styles.filterTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.savedList, isDark && styles.darkCard]}>
              {savedDays.length === 0 ? (
                <View style={styles.emptyState}>
                  <SymbolView name="tray" size={22} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  <Text style={[styles.emptyTitle, isDark && styles.darkInk]}>{t(language, 'nothingSaved')}</Text>
                  <Text style={[styles.emptyText, isDark && styles.darkMuted]}>{t(language, 'savedWillAppear')}</Text>
                </View>
              ) : savedDays.map((day) => {
                const devotion = devotions[day];
                if (!devotion) return null;
                const localized = localizeDevotion(devotion, day, language);
                const note = savedFilter === 'reflections' ? reflections[day] : savedFilter === 'prayers' ? prayers[day] : null;
                const answered = answeredPrayers.includes(day);
                return (
                  <Pressable key={`${savedFilter}-${day}`} onPress={() => router.push({ pathname: '/devotional', params: { day: String(day) } })} style={[styles.savedEntry, isDark && styles.darkSavedEntry]}>
                    <View style={[styles.savedDay, isDark && styles.darkSavedDay]}>
                      <Text style={[styles.savedDayText, isDark && styles.darkInk]}>{day + 1}</Text>
                    </View>
                    <View style={styles.savedCopy}>
                      <Text style={[styles.savedTitle, isDark && styles.darkInk]} numberOfLines={1}>{localized.title}</Text>
                      <Text style={[styles.savedMeta, isDark && styles.darkMuted]} numberOfLines={2}>
                        {answered && savedFilter === 'prayers' ? (language === 'fr' ? 'Prière exaucée' : 'Answered prayer') : note || localized.scripture}
                      </Text>
                    </View>
                    {savedFilter === 'prayers' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={answered ? 'Mark prayer as active' : 'Mark prayer as answered'}
                        onPress={() => toggleAnsweredPrayer(day)}
                        hitSlop={8}
                        style={[styles.answeredButton, answered && styles.answeredButtonActive]}>
                        <SymbolView name={answered ? 'checkmark' : 'checkmark.circle'} size={16} tintColor={answered ? '#FFFFFF' : DewDesign.colors.forest} />
                      </Pressable>
                    ) : <SymbolView name="chevron.right" size={16} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />}
                  </Pressable>
                );
              })}
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
  darkInk: { color: DewDesign.colors.darkInk },
  darkBody: { color: DewDesign.colors.darkBody },
  darkMuted: { color: DewDesign.colors.darkMuted },
  darkCard: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  motion: { flex: 1 },
  content: { paddingHorizontal: DewDesign.spacing.screen, paddingTop: 14, paddingBottom: 110 },
  kicker: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 35, fontWeight: '700', marginTop: 5 },
  subtitle: { color: DewDesign.colors.body, fontSize: 14, marginTop: 5, marginBottom: 22 },
  hero: { backgroundColor: DewDesign.colors.forest, borderRadius: DewDesign.radius.feature, padding: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { color: '#D8E3D4', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroValue: { color: '#FFFFFF', fontFamily: 'serif', fontSize: 25, fontWeight: '700', marginTop: 8 },
  heroMeta: { color: '#D8E3D4', fontSize: 12, marginTop: 5 },
  progressCircle: { width: 68, height: 68, borderRadius: 34, borderWidth: 5, borderColor: '#D5E2D0', alignItems: 'center', justifyContent: 'center' },
  progressValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: DewDesign.colors.ink, fontSize: 18, fontWeight: '800' },
  sectionMeta: { color: DewDesign.colors.muted, fontSize: 12, fontWeight: '700' },
  calendar: { backgroundColor: DewDesign.colors.surface, borderRadius: 17, padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  day: { width: '10.5%', aspectRatio: 1, borderRadius: 9, backgroundColor: DewDesign.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  darkDay: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  dayComplete: { backgroundColor: DewDesign.colors.forest },
  dayBookmarked: { borderWidth: 2, borderColor: DewDesign.colors.terracotta },
  dayText: { color: DewDesign.colors.body, fontSize: 12, fontWeight: '800' },
  dayTextBookmarked: { color: DewDesign.colors.terracotta },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: DewDesign.colors.surface, borderRadius: 15, padding: 14, minHeight: 112 },
  statValue: { color: DewDesign.colors.ink, fontSize: 25, fontWeight: '800', marginTop: 10 },
  statLabel: { color: DewDesign.colors.muted, fontSize: 11, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  filter: { flex: 1, minWidth: 0, height: 48, backgroundColor: DewDesign.colors.surface, borderRadius: 9, borderWidth: 1, borderColor: DewDesign.colors.line, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: DewDesign.colors.forest, borderColor: DewDesign.colors.forest },
  filterText: { color: DewDesign.colors.ink, fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: '#FFFFFF' },
  savedList: { backgroundColor: DewDesign.colors.surface, borderRadius: 17, overflow: 'hidden' },
  savedEntry: { minHeight: 70, padding: 13, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: DewDesign.colors.surfaceMuted },
  darkSavedEntry: { borderBottomColor: DewDesign.colors.darkSurfaceMuted },
  savedDay: { width: 36, height: 36, borderRadius: 11, backgroundColor: DewDesign.colors.forestSoft, alignItems: 'center', justifyContent: 'center' },
  darkSavedDay: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  savedDayText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '900' },
  savedCopy: { flex: 1, marginHorizontal: 11 },
  savedTitle: { color: DewDesign.colors.ink, fontSize: 14, fontWeight: '800' },
  savedMeta: { color: DewDesign.colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  answeredButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: DewDesign.colors.forestSoft, alignItems: 'center', justifyContent: 'center' },
  answeredButtonActive: { backgroundColor: DewDesign.colors.forest },
  emptyState: { alignItems: 'center', padding: 25 },
  emptyTitle: { color: DewDesign.colors.ink, fontSize: 14, fontWeight: '800', marginTop: 9 },
  emptyText: { color: DewDesign.colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
});
