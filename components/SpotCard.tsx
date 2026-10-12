import { View, ViewProps, Pressable, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import type { Spot } from '@/types';
import { palette, card, spacing, radii } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';
import { VisibilityBadge, accesoSpot } from './VisibilityBadge';

const FONDO_LABEL: Record<string, string> = {
  roca: 'Roca',
  'roca-arena': 'Roca + arena',
  arena: 'Arena',
  posidonia: 'Posidonia',
  mixto: 'Mixto',
  'casco-hundimiento': 'Pecio / casco',
};

export function SpotCard({ spot, onPress, style }: { spot: Spot; onPress?: () => void; style?: ViewProps['style'] }) {
  const { user } = useAuth();
  return (
    <Pressable onPress={onPress} style={[card, style ?? null]}>
      <View style={styles.row}>
        <ThemedText variant="h3" style={{ flex: 1 }} numberOfLines={1}>{spot.nombre}</ThemedText>
        <View style={styles.badge}>
          <ThemedText variant="small" style={{ color: palette.deep }}>
            {FONDO_LABEL[spot.fondo] ?? spot.fondo}
          </ThemedText>
        </View>
      </View>
      <VisibilityBadge acceso={accesoSpot(spot, user?.id)} />
      {!!spot.description && (
        <ThemedText variant="body" numberOfLines={2}>{spot.description}</ThemedText>
      )}
      <View style={styles.metaRow}>
        {!!spot.profundidad_max && (
          <ThemedText variant="small">Prof. máx: {spot.profundidad_max} m</ThemedText>
        )}
        <ThemedText variant="small">
          {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.xs },
  badge: {
    backgroundColor: palette.buoy,
    borderRadius: radii.s,
    paddingHorizontal: spacing.s,
    paddingVertical: 2,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
});
