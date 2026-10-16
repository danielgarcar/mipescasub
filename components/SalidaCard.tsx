import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '@/components/ui';
import { estadoVisible, fmtDiaHora, fmtHora } from '@/hooks/useSalidas';
import { palette, radii, spacing } from '@/lib/theme';
import type { EstadoSalida, VisibilidadSalida } from '@/types';

type Datos = {
  estado: EstadoSalida;
  inicio: string;
  fin_previsto: string;
  personas: number;
  visibilidad: VisibilidadSalida;
  autor?: string | null;
  es_mia?: boolean;
};

const VIS: Record<VisibilidadSalida, { icon: keyof typeof Ionicons.glyphMap; texto: string }> = {
  privada: { icon: 'lock-closed', texto: 'Solo tú' },
  usuarios: { icon: 'people', texto: 'Usuarios elegidos' },
  publica: { icon: 'earth', texto: 'Pública · zona aproximada' },
};

/** Tarjeta de una salida (propia o ajena). La ubicación de las ajenas es siempre una zona aproximada. */
export function SalidaCard({
  s, onPress, onVerMapa,
}: {
  s: Datos; onPress?: () => void; onVerMapa?: () => void;
}) {
  const est = estadoVisible(s);
  const titulo = s.es_mia ? 'Mi salida' : s.autor ?? 'Un pescador';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${titulo}, ${est.texto}, ${fmtDiaHora(s.inicio)}`}
      style={styles.card}
    >
      <View style={styles.cab}>
        <Ionicons name="boat-outline" size={22} color={palette.buoy} />
        <Text style={styles.titulo} numberOfLines={1}>{titulo}</Text>
        <Badge text={est.texto} tone={est.tono} />
      </View>
      <Text style={styles.hora}>
        {fmtDiaHora(s.inicio)} – {fmtHora(s.fin_previsto)} · {s.personas} {s.personas === 1 ? 'persona' : 'personas'}
      </Text>
      <View style={styles.pie}>
        <View style={styles.vis}>
          <Ionicons name={VIS[s.visibilidad].icon} size={14} color={palette.foamSoft} />
          <Text style={styles.visTxt}>{VIS[s.visibilidad].texto}</Text>
        </View>
        {onVerMapa && (
          <Pressable onPress={onVerMapa} hitSlop={8} accessibilityRole="button" accessibilityLabel="Ver zona en el mapa" style={styles.mapa}>
            <Ionicons name="map-outline" size={16} color={palette.buoy} />
            <Text style={styles.mapaTxt}>Ver zona</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface, borderRadius: radii.m, borderWidth: 1, borderColor: palette.line,
    padding: spacing.m, gap: spacing.xs,
  },
  cab: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  titulo: { flex: 1, color: palette.foam, fontSize: 17, fontWeight: '600' },
  hora: { color: palette.foam, fontSize: 15 },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  vis: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visTxt: { color: palette.foamSoft, fontSize: 13 },
  mapa: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingLeft: spacing.s },
  mapaTxt: { color: palette.buoy, fontSize: 14, fontWeight: '600' },
});
