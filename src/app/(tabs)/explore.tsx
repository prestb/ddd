import SymbolView from '@/components/app-icon';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDevotional } from '@/context/devotional-context';
import { localizeDevotion, type Devotion } from '@/data/devotions';
import { useSettings } from '@/context/settings-context';
import { useContent } from '@/context/content-context';
import { DewDesign } from '@/constants/design';
import DailyDewHeader from '@/components/daily-dew-header';
import FadeIn from '@/components/fade-in';
import ContentStatus from '@/components/content-status';
import { t } from '@/lib/i18n';

type LibraryFilter = 'all' | 'unread' | 'completed' | 'bookmarked';

export default function LibraryScreen() {
  const { completedDays, bookmarks } = useDevotional();
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';
  const { devotions: cloudDevotions, edition, loading: contentLoading, error: contentError, refresh: refreshContent } = useContent();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const dailyDevotions = cloudDevotions.map((devotion, index) => localizeDevotion(devotion, index, language)).filter((d): d is Devotion => d !== null);
  const visibleDevotions = useMemo(() => dailyDevotions
    .map((devotion, index) => ({ devotion, index }))
    .filter(({ devotion, index }) => {
      const matchesQuery = `${devotion.title} ${devotion.scripture} ${devotion.weekday}`.toLowerCase().includes(query.trim().toLowerCase());
      const matchesFilter = filter === 'all'
        || (filter === 'unread' && !completedDays.includes(index))
        || (filter === 'completed' && completedDays.includes(index))
        || (filter === 'bookmarked' && bookmarks.includes(index));
      return matchesQuery && matchesFilter;
    }), [bookmarks, completedDays, dailyDevotions, filter, query]);

  const monthYearLabel = edition
    ? `${new Date(edition.year, edition.month - 1).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long' })} ${edition.year}`
    : t(language, 'currentEditionLabel');

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ContentStatus loading={contentLoading} error={contentError} onRetry={refreshContent} />
        <FadeIn style={styles.motion}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.kickerRow}>
              <Text style={styles.kicker}>{t(language, 'libraryKicker')}</Text>
              {edition?.access_level === 'premium' ? (
                <View style={styles.premiumBadgePill}>
                  <SymbolView name="sparkles" size={10} tintColor="#E0B66A" />
                  <Text style={styles.premiumBadgeText}>{t(language, 'premiumBadge')}</Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.title, isDark && styles.darkInk]}>{monthYearLabel}</Text>
            <Text style={[styles.subtitle, isDark && styles.darkBody]}>
              {edition ? `${edition.title}: ${edition.theme}` : t(language, 'thisMonthsDevotionalFallback')}
            </Text>

            <View style={styles.summaryCard}>
              <View>
                <Text style={styles.summaryLabel}>{t(language, 'yourProgress')}</Text>
                <Text style={styles.summaryValue}>
                  {`${completedDays.length} / ${cloudDevotions.length} ${completedDays.length === 1 ? t(language, 'dayCompletedSuffix') : t(language, 'daysCompletedSuffix')}`}
                </Text>
              </View>
              <View style={styles.summaryRing}>
                <Text style={styles.summaryRingText}>
                  {cloudDevotions.length ? Math.round((completedDays.length / cloudDevotions.length) * 100) : 0}%
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'dailyMeditations')}</Text>
              <Text style={[styles.sectionMeta, isDark && styles.darkMuted]}>
                {`${visibleDevotions.length} ${t(language, 'shownLabel')}`}
              </Text>
            </View>

            <View style={[styles.searchBox, isDark && styles.darkCard]}>
              <SymbolView name="magnifyingglass" size={17} tintColor={isDark ? DewDesign.colors.darkMuted : '#899189'} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t(language, 'searchMeditations')}
                placeholderTextColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'}
                style={[styles.searchInput, isDark && styles.darkInput]}
                returnKeyType="search"
                accessibilityRole="search"
                accessibilityLabel={t(language, 'searchMeditations')}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t(language, 'clearSearch')}>
                  <SymbolView name="xmark.circle.fill" size={17} tintColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'} />
                </Pressable>
              )}
            </View>

            <View style={styles.filterRow}>
              {([
                ['all', t(language, 'all')],
                ['unread', t(language, 'unread')],
                ['completed', t(language, 'complete')],
                ['bookmarked', t(language, 'saved')],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setFilter(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === value }}
                  accessibilityLabel={label}
                  style={[styles.filter, filter === value && styles.filterActive, isDark && filter !== value && styles.darkFilter]}>
                  <Text style={[styles.filterText, filter === value && styles.filterTextActive, isDark && filter !== value && styles.darkFilterText]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.list}>
              {visibleDevotions.map(({ devotion, index }) => {
                const complete = completedDays.includes(index);
                const bookmarked = bookmarks.includes(index);
                const isLocked = Boolean(devotion.isLocked || edition?.isLocked);
                return (
                  <Pressable
                    key={devotion.day}
                    onPress={() => router.push(isLocked ? '/membership' as any : { pathname: '/devotional', params: { day: String(index) } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Day ${devotion.day}: ${devotion.title}${isLocked ? ' (Locked)' : ''}`}
                    style={({ pressed }) => [styles.entry, isDark && styles.darkCard, pressed && styles.pressed]}>
                    <View style={[styles.dayNumber, complete && styles.dayNumberComplete, isDark && !complete && styles.darkDayNumber]}>
                      {complete ? (
                        <SymbolView name="checkmark" size={14} tintColor="#FFFFFF" />
                      ) : (
                        <Text style={[styles.dayNumberText, isDark && styles.darkDayNumberText]}>{devotion.day}</Text>
                      )}
                    </View>
                    <View style={styles.entryCopy}>
                      <Text style={styles.entryDay}>{devotion.weekday.toUpperCase()}</Text>
                      <Text style={[styles.entryTitle, isDark && styles.darkInk]} numberOfLines={2}>{devotion.title}</Text>
                      <Text style={[styles.entryScripture, isDark && styles.darkMuted]} numberOfLines={1}>{devotion.scripture}</Text>
                    </View>
                    {isLocked ? (
                      <SymbolView name="sparkles" size={16} tintColor={DewDesign.colors.terracotta} />
                    ) : bookmarked ? (
                      <SymbolView name="bookmark.fill" size={16} tintColor={DewDesign.colors.terracotta} />
                    ) : null}
                    <SymbolView name="chevron.right" size={17} tintColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'} />
                  </Pressable>
                );
              })}
              {visibleDevotions.length === 0 && (
                <View style={[styles.emptyState, isDark && styles.darkCard]}>
                  <SymbolView name="book.closed" size={24} tintColor={isDark ? DewDesign.colors.darkMuted : '#A8ADA7'} />
                  <Text style={[styles.emptyTitle, isDark && styles.darkInk]}>{t(language, 'noMeditations')}</Text>
                  <Text style={[styles.emptyText, isDark && styles.darkMuted]}>{t(language, 'tryAnother')}</Text>
                </View>
              )}
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
  darkCard: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  darkInk: { color: DewDesign.colors.darkInk },
  darkBody: { color: DewDesign.colors.darkBody },
  darkMuted: { color: DewDesign.colors.darkMuted },
  darkInput: { color: DewDesign.colors.darkInk },
  darkFilter: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  darkFilterText: { color: DewDesign.colors.darkBody },
  darkDayNumber: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  darkDayNumberText: { color: DewDesign.colors.darkInk },
  motion: { flex: 1 },
  content: { paddingHorizontal: DewDesign.spacing.screen, paddingTop: 14, paddingBottom: 110 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  premiumBadgePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DewDesign.colors.terracottaSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  premiumBadgeText: { color: DewDesign.colors.terracotta, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 35, fontWeight: '700', marginTop: 5 },
  subtitle: { color: DewDesign.colors.body, fontSize: 14, marginTop: 5, marginBottom: 22 },
  summaryCard: { backgroundColor: DewDesign.colors.forest, borderRadius: DewDesign.radius.feature, padding: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 27 },
  summaryLabel: { color: '#C9D8C7', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  summaryValue: { color: '#FFFFFF', fontFamily: 'serif', fontSize: 24, fontWeight: '700', marginTop: 7 },
  summaryRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 4, borderColor: '#E0B66A', alignItems: 'center', justifyContent: 'center' },
  summaryRingText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 11 },
  sectionTitle: { color: DewDesign.colors.ink, fontSize: 18, fontWeight: '800' },
  sectionMeta: { color: DewDesign.colors.muted, fontSize: 12, fontWeight: '700' },
  searchBox: { height: 48, backgroundColor: DewDesign.colors.surface, borderWidth: 1, borderColor: DewDesign.colors.line, borderRadius: DewDesign.radius.control, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  searchInput: { flex: 1, color: DewDesign.colors.ink, fontSize: 14, marginLeft: 9, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  filter: { flex: 1, height: 38, backgroundColor: DewDesign.colors.surfaceMuted, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: DewDesign.colors.forest },
  filterText: { color: DewDesign.colors.body, fontSize: 11, fontWeight: '800' },
  filterTextActive: { color: '#FFFFFF' },
  list: { gap: 9 },
  entry: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 13, flexDirection: 'row', alignItems: 'center', minHeight: 78, borderWidth: 1, borderColor: DewDesign.colors.line },
  dayNumber: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EDE8DF', alignItems: 'center', justifyContent: 'center' },
  dayNumberComplete: { backgroundColor: DewDesign.colors.terracotta },
  dayNumberText: { color: '#68716C', fontSize: 13, fontWeight: '900' },
  entryCopy: { flex: 1, marginHorizontal: 12 },
  entryDay: { color: DewDesign.colors.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  entryTitle: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 16, fontWeight: '700', marginTop: 3 },
  entryScripture: { color: DewDesign.colors.muted, fontSize: 11, marginTop: 3 },
  pressed: { opacity: 0.75 },
  emptyState: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, alignItems: 'center', padding: 28, borderWidth: 1, borderColor: DewDesign.colors.line },
  emptyTitle: { color: DewDesign.colors.ink, fontSize: 15, fontWeight: '800', marginTop: 10 },
  emptyText: { color: DewDesign.colors.muted, fontSize: 12, marginTop: 4 },
});
