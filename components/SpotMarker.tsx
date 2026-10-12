import { Platform } from 'react-native';
import { Marker, Circle } from 'react-native-maps';
import type { Spot } from '@/types';
import { palette } from '@/lib/theme';

const FONDO_COLOR: Record<string, string> = {
  roca: '#7A5C3E',
  'roca-arena': '#9C7B4F',
  arena: '#D9C48A',
  posidonia: '#2ED3A8',
  mixto: '#4BA3C7',
  'casco-hundimiento': '#B0413E',
};

export function SpotMarker({ spot, onPress }: { spot: Spot; onPress?: () => void }) {
  return (
    <Marker
      coordinate={{ latitude: spot.lat, longitude: spot.lng }}
      title={spot.nombre}
      description={spot.description ?? undefined}
      pinColor={FONDO_COLOR[spot.fondo] ?? palette.buoy}
      onPress={onPress}
    />
  );
}

export function SpotCircle({ spot }: { spot: Spot }) {
  // radio ~ 100 m en torno al spot (visual)
  return (
    <Circle
      center={{ latitude: spot.lat, longitude: spot.lng }}
      radius={100}
      strokeWidth={1}
      strokeColor={palette.buoy + '66'}
      fillColor={palette.buoy + '14'}
    />
  );
}
