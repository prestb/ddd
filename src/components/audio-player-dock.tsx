import AppIcon from '@/components/app-icon';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DewDesign } from '@/constants/design';

interface AudioPlayerDockProps {
  title: string;
  textToSpeak: string;
  isDark?: boolean;
  language: 'en' | 'fr';
}

export default function AudioPlayerDock({ title, textToSpeak, isDark, language }: AudioPlayerDockProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(0.9);
  const [ambient, setAmbient] = useState<'none' | 'piano' | 'rain'>('none');

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      Speech.stop();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    Speech.speak(`${title}. ${textToSpeak}`, {
      language: language === 'fr' ? 'fr-FR' : 'en-US',
      rate: speechRate,
      onDone: () => setIsPlaying(false),
      onStopped: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  const cycleSpeed = () => {
    const nextRate = speechRate === 0.9 ? 1.1 : speechRate === 1.1 ? 0.75 : 0.9;
    setSpeechRate(nextRate);
    if (isPlaying) {
      Speech.stop();
      setIsPlaying(false);
    }
  };

  const cycleAmbient = () => {
    const nextAmbient = ambient === 'none' ? 'piano' : ambient === 'piano' ? 'rain' : 'none';
    setAmbient(nextAmbient);
  };

  const ambientLabel = ambient === 'none'

  return (
    <View style={[styles.dock, isDark && styles.darkDock, DewDesign.shadows.floating]}>
      <View style={styles.infoRow}>
        <View style={styles.iconCircle}>
          <AppIcon name="play.circle.fill" size={24} tintColor={DewDesign.colors.terracotta} />
        </View>
        <View style={styles.titleCol}>
          <Text style={[styles.eyebrow, isDark && styles.darkMuted]}>
            {language === 'fr' ? 'ÉCOUTE GUIDÉE' : 'AUDIO MEDITATION'}
          </Text>
          <Text style={[styles.title, isDark && styles.darkInk]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      <View style={styles.controlsRow}>
        <Pressable onPress={cycleAmbient} style={[styles.pillBtn, isDark && styles.darkPillBtn]}>
          <Text style={[styles.pillText, isDark && styles.darkInk]}>{ambientLabel}</Text>
        </Pressable>

        <Pressable onPress={cycleSpeed} style={[styles.pillBtn, isDark && styles.darkPillBtn]}>
          <Text style={[styles.pillText, isDark && styles.darkInk]}>{speechRate}x</Text>
        </Pressable>

        <Pressable onPress={togglePlay} style={styles.playBtn} accessibilityLabel={isPlaying ? 'Pause meditation' : 'Play meditation'}>
          <AppIcon name={isPlaying ? 'pause.fill' : 'play.fill'} size={20} tintColor="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    backgroundColor: DewDesign.colors.surface,
    borderWidth: 1,
    borderColor: DewDesign.colors.line,
    borderRadius: 24,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 14,
  },
  darkDock: {
    backgroundColor: DewDesign.colors.darkSurface,
    borderColor: DewDesign.colors.darkLine,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DewDesign.colors.terracottaSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '900',
    color: DewDesign.colors.terracotta,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: DewDesign.colors.ink,
    marginTop: 1,
  },
  darkInk: {
    color: DewDesign.colors.darkInk,
  },
  darkMuted: {
    color: DewDesign.colors.darkMuted,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DewDesign.radius.full,
    backgroundColor: DewDesign.colors.surfaceMuted,
  },
  darkPillBtn: {
    backgroundColor: DewDesign.colors.darkSurfaceMuted,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    color: DewDesign.colors.body,
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: DewDesign.colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
