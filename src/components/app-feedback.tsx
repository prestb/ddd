import AppIcon from '@/components/app-icon';
import { DewDesign } from '@/constants/design';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

export type FeedbackType = 'success' | 'error' | 'warning' | 'info';

export type AppFeedbackProps = {
  type: FeedbackType;
  title: string;
  message: string;
  isDark?: boolean;
  style?: ViewStyle;
};

export default function AppFeedback({ type, title, message, isDark = false, style }: AppFeedbackProps) {
  if (!message && !title) return null;

  const config = {
    success: {
      icon: 'checkmark.circle',
      bgLight: DewDesign.colors.forestSoft,
      bgDark: 'rgba(30, 42, 36, 0.95)',
      borderColorLight: DewDesign.colors.forest,
      borderColorDark: '#4E735B',
      accentColorLight: DewDesign.colors.forest,
      accentColorDark: '#7DA68D',
    },
    error: {
      icon: 'xmark.circle.fill',
      bgLight: DewDesign.colors.terracottaSoft,
      bgDark: 'rgba(54, 30, 26, 0.95)',
      borderColorLight: DewDesign.colors.terracotta,
      borderColorDark: '#C86A50',
      accentColorLight: DewDesign.colors.terracotta,
      accentColorDark: '#E88B73',
    },
    warning: {
      icon: 'info.circle',
      bgLight: '#FFF8E7',
      bgDark: 'rgba(52, 42, 20, 0.95)',
      borderColorLight: '#E0B66A',
      borderColorDark: '#B8860B',
      accentColorLight: '#B8860B',
      accentColorDark: '#E0B66A',
    },
    info: {
      icon: 'info.circle',
      bgLight: DewDesign.colors.surfaceMuted,
      bgDark: DewDesign.colors.darkSurfaceMuted,
      borderColorLight: DewDesign.colors.line,
      borderColorDark: DewDesign.colors.darkLine,
      accentColorLight: DewDesign.colors.forest,
      accentColorDark: DewDesign.colors.darkInk,
    },
  }[type];

  const bg = isDark ? config.bgDark : config.bgLight;
  const borderColor = isDark ? config.borderColorDark : config.borderColorLight;
  const accentColor = isDark ? config.accentColorDark : config.accentColorLight;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bg, borderColor },
        isDark && styles.containerDark,
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${message}`}>
      <View style={styles.iconContainer}>
        <AppIcon name={config.icon} size={20} tintColor={accentColor} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
        <Text style={[styles.message, isDark && styles.messageDark]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginVertical: 12,
    gap: 12,
  },
  containerDark: {
    // dark mode border overrides handled via config
  },
  iconContainer: {
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  message: {
    fontSize: 12,
    lineHeight: 18,
    color: DewDesign.colors.body,
    fontWeight: '600',
  },
  messageDark: {
    color: DewDesign.colors.darkBody,
  },
});
