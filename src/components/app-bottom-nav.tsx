import AppIcon from '@/components/app-icon';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';
import { DewDesign } from '@/constants/design';

const items = [
  { label: 'Home', path: '/', icon: 'house' },
  { label: 'Library', path: '/explore', icon: 'books.vertical' },
  { label: 'Journey', path: '/journey', icon: 'calendar' },
] as const;

export default function AppBottomNav() {
  const pathname = usePathname();
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';

  return (
    <View style={styles.floatingWrapper}>
      <View style={[styles.pillBar, isDark ? styles.darkPillBar : styles.lightPillBar, DewDesign.shadows.floating]}>
        {items.map((item) => {
          const active = item.path === '/' ? pathname === '/' : pathname.endsWith(item.path);
          const activeColor = isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest;
          const inactiveColor = isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted;

          return (
            <Pressable
              key={item.path}
              onPress={() => router.replace(item.path as any)}
              style={({ pressed }) => [
                styles.item,
                active && (isDark ? styles.darkActiveItem : styles.lightActiveItem),
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Go to ${item.label}`}>
              <AppIcon name={item.icon} size={20} tintColor={active ? activeColor : inactiveColor} />
              <Text style={[styles.label, { color: active ? activeColor : inactiveColor }]}>
                {t(language, item.label.toLowerCase() as 'home' | 'library' | 'journey')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    bottom: 18,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 90,
  },
  pillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 32,
    borderWidth: 1,
    width: '100%',
    maxWidth: 440,
  },
  lightPillBar: {
    backgroundColor: DewDesign.colors.surface,
    borderColor: DewDesign.colors.line,
  },
  darkPillBar: {
    backgroundColor: DewDesign.colors.darkSurface,
    borderColor: DewDesign.colors.darkLine,
  },
  item: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  lightActiveItem: {
    backgroundColor: DewDesign.colors.forestSoft,
  },
  darkActiveItem: {
    backgroundColor: DewDesign.colors.darkSurfaceMuted,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
