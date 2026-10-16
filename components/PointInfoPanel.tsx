import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, radii } from '@/lib/theme';
import { formatDecimal, formatNautical, getPointInfo, type PointInfo } from '@/lib/pointInfo';
import { getConditions, type Conditions } from '@/lib/marineWeather';
import { TiempoView } from '@/components/TiempoView';
import { MareasView } from '@/components/MareasView';
import { Segmented } from '@/components/ui';

type Props = { point: { lat: number; lng: number }; onClose: () => void; onGuardar?: () => void };
type Tab = 'fondo' | 'tiempo' | 'mareas';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const n1 = (v: number | null, u = '') => (v === null || v === undefined ? '—' : `${v.toFixed(1)}${u}`);
const n0 = (v: number | null, u = '') => (v === null || v === undefined ? '—' : `${Math.round(v)}${u}`);

/** Panel del punto pulsado: posición GPS, fondo y profundidad, tiempo y mareas. */
export function PointInfoPanel({ point, onClose, onGuardar }: Props) {
  const [tab, setTab] = useState<Tab>('fondo');
  // Día elegido (0 = hoy); se comparte entre Tiempo y Mareas.
  const [dia, setDia] = useState(0);
  const [info, setInfo] = useState<PointInfo | null>(null);
  const [cond, setCond] = useState<Conditions | null | undefined>(undefined); // undefined = sin pedir / cargando

  useEffect(() => {
    let vivo = true;
    setInfo(null);
    setCond(undefined);
    getPointInfo(point.lat, point.lng).then((i) => vivo && setInfo(i));
    return () => {
      vivo = false;
    };
  }, [point.lat, point.lng]);

  // Tiempo y mareas se piden al abrir su pestaña.
  useEffect(() => {
    if (tab === 'fondo' || cond !== undefined) return;
    let vivo = true;
    getConditions(point.lat, point.lng).then((c) => vivo && setCond(c));
    return () => {
      vivo = false;
    };
  }, [tab, cond, point.lat, point.lng]);

  return (
    <View style={styles.panel}>
      <Pressable style={styles.x} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar panel" hitSlop={8}>
        <Ionicons name="close" size={22} color={palette.foamSoft} />
      </Pressable>

      <Text style={styles.label}>Posición GPS</Text>
      <Text style={styles.value} selectable>{formatDecimal(point.lat, point.lng)}</Text>
      <Text style={styles.sub} selectable>{formatNautical(point.lat, point.lng)}</Text>

      {onGuardar && (
        <Pressable
          onPress={onGuardar}
          style={styles.guardar}
          accessibilityRole="button"
          accessibilityLabel="Guardar este punto como spot"
        >
          <Ionicons name="bookmark-outline" size={18} color={palette.onAccent} />
          <Text style={styles.guardarTxt}>Guardar como spot</Text>
        </Pressable>
      )}

      <View style={styles.tabs}>
        {([['fondo', 'Fondo'], ['tiempo', 'Tiempo'], ['mareas', 'Mareas']] as [Tab, string][]).map(([k, l]) => (
          <Pressable key={k} style={[styles.tab, tab === k && styles.tabActive]} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {tab !== 'fondo' && cond && cond.dias.length > 1 && (
        <Segmented
          style={{ marginTop: spacing.s }}
          value={String(Math.min(dia, cond.dias.length - 1))}
          onChange={(k) => setDia(Number(k))}
          options={cond.dias.map((d, i) => ({ key: String(i), label: d.etiqueta }))}
        />
      )}

      <ScrollView style={styles.body} nestedScrollEnabled>
        {tab === 'fondo' && <Fondo info={info} />}
        {tab !== 'fondo' && cond === undefined && <Cargando texto="Consultando tiempo y mareas…" />}
        {tab !== 'fondo' && cond === null && (
          <Text style={styles.sub}>No se pudo obtener el tiempo (Open-Meteo no responde). Inténtalo de nuevo.</Text>
        )}
        {tab === 'tiempo' && cond && <TiempoView c={cond} di={Math.min(dia, cond.dias.length - 1)} />}
        {tab === 'mareas' && cond && <MareasView c={cond} di={Math.min(dia, cond.dias.length - 1)} />}
      </ScrollView>
    </View>
  );
}

function Cargando({ texto }: { texto: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={palette.buoy} />
      <Text style={styles.sub}>{texto}</Text>
    </View>
  );
}

function Fondo({ info }: { info: PointInfo | null }) {
  if (!info) return <Cargando texto="Consultando fondo y profundidad…" />;
  const carta = info.fondoCarta;
  const fondoCarta = carta
    ? cap(carta.tipos.join(' / ')) + (carta.calidad.length ? ` (${carta.calidad.join(', ')})` : '')
    : null;
  return (
    <>
      <Text style={styles.label}>Profundidad</Text>
      <Text style={styles.value}>
        {info.profundidadM !== null
          ? `≈ ${info.profundidadM.toFixed(0)} m`
          : info.rangoCartaM
            ? `Entre ${info.rangoCartaM[0]} y ${info.rangoCartaM[1]} m`
            : 'Sin datos (¿tierra?)'}
      </Text>
      {info.rangoCartaM && info.profundidadM !== null && (
        <Text style={styles.sub}>Carta IHM: entre {info.rangoCartaM[0]} y {info.rangoCartaM[1]} m</Text>
      )}
      {info.rangoCartaM && info.profundidadM === null && <Text style={styles.sub}>Rango de la carta IHM</Text>}

      <Text style={styles.label}>Tipo de fondo</Text>
      {fondoCarta ? (
        <>
          <Text style={styles.value}>{fondoCarta}</Text>
          <Text style={styles.sub}>
            {carta!.distanciaM === 0
              ? 'Dato de la carta IHM en este punto'
              : `Referencia de la carta IHM más cercana (a unos ${carta!.distanciaM} m)`}
          </Text>
        </>
      ) : (
        <Text style={styles.value}>Sin referencia en la carta cerca</Text>
      )}
      {info.fondoModelo && <Text style={styles.sub}>Estimación del modelo EMODnet: {info.fondoModelo.toLowerCase()}</Text>}
      <Text style={styles.warn}>Orientativo: no usar para navegar.</Text>
    </>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute', bottom: spacing.l + 4, left: spacing.m, right: spacing.m + 60, maxWidth: 440,
    maxHeight: '70%', backgroundColor: palette.surface, borderRadius: radii.m, borderWidth: 1,
    borderColor: palette.line, padding: spacing.m,
  },
  x: { position: 'absolute', top: 4, right: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  xText: { color: palette.foamSoft, fontSize: 16 },
  guardar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s,
    minHeight: 44, marginTop: spacing.s, borderRadius: radii.m, backgroundColor: palette.buoy,
  },
  guardarTxt: { color: palette.onAccent, fontSize: 16, fontWeight: '700' },
  body: { marginTop: 2 },
  label: { color: palette.buoy, fontSize: 11, fontWeight: '700', marginTop: spacing.s, textTransform: 'uppercase' },
  value: { color: palette.foam, fontSize: 16, fontWeight: '600' },
  sub: { color: palette.foamSoft, fontSize: 12, marginTop: 1 },
  aviso: { color: palette.foam, fontSize: 13, marginTop: 2 },
  src: { color: palette.foamSoft, fontSize: 10, marginTop: 2, lineHeight: 14 },
  warn: { color: palette.foamSoft, fontSize: 10, marginTop: spacing.s, fontStyle: 'italic' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.m },
  tabs: { flexDirection: 'row', gap: 6, marginTop: spacing.s },
  tab: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.m, borderRadius: radii.pill, borderWidth: 1, borderColor: palette.line },
  tabActive: { backgroundColor: palette.buoy, borderColor: palette.buoy },
  tabText: { color: palette.foamSoft, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: palette.onAccent, fontWeight: '700' },
  fila: { flexDirection: 'row', paddingVertical: 2, gap: spacing.s },
  k: { color: palette.foamSoft, width: 96, fontSize: 13 },
  v: { color: palette.foam, flex: 1, fontSize: 13 },
  hRow: { flexDirection: 'row', paddingVertical: 2, gap: spacing.s },
  hCell: { color: palette.foam, fontSize: 12, minWidth: 60 },
});
