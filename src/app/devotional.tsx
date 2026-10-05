import SymbolView from '@/components/app-icon';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { localizeDevotion } from '@/data/devotions';
import { useDevotional } from '@/context/devotional-context';
import { useSettings } from '@/context/settings-context';
import { useContent } from '@/context/content-context';
import { DewDesign } from '@/constants/design';
import DailyDewHeader from '@/components/daily-dew-header';
import ScriptureModal from '@/components/scripture-modal';
import AudioPlayerDock from '@/components/audio-player-dock';
import ShareCardGenerator from '@/components/share-card-generator';
import { t } from '@/lib/i18n';
import { extractScriptureReference } from '@/lib/bible';

export default function DevotionalScreen() {
  const params = useLocalSearchParams<{ day?: string }>();
  const { devotions, edition } = useContent();
  const index = Math.min(Math.max(Number(params.day ?? 0), 0), devotions.length - 1);
  const { language, fontScale, themeMode } = useSettings();
  const isDark = themeMode === 'dark';
  const devotion = localizeDevotion(devotions[index], index, language);

  const [scriptureModalVisible, setScriptureModalVisible] = useState(false);
  const [selectedScriptureRef, setSelectedScriptureRef] = useState<string | null>(null);
  const [shareCardVisible, setShareCardVisible] = useState(false);

  const { hydrated, completedDays, reflections, prayers, bookmarks, setReflection, setPrayer, toggleCompleted, toggleBookmark } = useDevotional();
  const isComplete = completedDays.includes(index);
  const isBookmarked = bookmarks.includes(index);
  const reflection = reflections[index] ?? '';
  const prayer = prayers[index] ?? '';

  const hasPrevious = index > 0;
  const hasNext = index < devotions.length - 1;

  const goToDay = (nextIndex: number) => {
    setSelectedScriptureRef(null);
    router.replace({ pathname: '/devotional', params: { day: String(nextIndex) } });
  };

  if (!hydrated) {
    return (
      <View style={[styles.screen, isDark && styles.darkScreen]}>
        <SafeAreaView style={[styles.loadingState, isDark && styles.darkScreen]}>
          <SymbolView name="book.closed" size={26} tintColor={DewDesign.colors.forest} />
          <Text style={styles.loadingTitle}>{t(language, 'openingJourney')}</Text>
          <Text style={styles.loadingText}>{t(language, 'restoringNotes')}</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!devotion) {
    return (
      <View style={[styles.screen, isDark && styles.darkScreen]}>
        <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
          <DailyDewHeader />
          <View style={[styles.loadingState, isDark && styles.darkScreen]}>
            <SymbolView name="book.closed" size={28} tintColor={DewDesign.colors.terracotta} />
            <Text style={[styles.loadingTitle, isDark && styles.darkInk]}>{t(language, 'noMeditationTodayTitle')}</Text>
            <Text style={[styles.loadingText, isDark && styles.darkMuted]}>{t(language, 'noMeditationTodayMsg')}</Text>
            <Pressable onPress={() => router.back()} style={styles.explorePremiumBtn}>
              <Text style={styles.explorePremiumText}>{t(language, 'goBack')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const cleanLeadReference = extractScriptureReference(devotion.scripture);
  const meditationParagraphs = devotion.meditation.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);

  const shareMoment = async () => {
    const appDownloadLink = process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL ?? 'Download link coming soon';
    const message = [
      `DAILY DEW\n${devotion.title}\n\nSCRIPTURE\n${devotion.scripture}`,
      `MEDITATION\n${devotion.meditation}`,
      `WISDOM NUGGET\n${devotion.wisdom}`,
      `DECLARATION\n${devotion.declaration}`,
      `READ MORE\n${appDownloadLink}`,
    ].join('\n\n--------------------\n\n');

    await Share.share({
      title: devotion.title,
      message,
    });
  };

  // Day-Level & Edition-Level Premium Locked Guard
  const isLocked = Boolean(devotion?.isLocked || edition?.isLocked);
  if (isLocked) {
    return (
      <View style={[styles.screen, isDark && styles.darkScreen]}>
        <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
          <DailyDewHeader />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} style={[styles.iconButton, isDark && styles.darkIconButton]} accessibilityRole="button" accessibilityLabel={t(language, 'goBack')}>
                <SymbolView name="chevron.left" size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.ink} />
              </Pressable>
              <Text style={[styles.headerLabel, isDark && styles.darkMuted]}>{t(language, 'premiumBadge')}</Text>
              <View style={styles.iconButtonPlaceholder} />
            </View>

            <Text style={styles.date}>{devotion.weekday.toUpperCase()}</Text>
            <Text style={[styles.title, isDark && styles.darkInk, { fontSize: 33 * fontScale, lineHeight: 40 * fontScale }]}>{devotion.title}</Text>

            <View style={[styles.premiumLockedBox, isDark && styles.darkScriptureCard]}>
              <View style={styles.premiumIconCircle}>
                <SymbolView name="sparkles" size={24} tintColor={DewDesign.colors.terracotta} />
              </View>
              <Text style={[styles.premiumLockedTitle, isDark && styles.darkInk]}>{t(language, 'premiumRequiredTitle')}</Text>
              <Text style={[styles.premiumLockedText, isDark && styles.darkMuted]}>{t(language, 'unlockDayPrompt')}</Text>

              <Pressable
                onPress={() => router.push('/membership' as any)}
                style={({ pressed }) => [styles.explorePremiumBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'explorePremium')}>
                <Text style={styles.explorePremiumText}>{t(language, 'explorePremium')}</Text>
                <SymbolView name="arrow.right" size={16} tintColor="#FFFFFF" />
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={[styles.iconButton, isDark && styles.darkIconButton]} accessibilityRole="button" accessibilityLabel={t(language, 'goBack')}>
              <SymbolView name="chevron.left" size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.ink} />
            </Pressable>
            <Text style={[styles.headerLabel, isDark && styles.darkMuted]}>
              {`${t(language, 'dayOf')} ${devotion.day} / ${devotions.length}`}
            </Text>
            <Pressable onPress={() => toggleBookmark(index)} style={[styles.iconButton, isDark && styles.darkIconButton]} accessibilityRole="button" accessibilityLabel={isBookmarked ? t(language, 'removeBookmark') : t(language, 'bookmarkMeditation')}>
              <SymbolView name={isBookmarked ? 'bookmark.fill' : 'bookmark'} size={18} tintColor={isBookmarked ? DewDesign.colors.terracotta : (isDark ? DewDesign.colors.darkInk : DewDesign.colors.ink)} />
            </Pressable>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((index + 1) / devotions.length) * 100}%` }]} />
          </View>

          <Text style={styles.date}>{devotion.weekday.toUpperCase()}</Text>
          <Text style={[styles.title, isDark && styles.darkInk, { fontSize: 33 * fontScale, lineHeight: 40 * fontScale }]}>{devotion.title}</Text>

          {/* Lead Scripture Card */}
          <View style={[styles.scriptureCard, isDark && styles.darkScriptureCard]}>
            <View style={styles.scriptureHeading}>
              <SymbolView name="book.closed" size={15} tintColor={DewDesign.colors.terracotta} />
              <Text style={styles.scriptureLabel}>{t(language, 'scripture')}</Text>
            </View>
            <Text style={[styles.scripture, isDark && styles.darkScripture]}>{devotion.scripture}</Text>
          </View>

          {/* Floating Audio Player Dock */}
          <AudioPlayerDock
            title={devotion.title}
            textToSpeak={devotion.meditation}
            language={language}
            isDark={isDark}
          />

          <View style={styles.meditationBody}>
            {meditationParagraphs.map((paragraph, paragraphIndex) => (
              <Text key={`${paragraphIndex}-${paragraph.slice(0, 12)}`} style={[styles.body, isDark && styles.darkBody, { fontSize: 17 * fontScale, lineHeight: 29 * fontScale }]}>
                {paragraph}
              </Text>
            ))}
          </View>

          <View style={[styles.wisdomCard, isDark && styles.darkWisdomCard]}>
            <Text style={styles.wisdomLabel}>{t(language, 'wisdomNugget')}</Text>
            <Text style={[styles.wisdomText, { fontSize: 17 * fontScale, lineHeight: 24 * fontScale }]}>{devotion.wisdom}</Text>
          </View>

          <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'furtherStudies')}</Text>
          <View style={styles.studyRow}>
            {devotion.furtherStudies.map((study) => (
              <Pressable
                key={study}
                onPress={() => {
                  const cleanStudyRef = extractScriptureReference(study);
                  setSelectedScriptureRef(cleanStudyRef || study);
                  setScriptureModalVisible(true);
                }}
                style={styles.studyPill}
                accessibilityRole="button"
                accessibilityLabel={study}>
                <Text style={styles.studyText}>{study}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'yourReflection')}</Text>
          <TextInput
            key={`reflection-${index}`}
            multiline
            value={reflection}
            onChangeText={(value) => setReflection(index, value)}
            placeholder={t(language, 'reflectionPlaceholder')}
            placeholderTextColor="#A8ADA7"
            style={[styles.input, isDark && styles.darkInput]}
            textAlignVertical="top"
          />

          <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'yourPrayer')}</Text>
          <TextInput
            key={`prayer-${index}`}
            multiline
            value={prayer}
            onChangeText={(value) => setPrayer(index, value)}
            placeholder={t(language, 'prayerPlaceholder')}
            placeholderTextColor="#A8ADA7"
            style={[styles.input, styles.prayerInput, isDark && styles.darkInput]}
            textAlignVertical="top"
          />

          <View style={styles.declarationCard}>
            <Text style={styles.wisdomLabel}>{t(language, 'declaration')}</Text>
            <Text style={[styles.declaration, { fontSize: 16 * fontScale, lineHeight: 25 * fontScale }]}>{devotion.declaration}</Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={() => setShareCardVisible(true)} style={[styles.actionButton, styles.cardShareButton]} accessibilityRole="button" accessibilityLabel={t(language, 'createGraphicCard')}>
              <SymbolView name="photo" size={16} tintColor="#FFFFFF" />
              <Text style={styles.cardShareButtonText}>{t(language, 'createGraphicCard')}</Text>
            </Pressable>

            <Pressable onPress={shareMoment} style={[styles.actionButton, styles.secondaryShareBtn]} accessibilityRole="button" accessibilityLabel={t(language, 'shareMoment')}>
              <SymbolView name="square.and.arrow.up" size={16} tintColor={DewDesign.colors.forest} />
              <Text style={styles.secondaryShareText}>{t(language, 'shareMoment')}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => toggleCompleted(index)}
            accessibilityRole="button"
            accessibilityLabel={isComplete ? t(language, 'meditationComplete') : t(language, 'completeMeditation')}
            style={({ pressed }) => [styles.completeButton, isComplete && styles.completeButtonDone, pressed && styles.pressed]}>
            <SymbolView name={isComplete ? 'checkmark' : 'checkmark.circle'} size={18} tintColor="#FFFFFF" />
            <Text style={styles.completeButtonText}>{isComplete ? t(language, 'meditationComplete') : t(language, 'completeMeditation')}</Text>
          </Pressable>

          <View style={styles.dayNavigation}>
            <Pressable
              disabled={!hasPrevious}
              onPress={() => goToDay(index - 1)}
              style={({ pressed }) => [styles.dayNavButton, !hasPrevious && styles.dayNavDisabled, pressed && styles.pressed]}>
              <SymbolView name="chevron.left" size={16} tintColor={hasPrevious ? DewDesign.colors.forest : DewDesign.colors.muted} />
              <Text style={[styles.dayNavText, !hasPrevious && styles.dayNavTextDisabled]}>{t(language, 'previous')}</Text>
            </Pressable>
            <Pressable
              disabled={!hasNext}
              onPress={() => goToDay(index + 1)}
              style={({ pressed }) => [styles.dayNavButton, styles.nextNavButton, !hasNext && styles.dayNavDisabled, pressed && styles.pressed]}>
              <Text style={[styles.dayNavText, !hasNext && styles.dayNavTextDisabled]}>{t(language, 'nextDay')}</Text>
              <SymbolView name="chevron.right" size={16} tintColor={hasNext ? '#FFFFFF' : DewDesign.colors.muted} />
            </Pressable>
          </View>
        </ScrollView>

        <ScriptureModal
          visible={scriptureModalVisible}
          reference={selectedScriptureRef ?? cleanLeadReference}
          language={language}
          isDark={isDark}
          onClose={() => {
            setScriptureModalVisible(false);
            setSelectedScriptureRef(null);
          }}
        />

        <ShareCardGenerator
          visible={shareCardVisible}
          title={devotion.title}
          scripture={devotion.scripture}
          declaration={devotion.declaration}
          wisdom={devotion.wisdom}
          prayer={prayer}
          language={language}
          isDark={isDark}
          onClose={() => setShareCardVisible(false)}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  safeArea: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  darkScreen: { backgroundColor: DewDesign.colors.darkCanvas },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingTitle: { color: DewDesign.colors.ink, fontSize: 18, fontWeight: '800', marginTop: 12 },
  loadingText: { color: DewDesign.colors.muted, fontSize: 13, textAlign: 'center', marginTop: 6 },
  content: { paddingHorizontal: DewDesign.spacing.screen, paddingTop: 10, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: DewDesign.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  iconButtonPlaceholder: { width: 38, height: 38 },
  darkIconButton: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  headerLabel: { color: DewDesign.colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: DewDesign.colors.surfaceMuted, overflow: 'hidden', marginBottom: 20 },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: DewDesign.colors.terracotta },
  date: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 33, fontWeight: '700', lineHeight: 40, marginTop: 8 },
  darkInk: { color: DewDesign.colors.darkInk },
  darkMuted: { color: DewDesign.colors.darkMuted },
  scriptureCard: { backgroundColor: DewDesign.colors.terracottaSoft, borderLeftWidth: 4, borderLeftColor: DewDesign.colors.terracotta, borderRadius: 12, padding: 15, marginTop: 17, marginBottom: 10 },
  darkScriptureCard: { backgroundColor: DewDesign.colors.darkTerracottaSoft },
  scriptureHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  scriptureLabel: { color: DewDesign.colors.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  tapToReadBadge: { fontSize: 10, color: DewDesign.colors.terracotta, fontStyle: 'italic', marginLeft: 'auto' },
  scripture: { color: DewDesign.colors.terracotta, flexShrink: 1, fontFamily: 'serif', fontSize: 15, fontWeight: '700', lineHeight: 24 },
  darkScripture: { color: '#E7B38F' },
  meditationBody: { gap: 18, paddingHorizontal: 2, marginVertical: 14 },
  body: { color: DewDesign.colors.body, fontFamily: 'serif', fontSize: 17, lineHeight: 29 },
  darkBody: { color: DewDesign.colors.darkBody },
  wisdomCard: { backgroundColor: DewDesign.colors.forestSoft, borderLeftWidth: 4, borderLeftColor: DewDesign.colors.forest, padding: 17, marginTop: 15, marginBottom: 20 },
  darkWisdomCard: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  wisdomLabel: { color: DewDesign.colors.forest, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  wisdomText: { color: DewDesign.colors.forest, fontFamily: 'serif', fontSize: 17, fontWeight: '700', lineHeight: 24, marginTop: 8 },
  sectionTitle: { color: DewDesign.colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 11, marginTop: 10 },
  studyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  studyPill: { backgroundColor: DewDesign.colors.surfaceMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  studyText: { color: DewDesign.colors.body, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 105, backgroundColor: DewDesign.colors.surface, borderRadius: 13, padding: 14, color: DewDesign.colors.ink, fontSize: 14, lineHeight: 21, marginBottom: 18, borderWidth: 1, borderColor: DewDesign.colors.line },
  darkInput: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine, color: DewDesign.colors.darkInk },
  prayerInput: { minHeight: 92 },
  declarationCard: { backgroundColor: DewDesign.colors.forest, borderRadius: 16, padding: 18, marginTop: 3, marginBottom: 20 },
  declaration: { color: DewDesign.colors.white, fontFamily: 'serif', fontSize: 16, lineHeight: 25, marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionButton: { flex: 1, minHeight: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cardShareButton: { backgroundColor: DewDesign.colors.terracotta },
  cardShareButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  secondaryShareBtn: { backgroundColor: DewDesign.colors.forestSoft, borderWidth: 1, borderColor: DewDesign.colors.forestMuted },
  secondaryShareText: { color: DewDesign.colors.forest, fontSize: 12, fontWeight: '800' },
  completeButton: { backgroundColor: DewDesign.colors.terracotta, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 15, marginBottom: 14 },
  completeButtonDone: { backgroundColor: DewDesign.colors.forest },
  completeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  dayNavigation: { flexDirection: 'row', gap: 9, marginTop: 10 },
  dayNavButton: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: DewDesign.colors.forestSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  nextNavButton: { backgroundColor: DewDesign.colors.forest },
  dayNavDisabled: { backgroundColor: DewDesign.colors.surfaceMuted },
  dayNavText: { color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
  dayNavTextDisabled: { color: DewDesign.colors.muted },
  premiumLockedBox: { backgroundColor: DewDesign.colors.terracottaSoft, borderRadius: DewDesign.radius.card, padding: 22, marginTop: 20, alignItems: 'center' },
  premiumIconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: DewDesign.colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  premiumLockedTitle: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  premiumLockedText: { color: DewDesign.colors.body, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  explorePremiumBtn: { height: 48, borderRadius: DewDesign.radius.control, backgroundColor: DewDesign.colors.forest, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  explorePremiumText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.82 },
});
