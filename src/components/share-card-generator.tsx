import AppIcon from '@/components/app-icon';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { DewDesign } from '@/constants/design';

export type CardBackground =
  | 'forest'
  | 'terracotta'
  | 'gold'
  | 'midnight'
  | 'bg_sunrise'
  | 'bg_forest'
  | 'bg_mountain'
  | 'bg_stars'
  | 'bg_autumn'
  | 'bg_ocean'
  | 'bg_clouds'
  | 'bg_path';

export type CardContentType = 'scripture' | 'declaration' | 'wisdom' | 'prayer';

const BACKGROUND_PRESETS: { code: CardBackground; name: string; color: string; imageUri?: string }[] = [
  { code: 'forest', name: 'Forest', color: '#2C4A38' },
  { code: 'terracotta', name: 'Clay', color: '#BA663B' },
  { code: 'gold', name: 'Gold', color: '#C29B48' },
  { code: 'midnight', name: 'Midnight', color: '#141E18' },
  {
    code: 'bg_sunrise',
    name: 'Sunrise',
    color: '#D97706',
    imageUri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
  },
  {
    code: 'bg_forest',
    name: 'Pines',
    color: '#15803D',
    imageUri: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop',
  },
  {
    code: 'bg_mountain',
    name: 'Peak',
    color: '#0369A1',
    imageUri: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
  },
  {
    code: 'bg_stars',
    name: 'Cosmos',
    color: '#4338CA',
    imageUri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800&auto=format&fit=crop',
  },
  {
    code: 'bg_autumn',
    name: 'Autumn',
    color: '#B45309',
    imageUri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop',
  },
  {
    code: 'bg_ocean',
    name: 'Waves',
    color: '#0284C7',
    imageUri: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?q=80&w=800&auto=format&fit=crop',
  },
  {
    code: 'bg_clouds',
    name: 'Sky',
    color: '#475569',
    imageUri: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?q=80&w=800&auto=format&fit=crop',
  },
  {
    code: 'bg_path',
    name: 'Path',
    color: '#059669',
    imageUri: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800&auto=format&fit=crop',
  },
];

interface ShareCardGeneratorProps {
  visible: boolean;
  title: string;
  scripture: string;
  declaration: string;
  wisdom: string;
  prayer?: string;
  language: 'en' | 'fr';
  isDark?: boolean;
  onClose: () => void;
}

export default function ShareCardGenerator({
  visible,
  title,
  scripture,
  declaration,
  wisdom,
  prayer,
  language,
  isDark,
  onClose,
}: ShareCardGeneratorProps) {
  const [bgChoice, setBgChoice] = useState<CardBackground>('forest');
  const [contentType, setContentType] = useState<CardContentType>('scripture');
  const cardRef = useRef<View>(null);

  if (!visible) return null;

  const currentPreset = BACKGROUND_PRESETS.find((p) => p.code === bgChoice) ?? BACKGROUND_PRESETS[0];

  const getThemeStyles = () => {
    if (currentPreset.imageUri) {
      return { bg: '#141E18', text: '#FFFFFF', badgeBg: 'rgba(255,255,255,0.25)', badgeText: '#FFFFFF', accent: '#F8F1DF' };
    }
    switch (bgChoice) {
      case 'terracotta':
        return { bg: '#BA663B', text: '#FFFFFF', badgeBg: 'rgba(255,255,255,0.2)', badgeText: '#FFFFFF', accent: '#F6E8DF' };
      case 'gold':
        return { bg: '#C29B48', text: '#1A241E', badgeBg: 'rgba(26,36,30,0.15)', badgeText: '#1A241E', accent: '#1A241E' };
      case 'midnight':
        return { bg: '#141E18', text: '#F5F1E9', badgeBg: '#27382E', badgeText: '#C29B48', accent: '#C29B48' };
      case 'forest':
      default:
        return { bg: '#2C4A38', text: '#FFFFFF', badgeBg: '#3D614B', badgeText: '#F8F1DF', accent: '#C29B48' };
    }
  };

  const themeStyle = getThemeStyles();

  const getContentText = () => {
    switch (contentType) {
      case 'declaration':
        return declaration;
      case 'wisdom':
        return wisdom;
      case 'prayer':
        return prayer || declaration;
      case 'scripture':
      default:
        return scripture;
    }
  };

  const contentLabel = contentType === 'scripture'
    ? (language === 'fr' ? "ÉCRITURE DU JOUR" : "TODAY'S SCRIPTURE")
    : contentType === 'declaration'
      ? (language === 'fr' ? "DÉCLARATION DU JOUR" : "TODAY'S DECLARATION")
      : contentType === 'wisdom'
        ? (language === 'fr' ? "PENSÉE DU JOUR" : "TODAY'S WISDOM NUGGET")
        : (language === 'fr' ? "PRIÈRE DU JOUR" : "TODAY'S PRAYER");

  const handleExportShare = async () => {
    const bodyText = getContentText();
    const shareMessage = `DAILY DEW DEVOTIONAL\n\n${title.toUpperCase()}\n${contentLabel}\n\n${bodyText}\n\n— Daily Dew Devotional`;

    if (!cardRef.current) {
      await Share.share({ title, message: shareMessage });
      return;
    }

    try {
      const available = await Sharing.isAvailableAsync();
      if (available) {
        const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
      } else {
        await Share.share({ title, message: shareMessage });
      }
    } catch {
      try {
        await Share.share({ title, message: shareMessage });
      } catch {
        // Ignore fallback error
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDark && styles.darkSheet, DewDesign.shadows.floating]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={[styles.headerTitle, isDark && styles.darkInk]}>
              {language === 'fr' ? 'Créer une Carte Visuale' : 'Share Graphic Card'}
            </Text>
            <Pressable onPress={onClose} accessibilityLabel="Close card generator">
              <AppIcon name="xmark.circle.fill" size={22} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
            </Pressable>
          </View>

          {/* Live Preview Card */}
          <View ref={cardRef} collapsable={false} style={[styles.cardPreview, { backgroundColor: themeStyle.bg }]}>
            {currentPreset.imageUri ? (
              <Image
                source={{ uri: currentPreset.imageUri }}
                style={styles.backgroundImage}
                contentFit="cover"
              />
            ) : null}
            {currentPreset.imageUri ? <View style={styles.imageOverlay} /> : null}

            <View style={[styles.cardBadge, { backgroundColor: themeStyle.badgeBg }]}>
              <Text style={[styles.cardBadgeText, { color: themeStyle.badgeText }]}>{contentLabel}</Text>
            </View>
            <Text style={[styles.cardTitle, { color: themeStyle.accent }]}>{title}</Text>
            <Text style={[styles.cardBody, { color: themeStyle.text }]}>{getContentText()}</Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.brandMark, { color: themeStyle.accent }]}>DAILY DEW DEVOTIONAL</Text>
              <Text style={[styles.brandTagline, { color: themeStyle.badgeText }]}>A DEVOTIONAL FOR THE STRANGE BREEDS</Text>
            </View>
          </View>

          {/* Content Type Picker */}
          <Text style={[styles.sectionLabel, isDark && styles.darkMuted]}>
            {language === 'fr' ? 'CONTENU DU JOUR' : 'TODAY’S CONTENT'}
          </Text>
          <View style={styles.pickerRow}>
            {(['scripture', 'declaration', 'wisdom', 'prayer'] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setContentType(type)}
                style={[
                  styles.pickerPill,
                  contentType === type && styles.activePickerPill,
                  isDark && styles.darkPickerPill,
                  isDark && contentType === type && styles.darkActivePickerPill,
                ]}>
                <Text style={[styles.pickerText, contentType === type && styles.activePickerText]}>
                  {type.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Theme Palette & Image Picker */}
          <Text style={[styles.sectionLabel, isDark && styles.darkMuted]}>
            {language === 'fr' ? 'STYLE & IMAGE DE FOND' : 'BACKGROUND STYLE & IMAGE'}
          </Text>
          <View style={styles.pickerRow}>
            {BACKGROUND_PRESETS.map((p) => (
              <Pressable
                key={p.code}
                onPress={() => setBgChoice(p.code)}
                style={[
                  styles.colorCircle,
                  { backgroundColor: p.color },
                  bgChoice === p.code && styles.selectedCircle,
                ]}>
                {p.imageUri ? <Image source={{ uri: p.imageUri }} style={styles.circleThumbnail} contentFit="cover" /> : null}
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleExportShare} style={styles.shareBtn}>
            <AppIcon name="square.and.arrow.up" size={18} tintColor="#FFFFFF" />
            <Text style={styles.shareBtnText}>
              {language === 'fr' ? 'Partager l’Image' : 'Export & Share Image'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: DewDesign.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: 34,
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
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: DewDesign.colors.ink,
  },
  darkInk: {
    color: DewDesign.colors.darkInk,
  },
  darkMuted: {
    color: DewDesign.colors.darkMuted,
  },
  cardPreview: {
    borderRadius: 20,
    padding: 20,
    minHeight: 220,
    justifyContent: 'space-between',
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 18, 14, 0.68)',
    borderRadius: 20,
  },
  cardBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
    zIndex: 2,
  },
  cardBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.5,
    zIndex: 2,
  },
  cardBody: {
    fontFamily: 'serif',
    fontSize: 16,
    lineHeight: 24,
    marginVertical: 8,
    zIndex: 2,
  },
  cardFooter: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
    marginTop: 14,
    zIndex: 2,
  },
  brandMark: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  brandTagline: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    opacity: 0.85,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: DewDesign.colors.muted,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 6,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  pickerPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: DewDesign.radius.full,
    backgroundColor: DewDesign.colors.surfaceMuted,
  },
  darkPickerPill: {
    backgroundColor: DewDesign.colors.darkSurfaceMuted,
  },
  activePickerPill: {
    backgroundColor: DewDesign.colors.forest,
  },
  darkActivePickerPill: {
    backgroundColor: DewDesign.colors.forestMuted,
  },
  pickerText: {
    fontSize: 10,
    fontWeight: '900',
    color: DewDesign.colors.body,
  },
  activePickerText: {
    color: DewDesign.colors.white,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  selectedCircle: {
    borderWidth: 3,
    borderColor: DewDesign.colors.terracotta,
  },
  circleThumbnail: {
    width: '100%',
    height: '100%',
  },
  shareBtn: {
    height: 48,
    borderRadius: DewDesign.radius.control,
    backgroundColor: DewDesign.colors.terracotta,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
