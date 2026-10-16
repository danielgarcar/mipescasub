import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/lib/theme';
import type { Acceso } from './VisibilityBadge';

const ICONO: Partial<Record<Acceso, keyof typeof Ionicons.glyphMap>> = {
  privado: 'lock-closed',
  compartido: 'people',
};

/**
 * Marcador de spot: una diana verde. Los spots no públicos llevan una pequeña insignia
 * (candado / personas) para que el acceso no dependa solo del color.
 */
export function DianaSpot({ acceso, size = 30 }: { acceso: Acceso; size?: number }) {
  const medio = Math.round(size * 0.66);
  const centro = Math.round(size * 0.38);
  const punto = Math.max(3, Math.round(size * 0.14));
  const insignia = ICONO[acceso];
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.anillo, { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.spot }]}>
        <View style={[styles.anillo, { width: medio, height: medio, borderRadius: medio / 2, backgroundColor: palette.foam }]}>
          <View style={[styles.anillo, { width: centro, height: centro, borderRadius: centro / 2, backgroundColor: palette.spot }]}>
            <View style={{ width: punto, height: punto, borderRadius: punto / 2, backgroundColor: palette.foam }} />
          </View>
        </View>
      </View>
      {insignia && (
        <View style={styles.insignia}>
          <Ionicons name={insignia} size={9} color={palette.foam} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  anillo: { alignItems: 'center', justifyContent: 'center' },
  insignia: {
    position: 'absolute', top: -4, right: -4, width: 15, height: 15, borderRadius: 8,
    backgroundColor: palette.abyss, borderWidth: 1, borderColor: palette.foamSoft,
    alignItems: 'center', justifyContent: 'center',
  },
});
