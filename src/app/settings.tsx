import SymbolView from '@/components/app-icon';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/context/settings-context';
import { useAuth } from '@/context/auth-context';
import { DewDesign } from '@/constants/design';
import { scheduleDailyReminder, cancelDailyReminder } from '@/lib/reminders';
import { useState } from 'react';
import { router } from 'expo-router';
import DailyDewHeader from '@/components/daily-dew-header';
import AppBottomNav from '@/components/app-bottom-nav';
import { t } from '@/lib/i18n';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { fontScale, setFontScale, language, setLanguage, reminderEnabled, setReminderEnabled, reminderHour, setReminderHour, newsletterEnabled, setNewsletterEnabled, themeMode, setThemeMode } = useSettings();
  const isDark = themeMode === 'dark';
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  const formatHour = (hour: number, minute = 0) =>
    `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;

  const toggleReminder = async () => {
    if (reminderEnabled) {
      await cancelDailyReminder();
      setReminderEnabled(false);
      setReminderMessage(t(language, 'reminderIsOff'));
      return;
    }
    const result = await scheduleDailyReminder(reminderHour);
    setReminderMessage(result.message ?? t(language, 'dailyAtTime').replace('{time}', formatHour(reminderHour)));
    if (result.ok) setReminderEnabled(true);
  };

  const chooseReminderTime = async () => {
    try {
      const { DateTimePickerAndroid } = await import('@react-native-community/datetimepicker');
      const value = new Date(1970, 0, 1, reminderHour, 0, 0);
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        is24Hour: false,
        onChange: async (event, selectedDate) => {
          if (event.type !== 'set' || !selectedDate) return;
          const nextHour = selectedDate.getHours();
          const nextMinute = selectedDate.getMinutes();
          setReminderHour(nextHour);
          if (reminderEnabled) {
            const result = await scheduleDailyReminder(nextHour, nextMinute);
            setReminderMessage(result.message ?? t(language, 'dailyAtTime').replace('{time}', formatHour(nextHour, nextMinute)));
          } else {
            setReminderMessage(t(language, 'dailyAtTime').replace('{time}', formatHour(nextHour, nextMinute)));
          }
        },
      });
    } catch {
      setReminderMessage(t(language, 'customTimeAvailable'));
    }
  };

  const activeReminderText = reminderEnabled
    ? (reminderMessage ?? t(language, 'dailyAtTime').replace('{time}', formatHour(reminderHour)))
    : (reminderMessage ?? t(language, 'reminderIsOff'));

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>{t(language, 'yourSpace')}</Text>
          <Text style={[styles.title, isDark && styles.darkInk]}>{t(language, 'settings')}</Text>
          <Text style={[styles.subtitle, isDark && styles.darkBody]}>{t(language, 'shapeReadingRhythm')}</Text>

          {/* Account & Cross-Device Sync */}
          <View style={[styles.section, isDark && styles.darkSection]}>
            <Text style={styles.sectionLabel}>{t(language, 'accountAndSync')}</Text>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <SymbolView name="person.crop.circle" size={20} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.settingTitle, isDark && styles.darkInk]}>
                  {session ? session.user.email : t(language, 'guestUser')}
                </Text>
                <Text style={[styles.settingMeta, isDark && styles.darkBody]}>
                  {session ? t(language, 'signedInDesc') : t(language, 'signedOutDesc')}
                </Text>
              </View>
              <Pressable
                onPress={() => (session ? signOut() : router.push('/auth'))}
                accessibilityRole="button"
                accessibilityLabel={session ? t(language, 'logout') : t(language, 'login')}
                style={[styles.authPill, session && styles.signOutPill]}>
                <Text style={[styles.authPillText, session && styles.signOutPillText]}>
                  {session ? t(language, 'logout') : t(language, 'login')}
                </Text>
              </Pressable>
            </View>

            {session ? (
              <Pressable
                onPress={() => router.push('/profile' as any)}
                style={[styles.settingRow, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: isDark ? DewDesign.colors.darkLine : DewDesign.colors.line }]}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'profileHeading')}>
                <View style={styles.settingIcon}>
                  <SymbolView name="pencil" size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.settingTitle, isDark && styles.darkInk]}>{t(language, 'profileHeading')}</Text>
                  <Text style={[styles.settingMeta, isDark && styles.darkBody]}>{t(language, 'manageProfileDesc')}</Text>
                </View>
                <SymbolView name="chevron.right" size={16} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Appearance Section */}
          <View style={[styles.section, isDark && styles.darkSection]}>
            <Text style={styles.sectionLabel}>{t(language, 'appearance')}</Text>
            <View style={styles.languageRow}>
              <Pressable
                onPress={() => setThemeMode('light')}
                accessibilityRole="button"
                accessibilityState={{ selected: themeMode === 'light' }}
                accessibilityLabel={t(language, 'light')}
                style={[styles.languageOption, themeMode === 'light' && styles.languageOptionActive]}>
                <Text style={[styles.languageText, themeMode === 'light' && styles.languageTextActive]}>{t(language, 'light')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setThemeMode('dark')}
                accessibilityRole="button"
                accessibilityState={{ selected: themeMode === 'dark' }}
                accessibilityLabel={t(language, 'dark')}
                style={[styles.languageOption, themeMode === 'dark' && styles.languageOptionActive]}>
                <Text style={[styles.languageText, themeMode === 'dark' && styles.languageTextActive]}>{t(language, 'dark')}</Text>
              </Pressable>
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <SymbolView name="moon" size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.settingTitle, isDark && styles.darkInk]}>{t(language, 'readingAppearance')}</Text>
                <Text style={[styles.settingMeta, isDark && styles.darkBody]}>{t(language, 'chooseVisualMode')}</Text>
              </View>
            </View>
          </View>

          {/* Reading & Live Text Scale Preview */}
          <View style={[styles.section, isDark && styles.darkSection]}>
            <Text style={styles.sectionLabel}>{t(language, 'reading')}</Text>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <SymbolView name="textformat.size" size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.settingTitle, isDark && styles.darkInk]}>{t(language, 'textSize')}</Text>
                <Text style={[styles.settingMeta, isDark && styles.darkBody]}>{t(language, 'adjustText')}</Text>
              </View>
            </View>
            <View style={styles.segmented}>
              {[0.9, 1, 1.1, 1.2].map((size) => (
                <Pressable
                  key={size}
                  onPress={() => setFontScale(size)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: fontScale === size }}
                  accessibilityLabel={`${t(language, 'textSize')} ${size}x`}
                  style={[styles.sizeOption, fontScale === size && styles.sizeOptionActive]}>
                  <Text style={[styles.sizeText, fontScale === size && styles.sizeTextActive, { fontSize: 12 + size * 3 }]}>A</Text>
                </Pressable>
              ))}
            </View>

            {/* Live Text Preview Box */}
            <View style={[styles.previewBox, isDark && styles.darkPreviewBox]}>
              <Text style={styles.previewBoxLabel}>{t(language, 'livePreview')}</Text>
              <Text style={[styles.previewVerseText, isDark && styles.darkInk, { fontSize: 15 * fontScale, lineHeight: 24 * fontScale }]}>
                {t(language, 'previewVerse')}
              </Text>
            </View>
          </View>

          {/* Daily Rhythm Reminders */}
          <View style={[styles.section, isDark && styles.darkSection]}>
            <Text style={styles.sectionLabel}>{t(language, 'dailyRhythm')}</Text>
            <Pressable
              onPress={toggleReminder}
              style={styles.settingRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: reminderEnabled }}
              accessibilityLabel={t(language, 'morningReminder')}>
              <View style={styles.settingIcon}>
                <SymbolView name="bell.fill" size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.settingTitle, isDark && styles.darkInk]}>{t(language, 'morningReminder')}</Text>
                <Text style={[styles.settingMeta, isDark && styles.darkBody]}>{activeReminderText}</Text>
              </View>
              <View style={[styles.toggle, reminderEnabled && styles.toggleActive]}>
                <View style={[styles.toggleKnob, reminderEnabled && styles.toggleKnobActive]} />
              </View>
            </Pressable>
            <View style={styles.timeChoices}>
              {[7, 12, 18, 21].map((hour) => (
                <Pressable
                  key={hour}
                  onPress={async () => {
                    setReminderHour(hour);
                    if (reminderEnabled) {
                      const result = await scheduleDailyReminder(hour);
                      setReminderMessage(result.message ?? t(language, 'dailyAtTime').replace('{time}', formatHour(hour)));
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={formatHour(hour)}
                  style={[styles.timeChoice, isDark && styles.darkTimeChoice, reminderHour === hour && styles.timeChoiceActive]}>
                  <Text style={[styles.timeChoiceText, isDark && styles.darkMuted, reminderHour === hour && styles.timeChoiceTextActive]}>
                    {formatHour(hour)}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={chooseReminderTime}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'customTimeLabel').replace('{time}', formatHour(reminderHour))}
                style={[styles.timeChoice, isDark && styles.darkTimeChoice, ![7, 12, 18, 21].includes(reminderHour) && styles.timeChoiceActive]}>
                <SymbolView
                  name="clock"
                  size={14}
                  tintColor={![7, 12, 18, 21].includes(reminderHour) ? '#FFFFFF' : isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest}
                />
                <Text style={[styles.timeChoiceText, isDark && styles.darkMuted, ![7, 12, 18, 21].includes(reminderHour) && styles.timeChoiceTextActive]}>
                  {t(language, 'customTimeLabel').replace('{time}', formatHour(reminderHour))}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Language Selection */}
          <View style={[styles.section, isDark && styles.darkSection]}>
            <Text style={styles.sectionLabel}>{t(language, 'language')}</Text>
            <View style={styles.languageRow}>
              <Pressable
                onPress={() => setLanguage('en')}
                accessibilityRole="button"
                accessibilityState={{ selected: language === 'en' }}
                accessibilityLabel={t(language, 'english')}
                style={[styles.languageOption, language === 'en' && styles.languageOptionActive]}>
                <Text style={[styles.languageText, language === 'en' && styles.languageTextActive]}>{t(language, 'english')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setLanguage('fr')}
                accessibilityRole="button"
                accessibilityState={{ selected: language === 'fr' }}
                accessibilityLabel={t(language, 'french')}
                style={[styles.languageOption, language === 'fr' && styles.languageOptionActive]}>
                <Text style={[styles.languageText, language === 'fr' && styles.languageTextActive]}>{t(language, 'french')}</Text>
              </Pressable>
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <SymbolView name="globe" size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.settingTitle, isDark && styles.darkInk]}>
                  {language === 'fr' ? t(language, 'french') : t(language, 'english')}
                </Text>
                <Text style={[styles.settingMeta, isDark && styles.darkBody]}>
                  {language === 'fr' ? t(language, 'frenchEditionDesc') : t(language, 'englishEditionDesc')}
                </Text>
              </View>
              <SymbolView name="checkmark" size={17} tintColor={DewDesign.colors.terracotta} />
            </View>
          </View>

          {/* Community Updates */}
          <View style={[styles.section, isDark && styles.darkSection]}>
            <Text style={styles.sectionLabel}>{t(language, 'community')}</Text>
            <Pressable
              onPress={() => setNewsletterEnabled(!newsletterEnabled)}
              style={styles.settingRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: newsletterEnabled }}
              accessibilityLabel={t(language, 'ministryUpdates')}>
              <View style={styles.settingIcon}>
                <SymbolView name="envelope" size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.settingTitle, isDark && styles.darkInk]}>{t(language, 'ministryUpdates')}</Text>
                <Text style={[styles.settingMeta, isDark && styles.darkBody]}>
                  {newsletterEnabled ? t(language, 'subscribedUpdates') : t(language, 'receiveUpdates')}
                </Text>
              </View>
              <View style={[styles.toggle, newsletterEnabled && styles.toggleActive]}>
                <View style={[styles.toggleKnob, newsletterEnabled && styles.toggleKnobActive]} />
              </View>
            </Pressable>
          </View>

          {/* About & Support Links */}
          <Pressable
            onPress={() => router.push('/legal')}
            style={[styles.note, isDark && styles.darkSection]}
            accessibilityRole="button"
            accessibilityLabel={t(language, 'aboutPrivacySupport')}>
            <Text style={[styles.noteTitle, isDark && styles.darkInk]}>Daily Dew Devotional</Text>
            <Text style={styles.noteSubtitle}>A Devotional for the Strange Breeds</Text>
            <Text style={[styles.noteText, isDark && styles.darkBody]}>{t(language, 'aboutPrivacySupport')}</Text>
          </Pressable>
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
  darkSection: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  darkInk: { color: DewDesign.colors.darkInk },
  darkBody: { color: DewDesign.colors.darkBody },
  darkMuted: { color: DewDesign.colors.darkMuted },
  content: { paddingHorizontal: DewDesign.spacing.screen, paddingTop: 14, paddingBottom: 110 },
  kicker: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 35, fontWeight: '700', marginTop: 5 },
  subtitle: { color: DewDesign.colors.body, fontSize: 14, marginTop: 5, marginBottom: 24 },
  section: { backgroundColor: DewDesign.colors.surface, borderRadius: DewDesign.radius.card, padding: 17, marginBottom: 17, borderWidth: 1, borderColor: DewDesign.colors.line },
  sectionLabel: { color: DewDesign.colors.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginBottom: 15 },
  settingRow: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: DewDesign.colors.forestSoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginHorizontal: 11 },
  settingTitle: { color: DewDesign.colors.ink, fontSize: 15, fontWeight: '800' },
  settingMeta: { color: DewDesign.colors.body, fontSize: 11, lineHeight: 17, marginTop: 3 },
  authPill: { height: 32, borderRadius: DewDesign.radius.full, backgroundColor: DewDesign.colors.forest, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  authPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  signOutPill: { backgroundColor: DewDesign.colors.terracottaSoft },
  signOutPillText: { color: DewDesign.colors.terracotta },
  toggle: { width: 46, height: 28, borderRadius: 14, backgroundColor: DewDesign.colors.surfaceMuted, padding: 3, justifyContent: 'center' },
  toggleActive: { backgroundColor: DewDesign.colors.forest },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  toggleKnobActive: { alignSelf: 'flex-end' },
  timeChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginLeft: 49 },
  timeChoice: { minHeight: 34, borderRadius: 9, paddingHorizontal: 11, backgroundColor: DewDesign.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DewDesign.colors.line },
  darkTimeChoice: { backgroundColor: DewDesign.colors.darkSurfaceMuted, borderColor: DewDesign.colors.darkLine },
  timeChoiceActive: { backgroundColor: DewDesign.colors.forest, borderColor: DewDesign.colors.forest },
  timeChoiceText: { color: DewDesign.colors.body, fontSize: 11, fontWeight: '800' },
  timeChoiceTextActive: { color: '#FFFFFF' },
  segmented: { flexDirection: 'row', gap: 8, marginTop: 18 },
  sizeOption: { flex: 1, height: 42, borderRadius: 10, backgroundColor: DewDesign.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  sizeOptionActive: { backgroundColor: DewDesign.colors.forest },
  sizeText: { color: DewDesign.colors.body, fontWeight: '800' },
  sizeTextActive: { color: '#FFFFFF' },
  previewBox: { backgroundColor: DewDesign.colors.surfaceMuted, borderRadius: 12, padding: 14, marginTop: 14 },
  darkPreviewBox: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  previewBoxLabel: { fontSize: 9, fontWeight: '900', color: DewDesign.colors.terracotta, letterSpacing: 1.2, marginBottom: 6 },
  previewVerseText: { fontFamily: 'serif', color: DewDesign.colors.ink },
  languageRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  languageOption: { flex: 1, borderRadius: 10, backgroundColor: DewDesign.colors.surfaceMuted, paddingVertical: 11, alignItems: 'center' },
  languageOptionActive: { backgroundColor: DewDesign.colors.forest },
  languageText: { color: DewDesign.colors.body, fontSize: 13, fontWeight: '800' },
  languageTextActive: { color: '#FFFFFF' },
  note: { backgroundColor: DewDesign.colors.forestSoft, borderRadius: 17, padding: 18, marginTop: 6, borderWidth: 1, borderColor: DewDesign.colors.forestMuted },
  noteTitle: { color: DewDesign.colors.forest, fontFamily: 'serif', fontSize: 17, fontWeight: '700' },
  noteSubtitle: { color: DewDesign.colors.terracotta, fontSize: 12, fontWeight: '800', marginTop: 5 },
  noteText: { color: DewDesign.colors.body, fontSize: 12, marginTop: 6 },
});
