import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, radii } from '@/lib/theme';
import { formatDecimal, formatNautical, getPointInfo, type PointInfo } from '@/lib/pointInfo';
import { beaufort, getConditions, rumbo, type Conditions } from '@/lib/marineWeather';

type Props = { point: { lat: number; lng: number }; onClose: () => void };
type Tab = 'fondo' | 'tiempo' | 'mareas';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const n1 = (v: number | null, u = '') => (v === null || v === undefined ? '—' : `${v.toFixed(1)}${u}`);
const n0 = (v: number | null, u = '') => (v === null || v === undefined ? '—' : `${Math.round(v)}${u}`);

/** Panel del punto pulsado: posición GPS, fondo y profundidad, tiempo y mareas. */
export function PointInfoPanel({ point, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('fondo');
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

      <View style={styles.tabs}>
        {([['fondo', 'Fondo'], ['tiempo', 'Tiempo'], ['mareas', 'Mareas']] as [Tab, string][]).map(([k, l]) => (
          <Pressable key={k} style={[styles.tab, tab === k && styles.tabActive]} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.body} nestedScrollEnabled>
        {tab === 'fondo' && <Fondo info={info} />}
        {tab !== 'fondo' && cond === undefined && <Cargando texto="Consultando tiempo y mareas…" />}
        {tab !== 'fondo' && cond === null && (
          <Text style={styles.sub}>No se pudo obtener el tiempo (Open-Meteo no responde). Inténtalo de nuevo.</Text>
        )}
        {tab === 'tiempo' && cond && <Tiempo c={cond} />}
        {tab === 'mareas' && cond && <Mareas c={cond} />}
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

function Tiempo({ c }: { c: Conditions }) {
  const a = c.actual;
  return (
    <>
      <Text style={styles.label}>Previsión 24 h</Text>
      {c.resumen.map((r) => (
        <Text key={r.texto} style={styles.aviso}>{r.icono}  {r.texto}</Text>
      ))}

      <Text style={styles.label}>Ahora</Text>
      <Text style={styles.value}>{a.cielo}{a.tempAire !== null ? ` · ${n1(a.tempAire, ' °C')}` : ''}</Text>
      <Fila k="Viento" v={a.vientoKn !== null ? `${rumbo(a.vientoDir)} ${n0(a.vientoKn)} kn (F${beaufort(a.vientoKn)}), rachas ${n0(a.rachaKn)} kn` : '—'} />
      <Fila k="Oleaje" v={a.olaM !== null ? `${n1(a.olaM, ' m')} · ${n0(a.olaPeriodoS, ' s')} · de ${rumbo(a.olaDir)}` : '—'} />
      <Fila k="Temp. del mar" v={n1(a.tempMar, ' °C')} />
      <Fila k="Presión" v={n0(a.presionHpa, ' hPa')} />
      <Fila k="Nubosidad" v={n0(a.nubes, ' %')} />
      {c.amanecer && <Fila k="Sol" v={`sale ${c.amanecer} · se pone ${c.atardecer}`} />}

      <Text style={styles.label}>Próximas horas</Text>
      {c.proximas.map((h) => (
        <View key={h.hora} style={styles.hRow}>
          <Text style={[styles.hCell, { width: 78 }]}>{h.hora}</Text>
          <Text style={[styles.hCell, { minWidth: 26 }]}>{h.icono}</Text>
          <Text style={styles.hCell}>{rumbo(h.vientoDir)} {n0(h.vientoKn)}/{n0(h.rachaKn)} kn</Text>
          <Text style={styles.hCell}>{h.olaM !== null ? n1(h.olaM, ' m') : '—'}</Text>
          <Text style={styles.hCell}>{h.lluviaPct !== null ? `${h.lluviaPct}%` : ''}</Text>
        </View>
      ))}
      <Text style={styles.warn}>Viento/rachas en nudos · oleaje en metros · % de probabilidad de lluvia.</Text>

      <Text style={styles.label}>Fuentes</Text>
      <Text style={styles.src}>
        • Cielo, lluvia, tormenta, sol, viento, rachas, temperatura, presión y nubosidad: Open-Meteo Forecast API
        (api.open-meteo.com), que combina modelos meteorológicos de servicios nacionales (DWD, Météo-France, ECMWF…).
      </Text>
      <Text style={styles.src}>
        • Oleaje: Open-Meteo Marine API (marine-api.open-meteo.com), con modelos de oleaje como MFWAM (Météo-France),
        ECMWF WAM y DWD EWAM (5–25 km).
      </Text>
      <Text style={styles.src}>• Temperatura del mar: Météo-France, ~8 km, vía Open-Meteo Marine.</Text>
      <Text style={styles.src}>
        • Avisos de lluvia, tormenta y sol: calculados por la app a partir de la previsión horaria anterior.
      </Text>
      <Text style={styles.src}>Weather data by Open-Meteo.com (CC BY 4.0). Previsión de modelo, no aviso oficial.</Text>
    </>
  );
}

function Mareas({ c }: { c: Conditions }) {
  const m = c.marea;
  return (
    <>
      <Text style={styles.label}>Ahora</Text>
      <Text style={styles.value}>
        {c.actual.nivelMarM !== null ? `${c.actual.nivelMarM > 0 ? '+' : ''}${c.actual.nivelMarM.toFixed(2)} m` : '—'}
        {m.tendencia ? ` · ${m.tendencia}` : ''}
      </Text>
      <Text style={styles.sub}>Nivel respecto al medio del mar</Text>

      <Text style={styles.label}>Próximas pleamares y bajamares</Text>
      {m.eventos.length === 0 && <Text style={styles.sub}>Sin datos de marea para este punto.</Text>}
      {m.eventos.map((e) => (
        <View key={e.hora + e.tipo} style={styles.hRow}>
          <Text style={[styles.hCell, { width: 80, color: e.tipo === 'pleamar' ? palette.buoy : palette.foamSoft }]}>
            {cap(e.tipo)}
          </Text>
          <Text style={styles.hCell}>{e.hora}</Text>
          <Text style={styles.hCell}>{e.alturaM > 0 ? '+' : ''}{e.alturaM.toFixed(2)} m</Text>
        </View>
      ))}
      <Text style={styles.warn}>
        Estimación de un modelo global (~8 km), con unos ±30 min de margen. No sustituye a las tablas oficiales del IHM.
      </Text>

      <Text style={styles.label}>Fuentes</Text>
      <Text style={styles.src}>
        • Nivel del mar y marea: Open-Meteo Marine API (marine-api.open-meteo.com), modelo numérico de mareas y
        corrientes a 0,08° (~8 km), con datos horarios.
      </Text>
      <Text style={styles.src}>
        • Horas y alturas de pleamar y bajamar: calculadas por la app buscando los máximos y mínimos de esa serie
        horaria (hora afinada por interpolación). Alturas respecto al nivel medio del mar.
      </Text>
      <Text style={styles.src}>Weather data by Open-Meteo.com (CC BY 4.0).</Text>
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
