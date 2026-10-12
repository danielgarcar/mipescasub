import { View, StyleSheet, Image } from 'react-native';
import { ThemedText } from './ThemedText';
import type { Captura } from '@/types';
import { palette, card, spacing, radii } from '@/lib/theme';

export function CaptureCard({ capture }: { capture: Captura }) {
  return (
    <View style={[card, styles.row]}>
      {capture.foto_url ? (
        <Image source={{ uri: capture.foto_url }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.placeholder]}>
          <ThemedText variant="small" style={{ color: palette.deep }}>—</ThemedText>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.headerRow}>
          <ThemedText variant="h3" style={{ flex: 1 }} numberOfLines={1}>{capture.especie}</ThemedText>
          {!!capture.peso_kg && (
            <View style={styles.weightBadge}>
              <ThemedText variant="small" style={{ color: palette.deep }}>{capture.peso_kg} kg</ThemedText>
            </View>
          )}
        </View>
        <ThemedText variant="small">Prof: {capture.profundidad_m} m</ThemedText>
        {capture.created_at && (
          <ThemedText variant="small">
            {new Date(capture.created_at).toLocaleDateString('es-ES')}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.m, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: radii.s, backgroundColor: palette.highlight },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  weightBadge: {
    backgroundColor: palette.ok,
    borderRadius: radii.s,
    paddingHorizontal: spacing.s,
    paddingVertical: 2,
  },
});
