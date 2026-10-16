import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE, WMSTile, UrlTile, Marker } from 'react-native-maps';
import { BasemapSwitcher, ChartLegendButton, type Basemap } from '@/components/MapLayerControls';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/hooks/useAuth';
import { accesoSpot, COLOR_ACCESO, ICONO_ACCESO } from '@/components/VisibilityBadge';
import { Banner, IconButton } from '@/components/ui';
import { useSpots } from '@/hooks/useSpots';
import { SpotCard } from '@/components/SpotCard';
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
        onLongPress={(e: any) => {
          // Atajo: mantener pulsado crea un spot justo ahí.
          const c = e.nativeEvent.coordinate;
          router.push({ pathname: '/spot/new', params: { lat: c.latitude.toFixed(6), lng: c.longitude.toFixed(6) } });
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
        {spots.map((s) => {
          const acceso = accesoSpot(s, user?.id);
          return (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              accessibilityLabel={`Spot ${s.nombre}`}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => onMarkerPress(s)}
            >
              {/* Forma (icono) + color: el acceso no depende solo del color */}
              <View style={[styles.pin, { backgroundColor: COLOR_ACCESO[acceso] }]}>
                <Ionicons name={ICONO_ACCESO[acceso]} size={16} color={palette.onAccent} />
              </View>
            </Marker>
          );
        })}
        {tapped && (
          <Marker coordinate={{ latitude: tapped.lat, longitude: tapped.lng }} pinColor={palette.pinPoint} />
        )}
        {place && (
          <Marker
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            title={place.name.split(',')[0]}
            description={place.name}
            pinColor={palette.pinPlace}
          />
        )}
      </MapView>

      <PlaceSearch onSelect={goToPlace} />

      <View style={styles.fabWrap}>
        <BasemapSwitcher value={basemap} onChange={setBasemap} />
        {(basemap === 'carta' || basemap === 'mixta') && <ChartLegendButton />}
        <IconButton icon="locate" label="Centrar en mi posición" onPress={locate} style={locLoading ? { opacity: 0.6 } : undefined} />
        <IconButton icon="add" label="Añadir spot" onPress={() => router.push('/spot/new')} accent />
      </View>

      {tapped && <PointInfoPanel point={tapped} onClose={() => setTapped(null)} />}

      {/* Panel inferior con el spot seleccionado */}
      {selected && (
        <View style={styles.panel}>
          <SpotCard spot={selected} onPress={() => router.push(`/spot/${selected.id}`)} />
          <Pressable
            onPress={() => setSelected(null)}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Cerrar tarjeta del spot"
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color={palette.foamSoft} />
          </Pressable>
        </View>
      )}

      {(locError || spotsError) && (
        <View style={styles.errBanner}>
          <Banner
            tone="error"
            text={spotsError ? 'No se pudieron cargar los spots. Comprueba tu conexión.' : 'No se pudo obtener tu ubicación. Activa el GPS y los permisos.'}
          />
        </View>
      )}
      {!spotsLoading && !spotsError && spots.length === 0 && !tapped && !selected && (
        <View style={styles.hint} pointerEvents="none">
          <Banner text="Sin spots todavía. Mantén pulsado el mapa para crear el primero." />
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
  panel: {
    position: 'absolute', bottom: spacing.l + 4, left: spacing.m, right: spacing.m + 60,
    backgroundColor: palette.surface, borderRadius: radii.m,
    borderWidth: 1, borderColor: palette.line, padding: spacing.m,
  },
  closeBtn: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pin: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: palette.abyss,
  },
  hint: { position: 'absolute', bottom: spacing.l + 4, left: spacing.m, right: spacing.m + 64 },
  errBanner: { position: 'absolute', top: spacing.m + 60, left: spacing.m, right: spacing.m },
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
