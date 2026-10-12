import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Pressable, Text, ActivityIndicator } from 'react-native';
import MapView, { PROVIDER_GOOGLE, WMSTile, UrlTile, Marker } from 'react-native-maps';
import { BasemapSwitcher, ChartLegendButton, type Basemap } from '@/components/MapLayerControls';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/hooks/useAuth';
import { accesoSpot, COLOR_ACCESO } from '@/components/VisibilityBadge';
import { useSpots } from '@/hooks/useSpots';
import { SpotCard } from '@/components/SpotCard';
import { ThemedText } from '@/components/ThemedText';
import { palette, spacing, radii } from '@/lib/theme';
import { PointInfoPanel } from '@/components/PointInfoPanel';
import { PlaceSearch, type PlaceResult } from '@/components/PlaceSearch';
import type { Spot } from '@/types';
import { useRouter, useFocusEffect } from 'expo-router';

/**
 * Mapa de spots de pesca submarina.
 *
 * La capa de batimetría (MBAR) se sirve como tiles raster vía UrlTile: la función
 * edge `pascasub-edge` expone `/tiles/mbar/{z}/{x}/{y}`. El patrón de URL se
 * compone dinámicamente en tilesOficial() a partir de BATHYMETRY_TILE_HOST — si
 * lo dejamos vacío (sin desplegar) el UrlTile no se añade y el mapa funciona
 * con el mapa base.
 */
export default function MapaScreen() {
  const router = useRouter();
  const { coords, error: locError, loading: locLoading, locate } = useLocation(false);
  const { spots, loading: spotsLoading, error: spotsError, reload: reloadSpots } = useSpots();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Spot | null>(null);

  const [basemap, setBasemap] = useState<Basemap>('carta');
  // Al volver a esta pestaña (p. ej. tras crear un spot o cambiar su visibilidad) se recargan los spots.
  useFocusEffect(
    useCallback(() => {
      reloadSpots();
    }, [reloadSpots]),
  );

  const mapRef = useRef<any>(null);
  const [tapped, setTapped] = useState<{ lat: number; lng: number } | null>(null);
  const [place, setPlace] = useState<PlaceResult | null>(null);

  // Carta náutica electrónica (ENC) oficial del IHM, la misma del visor IDEIHM.
  const ENC_WMS =
    'https://ideihm.covam.es/ihmcache/wms?service=WMS&version=1.1.1&request=GetMap&layers=RasterENC' +
    '&styles=&format=image/png&transparent=true&srs=EPSG:3857&width={width}&height={height}' +
    '&bbox={minX},{minY},{maxX},{maxY}';

  const goToPlace = useCallback((p: PlaceResult) => {
    setPlace(p);
    mapRef.current?.animateToRegion(
      { latitude: p.lat, longitude: p.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 },
      600,
    );
  }, []);

  const initialRegion = useMemo(() => {
    if (coords) return { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.1, longitudeDelta: 0.1 };
    // Fallback: Ría de Pontevedra, donde hay cobertura de batimetría (z 8..16).
    return { latitude: 42.38, longitude: -8.80, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  }, [coords]);

  const onMarkerPress = useCallback((s: Spot) => {
    setTapped(null);
    setSelected(s);
  }, []);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        onPress={(e: any) => {
          const c = e.nativeEvent.coordinate;
          setSelected(null);
          setTapped({ lat: c.latitude, lng: c.longitude });
        }}
        mapType={basemap === 'satelite' || basemap === 'mixta' ? 'satellite' : basemap === 'osm' ? 'none' : 'standard'}
        {...({ basemap } as any)}
        customMapStyle={basemap === 'carta' ? DARK_MAP_STYLE : undefined}
      >
        {basemap === 'osm' && (
          <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} zIndex={0} />
        )}
        {(basemap === 'carta' || basemap === 'mixta') && (
          <WMSTile urlTemplate={ENC_WMS} tileSize={256} opacity={basemap === 'mixta' ? 0.6 : 1} zIndex={1} />
        )}
        {spots.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            title={s.nombre}
            description={s.description ?? undefined}
            pinColor={COLOR_ACCESO[accesoSpot(s, user?.id)]}
            onPress={() => onMarkerPress(s)}
          />
        ))}
        {tapped && (
          <Marker coordinate={{ latitude: tapped.lat, longitude: tapped.lng }} pinColor="#f2994a" />
        )}
        {place && (
          <Marker
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            title={place.name.split(',')[0]}
            description={place.name}
            pinColor="#2f80ed"
          />
        )}
      </MapView>

      <PlaceSearch onSelect={goToPlace} />

      {/* Botón "ir a mi posición" */}
      <View style={styles.fabWrap}>
        <BasemapSwitcher value={basemap} onChange={setBasemap} />
        {(basemap === 'carta' || basemap === 'mixta') && <ChartLegendButton />}
        <Pressable
          style={[styles.fab, locLoading && { opacity: 0.6 }]}
          onPress={locate}
          accessibilityLabel="Centrar en mi posición"
        >
          <Text style={styles.fabText}>◎</Text>
        </Pressable>
        <Pressable
          style={[styles.fab, styles.fabNew]}
          onPress={() => router.push('/spot/new')}
          accessibilityLabel="Añadir spot"
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>

      {tapped && <PointInfoPanel point={tapped} onClose={() => setTapped(null)} />}

      {/* Panel inferior con el spot seleccionado */}
      {selected && (
        <View style={styles.panel}>
          <SpotCard spot={selected} onPress={() => router.push(`/spot/${selected.id}`)} />
          <Pressable onPress={() => setSelected(null)}>
            <ThemedText variant="small" style={styles.close}>✕ cerrar</ThemedText>
          </Pressable>
        </View>
      )}

      {(locError || spotsError) && (
        <View style={styles.errBanner}>
          <ThemedText variant="small" style={{ color: palette.coral }}>
            {locError ?? spotsError}
          </ThemedText>
        </View>
      )}
      {spotsLoading && (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.buoy} />
        </View>
      )}
    </View>
  );
}

/* Estilos */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  fabWrap: { position: 'absolute', bottom: spacing.l + 4, right: spacing.m, gap: spacing.s, alignItems: 'flex-end' },
  fab: {
    width: 48, height: 48, borderRadius: radii.pill,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line,
    alignItems: 'center', justifyContent: 'center',
  },
  fabNew: { backgroundColor: palette.coral, borderColor: palette.coral },
  fabText: { color: palette.foam, fontSize: 24, fontWeight: '700' },
  panel: {
    position: 'absolute', bottom: spacing.l + 4, left: spacing.m, right: spacing.m + 60,
    backgroundColor: palette.surface, borderRadius: radii.m,
    borderWidth: 1, borderColor: palette.line, padding: spacing.m,
  },
  close: { alignSelf: 'flex-end', marginTop: spacing.xs, color: palette.foamSoft },
  errBanner: {
    position: 'absolute', top: spacing.m + 56, left: spacing.m, right: spacing.m,
    backgroundColor: palette.abyss, borderWidth: 1, borderColor: palette.coral,
    borderRadius: radii.s, padding: spacing.s,
  },
  loading: { position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center' },
});

/* référentes de estilo de mapa en modo oscuro (MapStyle JSON para GMaps nativos). */
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#021627' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9DC3DB' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#04223C' }] },
  { featureType: 'water', stylers: [{ color: '#04284A' }] },
  { featureType: 'road', stylers: [{ color: '#0A3355' }] },
  { featureType: 'road.arterial', stylers: [{ color: '#0E4764' }] },
  { featureType: 'poi.park', stylers: [{ color: '#0E2F2A' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
