import AppIcon from '@/components/app-icon';
import { StyleSheet, Text, View } from 'react-native';
import { DewDesign } from '@/constants/design';

interface SpiritualMilestonesProps {
  completedDaysCount: number;
  reflectionsCount: number;
  prayersCount: number;
  answeredPrayersCount: number;
  language: 'en' | 'fr';
  isDark?: boolean;
}

export default function SpiritualMilestones({
  completedDaysCount,
  reflectionsCount,
  prayersCount,
  answeredPrayersCount,
  language,
  isDark,
}: SpiritualMilestonesProps) {
  const milestones = [
    {
      id: 'grace_7',
      title: language === 'fr' ? '7 Jours de Grâce' : '7 Days of Grace',
      desc: language === 'fr' ? '7 méditations achevées' : '7 meditations completed',
      unlocked: completedDaysCount >= 7,
      icon: 'flame.fill',
    },
    {
      id: 'prayer_warrior',
      title: language === 'fr' ? 'Guerrier en Prière' : 'Prayer Warrior',
      desc: language === 'fr' ? '3 prières consignées' : '3 prayers recorded',
      unlocked: prayersCount >= 3,
      icon: 'hands.sparkles.fill',
    },
    {
      id: 'answered_faith',
      title: language === 'fr' ? 'Dieu Répond' : 'Praise & Answered',
      desc: language === 'fr' ? 'Prière exaucée' : 'Answered prayer recorded',
      unlocked: answeredPrayersCount >= 1,
      icon: 'checkmark.seal.fill',
    },
    {
      id: 'deep_reflector',
      title: language === 'fr' ? 'Cœur Réfléchi' : 'Reflective Heart',
      desc: language === 'fr' ? '5 réflexions écrites' : '5 notes written',
      unlocked: reflectionsCount >= 5,
      icon: 'pencil.line',
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>
        {language === 'fr' ? 'Jalons de Croissance Spirituelle' : 'Spiritual Growth Milestones'}
      </Text>
      <View style={styles.badgeGrid}>
        {milestones.map((m) => (
          <View
            key={m.id}
            style={[
              styles.badgeCard,
              m.unlocked ? styles.unlockedCard : styles.lockedCard,
              isDark && (m.unlocked ? styles.darkUnlockedCard : styles.darkLockedCard),
            ]}>
            <View style={[styles.badgeIcon, m.unlocked ? styles.unlockedIcon : styles.lockedIcon]}>
              <AppIcon name={m.icon} size={20} tintColor={m.unlocked ? '#FFFFFF' : (isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted)} />
            </View>
            <Text style={[styles.badgeTitle, isDark && styles.darkInk, !m.unlocked && styles.lockedText]} numberOfLines={1}>
              {m.title}
            </Text>
            <Text style={[styles.badgeDesc, isDark && styles.darkMuted]} numberOfLines={2}>
              {m.desc}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: DewDesign.colors.ink,
    marginBottom: 12,
  },
  darkInk: {
    color: DewDesign.colors.darkInk,
  },
  darkMuted: {
    color: DewDesign.colors.darkMuted,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgeCard: {
    width: '48%',
    borderRadius: DewDesign.radius.card,
    padding: 14,
    borderWidth: 1,
  },
  unlockedCard: {
    backgroundColor: DewDesign.colors.forestSoft,
    borderColor: DewDesign.colors.forestMuted,
  },
  darkUnlockedCard: {
    backgroundColor: DewDesign.colors.darkSurfaceMuted,
    borderColor: DewDesign.colors.darkLine,
  },
  lockedCard: {
    backgroundColor: DewDesign.colors.surfaceMuted,
    borderColor: DewDesign.colors.line,
    opacity: 0.7,
  },
  darkLockedCard: {
    backgroundColor: DewDesign.colors.darkSurface,
    borderColor: DewDesign.colors.darkLine,
    opacity: 0.6,
  },
  badgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  unlockedIcon: {
    backgroundColor: DewDesign.colors.forest,
  },
  lockedIcon: {
    backgroundColor: DewDesign.colors.muted,
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: DewDesign.colors.ink,
    marginBottom: 2,
  },
  lockedText: {
    color: DewDesign.colors.body,
  },
  badgeDesc: {
    fontSize: 11,
    color: DewDesign.colors.body,
  },
});
