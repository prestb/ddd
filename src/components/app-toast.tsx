import { StyleSheet, Text, View } from 'react-native';
import { DewDesign } from '@/constants/design';

export default function AppToast({ message, dark }: { message: string | null; dark?: boolean }) {
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.toast, dark && styles.darkToast, DewDesign.shadows.floating]}>
      <Text style={styles.icon}>✓</Text>
      <Text style={[styles.text, dark && styles.darkText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    zIndex: 300,
    top: 72,
    left: 20,
    right: 20,
    minHeight: 46,
    borderRadius: DewDesign.radius.full,
    backgroundColor: DewDesign.colors.forestSoft,
    borderWidth: 1,
    borderColor: DewDesign.colors.forestMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  darkToast: {
    backgroundColor: DewDesign.colors.darkSurfaceMuted,
    borderColor: DewDesign.colors.darkLine,
  },
  icon: {
    color: DewDesign.colors.terracotta,
    fontSize: 16,
    fontWeight: '900',
  },
  text: {
    color: DewDesign.colors.forest,
    fontSize: 13,
    fontWeight: '800',
  },
  darkText: {
    color: DewDesign.colors.darkInk,
  },
});
