import { View, StyleSheet, ViewProps } from 'react-native';
import { ThemedText } from './ThemedText';
import { card, spacing } from '@/lib/theme';

export function StatCard({ label, value, sub, style }: { label: string; value: string | number; sub?: string; style?: ViewProps['style'] }) {
  return (
    <View style={[card, styles.card, style ?? null]}>
      <ThemedText variant="small" style={styles.label}>{label}</ThemedText>
      <ThemedText variant="h1" numberOfLines={1} adjustsFontSizeToFit>{value}</ThemedText>
      {!!sub && <ThemedText variant="small">{sub}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, alignItems: 'center' },
  label: { textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
});
