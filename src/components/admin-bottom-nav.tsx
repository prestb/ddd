import AppIcon from '@/components/app-icon';
import { DewDesign } from '@/constants/design';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSettings } from '@/context/settings-context';
import { t, TranslationKey } from '@/lib/i18n';

export type AdminTab = 'content' | 'newsletters' | 'analytics' | 'users' | 'finance';

const items: { key: AdminTab; label: TranslationKey; icon: string }[] = [
  { key: 'content', label: 'content', icon: 'book.closed' },
  { key: 'newsletters', label: 'newsletters', icon: 'envelope' },
  { key: 'analytics', label: 'analytics', icon: 'chart.bar.fill' },
  { key: 'users', label: 'manageAccount', icon: 'person.crop.circle' },
  { key: 'finance', label: 'membershipAndBalance', icon: 'creditcard' },
];

export default function AdminBottomNav({
  activeTab,
  onChange,
  role,
}: {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
  role?: string | null;
}) {
  const { language, themeMode } = useSettings();
  const isDark = themeMode === 'dark';

  const visibleItems = items.filter((item) => {
    if (item.key === 'users' || item.key === 'finance') {
      return role === 'admin';
    }
    return true;
  });

  return (
    <View style={[styles.bar, isDark ? styles.darkBar : styles.lightBar]}>
      {visibleItems.map((item) => {
        const active = item.key === activeTab;
        return (
          <Pressable key={item.key} onPress={() => onChange(item.key)} style={[styles.item, active && (isDark ? styles.activeItem : styles.lightActiveItem)]} accessibilityRole="button" accessibilityLabel={t(language, item.label)}>
            <AppIcon name={item.icon} size={19} tintColor={active ? (isDark ? '#FFFFFF' : '#31543F') : (isDark ? '#AAAAB7' : '#899189')} />
            <Text numberOfLines={1} style={[styles.label, isDark ? styles.darkLabel : styles.lightLabel, active && (isDark ? styles.activeLabel : styles.lightActiveLabel)]}>{t(language, item.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 76, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, paddingVertical: 8 },
  darkBar: { backgroundColor: '#000000', borderTopColor: '#202126' },
  lightBar: { backgroundColor: '#FFFCF7', borderTopColor: '#E0DBD0' },
  item: { flex: 1, minHeight: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 2 },
  activeItem: { backgroundColor: '#202126' },
  lightActiveItem: { backgroundColor: '#E9E7DF' },
  label: { fontSize: 9, fontWeight: '800' },
  darkLabel: { color: '#AAAAB7' },
  lightLabel: { color: '#899189' },
  activeLabel: { color: DewDesign.colors.white },
  lightActiveLabel: { color: '#31543F' },
});
