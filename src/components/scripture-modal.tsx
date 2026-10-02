import AppIcon from '@/components/app-icon';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { DewDesign } from '@/constants/design';
import { fetchScripturePassage, getTranslationName, ScripturePassage, TranslationCode } from '@/lib/bible';

interface ScriptureModalProps {
  visible: boolean;
  reference: string;
  language: 'en' | 'fr';
  isDark?: boolean;
  onClose: () => void;
}

export default function ScriptureModal({ visible, reference, language, isDark, onClose }: ScriptureModalProps) {
  const [translation, setTranslation] = useState<TranslationCode>(language === 'fr' ? 'LSG' : 'NIV');
  const [passage, setPassage] = useState<ScripturePassage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && reference) {
      setLoading(true);
      fetchScripturePassage(reference, translation)
        .then(setPassage)
        .finally(() => setLoading(false));
    }
  }, [reference, translation, visible]);

  if (!visible) return null;

  const translations: TranslationCode[] = language === 'fr' ? ['LSG', 'S21', 'KJV'] : ['NIV', 'KJV', 'ESV'];

  const handleShare = async () => {
    if (!passage) return;
    await Share.share({
      title: passage.reference,
      message: `"${passage.text}"\n\n— ${passage.reference} (${passage.translation})`,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDark && styles.darkSheet, DewDesign.shadows.floating]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <AppIcon name="book.closed.fill" size={18} tintColor={DewDesign.colors.terracotta} />
              <Text style={[styles.reference, isDark && styles.darkInk]}>{reference}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close scripture modal">
              <AppIcon name="xmark.circle.fill" size={22} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
            </Pressable>
          </View>

          <View style={styles.translationRow}>
            {translations.map((code) => (
              <Pressable
                key={code}
                onPress={() => setTranslation(code)}
                style={[
                  styles.translationPill,
                  translation === code && styles.activePill,
                  isDark && styles.darkPill,
                  isDark && translation === code && styles.darkActivePill,
                ]}>
                <Text
                  style={[
                    styles.translationText,
                    translation === code && styles.activeTranslationText,
                    isDark && styles.darkTranslationText,
                  ]}>
                  {code}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <Text style={[styles.loadingText, isDark && styles.darkMuted]}>
                {language === 'fr' ? 'Chargement du passage...' : 'Loading passage...'}
              </Text>
            ) : (
              <>
                <Text style={[styles.passageText, isDark && styles.darkInk]}>{passage?.text}</Text>
                <Text style={[styles.translationMeta, isDark && styles.darkMuted]}>
                  {getTranslationName(translation)}
                </Text>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={handleShare} style={[styles.actionBtn, isDark && styles.darkActionBtn]}>
              <AppIcon name="square.and.arrow.up" size={16} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
              <Text style={[styles.actionText, isDark && styles.darkInk]}>
                {language === 'fr' ? 'Partager le passage' : 'Share Passage'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: DewDesign.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: 34,
    maxHeight: '75%',
  },
  darkSheet: {
    backgroundColor: DewDesign.colors.darkSurface,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: DewDesign.colors.line,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reference: {
    fontFamily: 'serif',
    fontSize: 22,
    fontWeight: '700',
    color: DewDesign.colors.ink,
  },
  darkInk: {
    color: DewDesign.colors.darkInk,
  },
  darkMuted: {
    color: DewDesign.colors.darkMuted,
  },
  closeBtn: {
    padding: 4,
  },
  translationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  translationPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DewDesign.radius.full,
    backgroundColor: DewDesign.colors.surfaceMuted,
  },
  darkPill: {
    backgroundColor: DewDesign.colors.darkSurfaceMuted,
  },
  activePill: {
    backgroundColor: DewDesign.colors.forest,
  },
  darkActivePill: {
    backgroundColor: DewDesign.colors.forestMuted,
  },
  translationText: {
    fontSize: 12,
    fontWeight: '800',
    color: DewDesign.colors.body,
  },
  darkTranslationText: {
    color: DewDesign.colors.darkMuted,
  },
  activeTranslationText: {
    color: DewDesign.colors.white,
  },
  bodyScroll: {
    maxHeight: 280,
  },
  bodyContent: {
    paddingVertical: 8,
  },
  passageText: {
    fontSize: 16,
    lineHeight: 26,
    color: DewDesign.colors.ink,
    fontFamily: 'serif',
  },
  translationMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: DewDesign.colors.muted,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  loadingText: {
    fontSize: 14,
    color: DewDesign.colors.muted,
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: DewDesign.colors.surfaceMuted,
    paddingTop: 14,
  },
  actionBtn: {
    height: 44,
    borderRadius: DewDesign.radius.control,
    backgroundColor: DewDesign.colors.forestSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  darkActionBtn: {
    backgroundColor: DewDesign.colors.darkSurfaceMuted,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
    color: DewDesign.colors.forest,
  },
});
