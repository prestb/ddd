import AppIcon from '@/components/app-icon';
import { DewDesign } from '@/constants/design';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSettings } from '@/context/settings-context';

export default function ContentStatus({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  const { language } = useSettings();
  if (loading) return <View style={styles.skeleton}><View style={styles.skeletonIcon} /><View style={styles.skeletonCopy}><View style={styles.skeletonLine} /><View style={[styles.skeletonLine, styles.skeletonShort]} /></View></View>;
  if (!error) return null;
  const unavailable = error.includes('still a draft') || error.includes('No published edition') || error.includes('no meditations yet');
  const message = unavailable
    ? (language === 'fr' ? 'La méditation du mois sera bientôt disponible.' : 'This month\'s devotional will be available soon.')
    : error;
  return <View style={[styles.notice, unavailable && styles.emptyNotice]}><View style={styles.icon}><AppIcon name={unavailable ? 'clock' : 'cloud.offline'} size={16} tintColor={DewDesign.colors.terracotta} /></View><Text style={styles.copy}>{message}</Text>{!unavailable && <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button"><Text style={styles.retryText}>{language === 'fr' ? 'Réessayer' : 'Retry'}</Text></Pressable>}</View>;
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: DewDesign.colors.terracottaSoft, borderRadius: 12, padding: 11, marginHorizontal: 22, marginBottom: 10 },
  emptyNotice: { backgroundColor: DewDesign.colors.surfaceMuted },
  skeleton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: DewDesign.colors.surface, borderRadius: 14, padding: 14, marginHorizontal: 22, marginBottom: 10 },
  skeletonIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: DewDesign.colors.surfaceMuted },
  skeletonCopy: { flex: 1, gap: 7 },
  skeletonLine: { height: 10, width: '82%', borderRadius: 5, backgroundColor: DewDesign.colors.surfaceMuted },
  skeletonShort: { width: '52%' },
  icon: { width: 28, height: 28, borderRadius: 9, backgroundColor: DewDesign.colors.surface, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, color: DewDesign.colors.body, fontSize: 11, lineHeight: 16 },
  retry: { minHeight: 30, borderRadius: 8, backgroundColor: DewDesign.colors.forest, justifyContent: 'center', paddingHorizontal: 10 },
  retryText: { color: DewDesign.colors.white, fontSize: 11, fontWeight: '900' },
});
