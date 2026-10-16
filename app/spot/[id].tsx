import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Image, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { fetchSpot, fetchSpotCapturas } from '@/hooks/useSpots';
import { useAuth } from '@/hooks/useAuth';
import { SpotAcceso } from '@/components/SpotAcceso';
import { SpotComentarios } from '@/components/SpotComentarios';
import { VisibilityBadge, accesoSpot } from '@/components/VisibilityBadge';
import { CaptureCard } from '@/components/CaptureCard';
import { ThemedText } from '@/components/ThemedText';
import { palette, card, spacing, radii } from '@/lib/theme';
import type { Spot, Captura } from '@/types';

const FONDO_LABEL: Record<string, string> = {
  roca: 'Roca',
  'roca-arena': 'Roca + arena',
  arena: 'Arena',
  posidonia: 'Posidonia',
  mixto: 'Mixto',
  'casco-hundimiento': 'Pecio / casco',
};

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [spot, setSpot] = useState<Spot | null>(null);
  const [capturas, setCapturas] = useState<Captura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const s = await fetchSpot(id);
      setSpot(s);
      const c = await fetchSpotCapturas(id);
      setCapturas(c);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.buoy} />
      </View>
    );
  }

  if (!spot) {
    return (
      <View style={styles.center}>
        <ThemedText variant="body">No se encontró este spot.</ThemedText>
      </View>
    );
  }

  const acceso = accesoSpot(spot, user?.id);
  const esDueno = !!user && spot.user_id === user.id;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}>
      <Stack.Screen options={{ title: spot.nombre }} />

      {/* Mini-mapa del spot */}
      <MapView
        style={styles.miniMap}
        initialRegion={{
          latitude: spot.lat, longitude: spot.lng, latitudeDelta: 0.02, longitudeDelta: 0.02,
        }}
        customMapStyle={[{ elementType: 'geometry', stylers: [{ color: '#021627' }] }, { featureType: 'water', stylers: [{ color: '#04284A' }] }]}
      >
        <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }} pinColor={palette.spot} />
      </MapView>

      {/* Foto destacada */}
      {spot.fotos && spot.fotos.length > 0 && (
        <Image source={{ uri: spot.fotos[0] }} style={styles.heroImg} />
      )}

      <View style={card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s }}>
          <ThemedText variant="h2" style={{ flex: 1 }}>{spot.nombre}</ThemedText>
          <VisibilityBadge acceso={acceso} />
        </View>
        {spot.description && <ThemedText variant="body">{spot.description}</ThemedText>}
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <ThemedText variant="small" style={{ color: palette.deep }}>
              {FONDO_LABEL[spot.fondo] ?? spot.fondo}
            </ThemedText>
          </View>
          {!!spot.profundidad_max && (
            <View style={styles.tag}>
              <ThemedText variant="small" style={{ color: palette.deep }}>
                Prof. máx {spot.profundidad_max} m
              </ThemedText>
            </View>
          )}
        </View>
      </View>

      {esDueno && (
        <SpotAcceso spotId={spot.id} publico={!!spot.publico} onChange={(p) => setSpot({ ...spot, publico: p })} />
      )}

      <SpotComentarios spotId={spot.id} userId={user?.id} esDueno={esDueno} />

      <ThemedText variant="h3">Capturas en este spot ({capturas.length})</ThemedText>
      {capturas.length > 0 &&
        capturas.map((c) => <CaptureCard key={c.id} capture={c} />)}

      <ThemedText variant="small" style={{ color: palette.foamSoft, textAlign: 'center' }}>
        {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  center: { flex: 1, backgroundColor: palette.abyss, alignItems: 'center', justifyContent: 'center' },
  miniMap: { height: 160, borderRadius: radii.m, borderWidth: 1, borderColor: palette.line },
  heroImg: { height: 180, borderRadius: radii.m },
  tagRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  tag: { backgroundColor: palette.buoy, borderRadius: radii.s, paddingHorizontal: spacing.s, paddingVertical: 2 },
});
