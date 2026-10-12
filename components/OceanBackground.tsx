import { Platform, StyleSheet, View } from 'react-native';
import OceanWaves from './OceanWaves';
import { palette } from '@/lib/theme';

/**
 * Fondo marino animado: degradado de superficie a fondo profundo y, encima, la escena animada
 * de `OceanWaves` (rayos de luz, peces, medusas, burbujas, algas y olas). La escena solo existe
 * en web; en móvil queda el degradado.
 */
export function OceanBackground() {
  const web = Platform.OS === 'web';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.abyss }, web && ({ backgroundImage: GRADIENTE } as any)]} />
      <OceanWaves />
      {web && <View style={[StyleSheet.absoluteFill, { backgroundImage: VELO } as any]} />}
    </View>
  );
}

// De la luz turquesa de la superficie al azul casi negro del fondo.
const GRADIENTE = 'linear-gradient(180deg, #0b4f6c 0%, #07324d 28%, #04223c 55%, #021627 82%, #010b14 100%)';
// Viñeteado suave y un reflejo cálido abajo.
const VELO =
  'radial-gradient(120% 90% at 50% 40%, rgba(2,22,39,0) 40%, rgba(1,11,20,0.55) 100%),' +
  'radial-gradient(60% 30% at 50% 105%, rgba(255,107,87,0.12) 0%, rgba(255,107,87,0) 70%)';
