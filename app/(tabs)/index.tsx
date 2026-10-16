import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE, WMSTile, UrlTile, Marker, Circle, Polyline } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIMITES_RIAS } from '@/lib/zonasProhibidas';
import { LimitePanel } from '@/components/LimitePanel';
import { XuntaEmblema } from '@/components/XuntaEmblema';
import { BasemapSwitcher, ChartLegendButton, type Basemap } from '@/components/MapLayerControls';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/hooks/useAuth';
import { accesoSpot } from '@/components/VisibilityBadge';
import { DianaSpot } from '@/components/DianaSpot';
import { Banner, IconButton } from '@/components/ui';
import { useSpots } from '@/hooks/useSpots';
import { SpotCard } from '@/components/SpotCard';
import { palette, spacing, radii } from '@/lib/theme';
import { PointInfoPanel } from '@/components/PointInfoPanel';
import { PlaceSearch, type PlaceResult } from '@/components/PlaceSearch';
import type { Spot } from '@/types';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSalidasVisibles } from '@/hooks/useSalidas';
import { SalidaCard } from '@/components/SalidaCard';
import type { SalidaVisible } from '@/types';

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
  const { salidas, reload: reloadSalidas } = useSalidasVisibles();
  const [salidaSel, setSalidaSel] = useState<SalidaVisible | null>(null);

  // Filtro "Límites": puntos rojos y líneas discontinuas donde empieza la zona de pesca submarina prohibida.
  const [limites, setLimites] = useState(true);
  const [limiteSel, setLimiteSel] = useState<{ ria: string; punto: string; otro?: string } | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('mipescasub.mapa.limites')
      .then((v) => v !== null && setLimites(v === '1'))
      .catch(() => {});
  }, []);
  const alternarLimites = () => {
    const nuevo = !limites;
    setLimites(nuevo);
    if (!nuevo) setLimiteSel(null);
    AsyncStorage.setItem('mipescasub.mapa.limites', nuevo ? '1' : '0').catch(() => {});
  };
  // Llega con lat/lng cuando se pulsa "Ver zona" en una salida.
  const foco = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const [basemap, setBasemap] = useState<Basemap>('carta');
  // Al volver a esta pestaña (p. ej. tras crear un spot o cambiar su visibilidad) se recargan los spots.
  useFocusEffect(
    useCallback(() => {
      reloadSpots();
      reloadSalidas();
    }, [reloadSpots, reloadSalidas]),
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
    setSalidaSel(null);
    setLimiteSel(null);
    setSelected(s);
  }, []);

  useEffect(() => {
    const la = parseFloat(foco.lat ?? '');
    const ln = parseFloat(foco.lng ?? '');
    if (isFinite(la) && isFinite(ln)) {
      mapRef.current?.animateToRegion({ latitude: la, longitude: ln, latitudeDelta: 0.06, longitudeDelta: 0.06 }, 600);
    }
  }, [foco.lat, foco.lng]);

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
          setSalidaSel(null);
          setLimiteSel(null);
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
              pinColor={palette.spot}
              {...({ glyph: '◎' } as any)}
              onPress={() => onMarkerPress(s)}
            >
              <DianaSpot acceso={acceso} />
            </Marker>
          );
        })}
        {/* Límites de la pesca submarina: línea discontinua entre cada par de puntos rojos (prohibido por dentro) */}
        {limites &&
          LIMITES_RIAS.flatMap((r) =>
            r.tramos.map((t, i) => (
              <Polyline
                key={`l-${r.ria}-${i}`}
                coordinates={t.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
                strokeColor={palette.limit}
                strokeWidth={3}
                lineDashPattern={[10, 8]}
              />
            )),
          )}
        {limites &&
          LIMITES_RIAS.flatMap((r) =>
            r.tramos.flatMap((t, i) =>
              t.map((p, j) => (
                <Marker
                  key={`p-${r.ria}-${i}-${j}`}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  pinColor={palette.limit}
                  {...({ glyph: '✕' } as any)}
                  accessibilityLabel={`Límite de pesca submarina, ${r.ria}, ${p.nombre}`}
                  tracksViewChanges={false}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => {
                    setTapped(null);
                    setSelected(null);
                    setSalidaSel(null);
                    setLimiteSel({ ria: r.ria, punto: p.nombre, otro: t.length === 2 ? t[1 - j].nombre : undefined });
                  }}
                >
                  <View style={styles.puntoLimite}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </View>
                </Marker>
              )),
            ),
          )}
        {/* Salidas de pesca: zona APROXIMADA (la función del servidor nunca entrega el punto exacto) */}
        {salidas.map((sa) => (
          <Circle
            key={`z-${sa.id}`}
            center={{ latitude: sa.zona_lat, longitude: sa.zona_lng }}
            radius={1100}
            strokeWidth={1}
            strokeColor={palette.buoy + 'AA'}
            fillColor={palette.buoy + '22'}
          />
        ))}
        {salidas.map((sa) => (
          <Marker
            key={`s-${sa.id}`}
            coordinate={{ latitude: sa.zona_lat, longitude: sa.zona_lng }}
            accessibilityLabel={`Salida de pesca, ${sa.es_mia ? 'tuya' : sa.autor ?? 'otro pescador'}`}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => { setTapped(null); setSelected(null); setLimiteSel(null); setSalidaSel(sa); }}
          >
            <View style={[styles.pin, styles.pinSalida]}>
              <Ionicons name="boat" size={16} color={palette.buoy} />
            </View>
          </Marker>
        ))}
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
        <IconButton
          icon="ban"
          custom={<XuntaEmblema height={26} opacity={limites ? 1 : 0.55} />}
          label={limites ? 'Ocultar límites de pesca submarina (Xunta de Galicia)' : 'Mostrar límites de pesca submarina (Xunta de Galicia)'}
          onPress={alternarLimites}
          active={limites}
        />
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

      {limiteSel && limites && <LimitePanel {...limiteSel} onClose={() => setLimiteSel(null)} />}

      {salidaSel && (
        <View style={styles.panel}>
          <SalidaCard s={salidaSel} />
          <Pressable
            onPress={() => setSalidaSel(null)}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Cerrar tarjeta de la salida"
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
  puntoLimite: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: palette.limit,
    borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  pinSalida: { backgroundColor: palette.abyss, borderColor: palette.buoy },
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
