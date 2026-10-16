import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FUENTE_LIMITES, ISLAS_250M } from '@/lib/zonasProhibidas';
import { palette, radii, spacing } from '@/lib/theme';

/** Tarjeta que se abre al tocar un punto rojo del mapa. */
export function LimitePanel({
  ria, punto, otro, onClose,
}: {
  ria: string; punto: string; otro?: string; onClose: () => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.cab}>
        <View style={styles.dot}>
          <Ionicons name="close" size={12} color="#FFFFFF" />
        </View>
        <Text style={styles.titulo}>{ria}</Text>
      </View>
      <Text style={styles.punto}>{punto}{otro ? ` ↔ ${otro}` : ''}</Text>
      <Text style={styles.texto}>
        Pesca submarina prohibida <Text style={styles.fuerte}>por dentro de la línea</Text> que une estos puntos.
      </Text>
      <Text style={styles.nota}>
        Además, a menos de 250 m de las islas {ISLAS_250M.Lugo.join(', ')} (Lugo) y {ISLAS_250M['A Coruña'].join(', ')} (A Coruña).
      </Text>
      <Pressable
        onPress={() => Linking.openURL(FUENTE_LIMITES)}
        accessibilityRole="link"
        accessibilityLabel="Ver la fuente oficial de la Xunta"
        style={styles.fuente}
      >
        <Ionicons name="open-outline" size={14} color={palette.buoy} />
        <Text style={styles.fuenteTxt}>Fuente: Xunta de Galicia · orientativo</Text>
      </Pressable>
      <Pressable onPress={onClose} style={styles.close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cerrar">
        <Ionicons name="close" size={22} color={palette.foamSoft} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute', bottom: spacing.l + 4, left: spacing.m, right: spacing.m + 60, maxWidth: 440,
    backgroundColor: palette.surface, borderRadius: radii.m, borderWidth: 1, borderColor: palette.limit,
    padding: spacing.m, gap: 4,
  },
  cab: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingRight: 36 },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: palette.limit, alignItems: 'center', justifyContent: 'center' },
  titulo: { color: palette.foam, fontSize: 17, fontWeight: '600', flex: 1 },
  punto: { color: palette.foamSoft, fontSize: 14 },
  texto: { color: palette.foam, fontSize: 15, lineHeight: 21, marginTop: 2 },
  fuerte: { fontWeight: '700' },
  nota: { color: palette.foamSoft, fontSize: 12, lineHeight: 17, marginTop: 2 },
  fuente: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, marginTop: 2 },
  fuenteTxt: { color: palette.buoy, fontSize: 13, fontWeight: '600' },
  close: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
