import SymbolView from '@/components/app-icon';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDevotional } from '@/context/devotional-context';
import { localizeDevotion } from '@/data/devotions';
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
  const { devotions: cloudDevotions, edition, loading: contentLoading, error: contentError, refresh: refreshContent } = useContent();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const dailyDevotions = cloudDevotions.map((devotion, index) => localizeDevotion(devotion, index, language));
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

  return (
    <View style={[styles.screen, themeMode === 'dark' && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, themeMode === 'dark' && styles.darkScreen]}>
        <DailyDewHeader />
        <ContentStatus loading={contentLoading} error={contentError} onRetry={refreshContent} />
        <FadeIn style={styles.motion}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>{t(language, 'libraryKicker')}</Text>
          <Text style={[styles.title, themeMode === 'dark' && styles.darkInk]}>{edition ? `${new Date(edition.year, edition.month - 1).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long' })} ${edition.year}` : t(language, 'currentEditionLabel')}</Text>
          <Text style={[styles.subtitle, themeMode === 'dark' && styles.darkBody]}>{edition ? `${edition.title}: ${edition.theme}` : 'Your daily Scripture and reflection'}</Text>

          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>{t(language, 'yourProgress')}</Text>
              <Text style={styles.summaryValue}>{completedDays.length} of {cloudDevotions.length} days</Text>
            </View>
            <View style={styles.summaryRing}>
              <Text style={styles.summaryRingText}>{cloudDevotions.length ? Math.round((completedDays.length / cloudDevotions.length) * 100) : 0}%</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, themeMode === 'dark' && styles.darkInk]}>{t(language, 'dailyMeditations')}</Text>
            <Text style={[styles.sectionMeta, themeMode === 'dark' && styles.darkMuted]}>{visibleDevotions.length} shown</Text>
          </View>

          <View style={[styles.searchBox, themeMode === 'dark' && styles.darkCard]}>
            <SymbolView name="magnifyingglass" size={17} tintColor="#899189" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t(language, 'searchMeditations')}
              placeholderTextColor="#A8ADA7"
              style={[styles.searchInput, themeMode === 'dark' && styles.darkInput]}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search">
                <SymbolView name="xmark.circle.fill" size={17} tintColor="#A8ADA7" />
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
              <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}>
                <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.list}>
            {visibleDevotions.map(({ devotion, index }) => {
              const complete = completedDays.includes(index);
              const bookmarked = bookmarks.includes(index);
              return (
                <Pressable
                  key={devotion.day}
                  onPress={() => router.push({ pathname: '/devotional', params: { day: String(index) } })}
                  style={({ pressed }) => [styles.entry, themeMode === 'dark' && styles.darkCard, pressed && styles.pressed]}>
                  <View style={[styles.dayNumber, complete && styles.dayNumberComplete]}>
                    {complete ? (
                      <SymbolView name="checkmark" size={14} tintColor="#FFFFFF" />
                    ) : (
                      <Text style={styles.dayNumberText}>{devotion.day}</Text>
                    )}
                  </View>
                  <View style={styles.entryCopy}>
                    <Text style={styles.entryDay}>{devotion.weekday}</Text>
                    <Text style={[styles.entryTitle, themeMode === 'dark' && styles.darkInk]} numberOfLines={2}>{devotion.title}</Text>
                    <Text style={[styles.entryScripture, themeMode === 'dark' && styles.darkMuted]} numberOfLines={1}>{devotion.scripture}</Text>
                  </View>
                  {bookmarked && <SymbolView name="bookmark.fill" size={16} tintColor="#C26A3B" />}
                  <SymbolView name="chevron.right" size={17} tintColor="#A8ADA7" />
                </Pressable>
              );
            })}
            {visibleDevotions.length === 0 && (
              <View style={styles.emptyState}>
                <SymbolView name="book.closed" size={24} tintColor="#A8ADA7" />
                <Text style={styles.emptyTitle}>{t(language, 'noMeditations')}</Text>
                <Text style={styles.emptyText}>{t(language, 'tryAnother')}</Text>
              </View>
            )}
          </View>
        </ScrollView></FadeIn>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  safeArea: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  darkScreen: { backgroundColor: '#17231D' },
  darkCard: { backgroundColor: '#26382D', borderColor: '#49614D' },
  darkInk: { color: '#F5F1E9' }, darkBody: { color: '#D0D8D1' }, darkMuted: { color: '#AEB9B1' }, darkInput: { color: '#F5F1E9' },
  motion: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 110 },
  kicker: { color: '#A36B45', fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 35, fontWeight: '700', marginTop: 5 },
  subtitle: { color: '#68716C', fontSize: 14, marginTop: 5, marginBottom: 22 },
  summaryCard: { backgroundColor: DewDesign.colors.forest, borderRadius: DewDesign.radius.feature, padding: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 27 },
  summaryLabel: { color: '#C9D8C7', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  summaryValue: { color: '#FFFFFF', fontFamily: 'serif', fontSize: 24, fontWeight: '700', marginTop: 7 },
  summaryRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 4, borderColor: '#E0B66A', alignItems: 'center', justifyContent: 'center' },
  summaryRingText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 11 },
  sectionTitle: { color: '#27312D', fontSize: 18, fontWeight: '800' },
  sectionMeta: { color: '#8B918B', fontSize: 12, fontWeight: '700' },
  searchBox: { height: 48, backgroundColor: DewDesign.colors.surface, borderWidth: 1, borderColor: DewDesign.colors.line, borderRadius: DewDesign.radius.control, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  searchInput: { flex: 1, color: DewDesign.colors.ink, fontSize: 14, marginLeft: 9, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  filter: { flex: 1, height: 38, backgroundColor: DewDesign.colors.surfaceMuted, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: DewDesign.colors.forest },
  filterText: { color: DewDesign.colors.body, fontSize: 11, fontWeight: '800' },
  filterTextActive: { color: '#FFFFFF' },
  list: { gap: 9 },
  entry: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 13, flexDirection: 'row', alignItems: 'center', minHeight: 78, elevation: 1 },
  dayNumber: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EDE8DF', alignItems: 'center', justifyContent: 'center' },
  dayNumberComplete: { backgroundColor: '#C26A3B' },
  dayNumberText: { color: '#68716C', fontSize: 13, fontWeight: '900' },
  entryCopy: { flex: 1, marginHorizontal: 12 },
  entryDay: { color: '#A36B45', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  entryTitle: { color: '#27312D', fontFamily: 'serif', fontSize: 16, fontWeight: '700', marginTop: 3 },
  entryScripture: { color: '#899189', fontSize: 11, marginTop: 3 },
  pressed: { opacity: 0.75 },
  emptyState: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, alignItems: 'center', padding: 28 },
  emptyTitle: { color: DewDesign.colors.ink, fontSize: 15, fontWeight: '800', marginTop: 10 },
  emptyText: { color: DewDesign.colors.muted, fontSize: 12, marginTop: 4 },
});
