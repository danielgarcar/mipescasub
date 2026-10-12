import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii } from '@/lib/theme';
import type { Spot } from '@/types';

export type Acceso = 'publico' | 'privado' | 'compartido';

/** Cómo ve el usuario actual un spot: público, privado suyo o privado compartido con él. */
export function accesoSpot(spot: Spot, userId?: string | null): Acceso {
  if (spot.publico) return 'publico';
  return spot.user_id && spot.user_id === userId ? 'privado' : 'compartido';
}

const INFO: Record<Acceso, { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }> = {
  publico: { icon: 'earth', label: 'Público', color: palette.ok },
  privado: { icon: 'lock-closed', label: 'Privado', color: palette.coral },
  compartido: { icon: 'people', label: 'Compartido contigo', color: palette.buoy },
};

export function VisibilityBadge({ acceso }: { acceso: Acceso }) {
  const i = INFO[acceso];
  return (
    <View style={[styles.badge, { borderColor: i.color }]}>
      <Ionicons name={i.icon} size={12} color={i.color} />
      <Text style={[styles.text, { color: i.color }]}>{i.label}</Text>
    </View>
  );
}

/** Color del marcador en el mapa según el acceso. */
export const COLOR_ACCESO: Record<Acceso, string> = {
  publico: palette.buoy,
  privado: palette.coral,
  compartido: '#7aa7ff',
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radii.s,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '700' },
});
