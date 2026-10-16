import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { Conditions, Dia, TideEvent } from '@/lib/marineWeather';
import { palette, radii, spacing } from '@/lib/theme';

const num = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(d).replace('.', ',');
const signo = (v: number) => `${v > 0 ? '+' : ''}${num(v)} m`;
const aMin = (hhmm: string | null) => (hhmm ? parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3, 5), 10) : null);

/** "en 2 h 10 min" */
function enCuanto(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `en ${m} min`;
  const h = Math.floor(m / 60);
  return `en ${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

export function MareasView({ c, di }: { c: Conditions; di: number }) {
  const d = c.dias[di];
  const [fuentes, setFuentes] = useState(false);
  if (!d) return null;

  const niveles = d.niveles.filter((x): x is number => x !== null);
  const sinDatos = d.mareas.length === 0 && niveles.length === 0;
  const alturas = d.mareas.map((e) => e.alturaM);
  const amplitud = alturas.length >= 2 ? Math.max(...alturas) - Math.min(...alturas) : null;
  const pe = c.proximoExtremo;
  const subiendo = c.tendencia === 'subiendo';

  return (
    <View style={{ gap: spacing.m }}>
      {/* Cabecera: hoy, el estado de ahora; otros días, la amplitud */}
      {d.esHoy ? (
        <View style={s.cabecera}>
          <View style={[s.flecha, { backgroundColor: palette.abyss }]}>
            <Ionicons
              name={c.tendencia ? (subiendo ? 'arrow-up' : 'arrow-down') : 'remove'}
              size={26}
              color={subiendo ? palette.buoy : palette.foamSoft}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.grande}>
              {c.actual.nivelMarM !== null ? signo(c.actual.nivelMarM) : '—'}
              {c.tendencia && <Text style={s.tend}>  {subiendo ? 'Subiendo' : 'Bajando'}</Text>}
            </Text>
            {pe ? (
              <Text style={s.sub}>
                {pe.tipo === 'pleamar' ? 'Pleamar' : 'Bajamar'} {pe.fecha === d.fecha ? 'a las' : `${pe.fecha.slice(8, 10)}/${pe.fecha.slice(5, 7)}`} {pe.hora}
                {' · '}{enCuanto(pe.ts - c.ahoraTs)} · {signo(pe.alturaM)}
              </Text>
            ) : (
              <Text style={s.sub}>Nivel respecto al medio del mar</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={s.cabecera}>
          <View style={[s.flecha, { backgroundColor: palette.abyss }]}>
            <Ionicons name="swap-vertical" size={26} color={palette.foamSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.grande}>{amplitud !== null ? `${num(amplitud)} m` : '—'}</Text>
            <Text style={s.sub}>Diferencia entre pleamar y bajamar</Text>
          </View>
        </View>
      )}

      {sinDatos ? (
        <Text style={s.sub}>Sin datos de marea para este punto.</Text>
      ) : (
        <>
          <Curva c={c} d={d} />

          <View style={s.eventos}>
            {d.mareas.map((e) => (
              <Evento key={e.ts} e={e} pasado={d.esHoy && e.ts < c.ahoraTs} />
            ))}
          </View>
        </>
      )}

      <Text style={s.nota}>
        Estimación de un modelo global (~8 km), con unos ±30 min de margen. No sustituye a las tablas oficiales del IHM.
      </Text>

      <Pressable onPress={() => setFuentes((f) => !f)} style={s.toggle} accessibilityRole="button" accessibilityState={{ expanded: fuentes }}>
        <Text style={s.toggleTxt}>Fuentes y datos</Text>
        <Ionicons name={fuentes ? 'chevron-up' : 'chevron-down'} size={18} color={palette.foamSoft} />
      </Pressable>
      {fuentes && (
        <View style={{ gap: 4 }}>
          <Text style={s.src}>
            • Nivel del mar y marea: Open-Meteo Marine API (marine-api.open-meteo.com), modelo numérico de mareas y
            corrientes a 0,08° (~8 km), con datos horarios.
          </Text>
          <Text style={s.src}>
            • Horas y alturas de pleamar y bajamar: calculadas por la app buscando los máximos y mínimos de esa serie
            horaria (hora afinada por interpolación). Alturas respecto al nivel medio del mar.
          </Text>
          <Text style={s.src}>Weather data by Open-Meteo.com (CC BY 4.0). Estimación de modelo, no tablas oficiales.</Text>
        </View>
      )}
    </View>
  );
}

function Evento({ e, pasado }: { e: TideEvent; pasado: boolean }) {
  const pleamar = e.tipo === 'pleamar';
  return (
    <View style={[s.evento, pasado && { opacity: 0.5 }]}>
      <Ionicons
        name={pleamar ? 'arrow-up-circle' : 'arrow-down-circle'}
        size={26}
        color={pleamar ? palette.buoy : palette.foamSoft}
      />
      <Text style={s.evTipo}>{pleamar ? 'Pleamar' : 'Bajamar'}</Text>
      <Text style={s.evHora}>{e.hora}</Text>
      <Text style={s.evAltura}>{signo(e.alturaM)}</Text>
    </View>
  );
}

/** Curva del nivel del mar durante el día, con la noche sombreada y la hora actual. */
function Curva({ c, d }: { c: Conditions; d: Dia }) {
  const [ancho, setAncho] = useState(0);
  const H = 160, T = 26, B = 22, L = 6, R = 6;
  const onLayout = (e: LayoutChangeEvent) => setAncho(Math.round(e.nativeEvent.layout.width));

  const pts = d.niveles
    .map((v, h) => (v === null ? null : { min: h * 60, v }))
    .filter((p): p is { min: number; v: number } => p !== null);

  const valores = [...pts.map((p) => p.v), ...d.mareas.map((e) => e.alturaM)];
  const lo = (valores.length ? Math.min(...valores) : -1) - 0.15;
  const hi = (valores.length ? Math.max(...valores) : 1) + 0.15;
  const X = (min: number) => L + (min / 1440) * (ancho - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

  // Curva suave (Catmull-Rom -> Bézier) por los puntos horarios.
  let linea = '';
  if (ancho > 0 && pts.length >= 2) {
    const P = pts.map((p) => ({ x: X(p.min), y: Y(p.v) }));
    linea = `M${P[0].x},${P[0].y}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] ?? P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] ?? p2;
      linea += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
    }
  }
  const area = linea ? `${linea} L${X(pts[pts.length - 1].min)},${H - B} L${X(pts[0].min)},${H - B} Z` : '';

  const amanecer = aMin(d.amanecer), atardecer = aMin(d.atardecer);
  const ahora = d.esHoy ? new Date(c.ahoraTs) : null;
  const ahoraMin = ahora ? ahora.getHours() * 60 + ahora.getMinutes() : null;
  const clampX = (x: number) => Math.min(ancho - 22, Math.max(22, x));

  return (
    <View onLayout={onLayout} style={s.grafico}>
      {ancho > 0 && linea !== '' && (
        <Svg width={ancho} height={H}>
          <Defs>
            <LinearGradient id="mar" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.buoy} stopOpacity="0.35" />
              <Stop offset="1" stopColor={palette.buoy} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {/* Noche */}
          {amanecer !== null && <Rect x={X(0)} y={T - 10} width={X(amanecer) - X(0)} height={H - B - T + 10} fill="#000" opacity={0.25} />}
          {atardecer !== null && <Rect x={X(atardecer)} y={T - 10} width={X(1440) - X(atardecer)} height={H - B - T + 10} fill="#000" opacity={0.25} />}

          {/* Nivel medio */}
          {lo < 0 && hi > 0 && (
            <Line x1={L} x2={ancho - R} y1={Y(0)} y2={Y(0)} stroke={palette.line} strokeWidth={1} strokeDasharray="4 4" />
          )}

          <Path d={area} fill="url(#mar)" />
          <Path d={linea} stroke={palette.buoy} strokeWidth={2.5} fill="none" strokeLinecap="round" />

          {/* Pleamares y bajamares */}
          {d.mareas.map((e) => {
            const x = X(e.min), y = Y(e.alturaM), alta = e.tipo === 'pleamar';
            return (
              <G key={e.ts}>
                <Circle cx={x} cy={y} r={4.5} fill={palette.abyss} stroke={alta ? palette.buoy : palette.foamSoft} strokeWidth={2} />
                <SvgText x={clampX(x)} y={alta ? y - 9 : y + 17} fontSize="11" fontWeight="600" fill={palette.foam} textAnchor="middle">
                  {e.hora}
                </SvgText>
              </G>
            );
          })}

          {/* Ahora */}
          {ahoraMin !== null && (
            <>
              <Line x1={X(ahoraMin)} x2={X(ahoraMin)} y1={T - 10} y2={H - B} stroke={palette.foam} strokeWidth={1} opacity={0.6} />
              {c.actual.nivelMarM !== null && (
                <Circle cx={X(ahoraMin)} cy={Y(c.actual.nivelMarM)} r={5} fill={palette.foam} stroke={palette.abyss} strokeWidth={2} />
              )}
            </>
          )}

          {/* Eje de horas */}
          {[0, 6, 12, 18, 24].map((h) => (
            <SvgText key={h} x={h === 0 ? L + 8 : h === 24 ? ancho - R - 8 : X(h * 60)} y={H - 6} fontSize="10" fill={palette.foamSoft} textAnchor="middle">
              {h === 24 ? '24' : String(h).padStart(2, '0')}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  flecha: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  grande: { color: palette.foam, fontSize: 32, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tend: { color: palette.foamSoft, fontSize: 15, fontWeight: '400' },
  sub: { color: palette.foamSoft, fontSize: 13, lineHeight: 18 },
  grafico: { backgroundColor: palette.abyss, borderRadius: radii.m, minHeight: 160, overflow: 'hidden' },
  eventos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  evento: {
    flexGrow: 1, flexBasis: '22%', minWidth: 72, alignItems: 'center', gap: 2,
    backgroundColor: palette.abyss, borderRadius: radii.m, paddingVertical: spacing.s + 2, paddingHorizontal: 4,
  },
  evTipo: { color: palette.foamSoft, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  evHora: { color: palette.foam, fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  evAltura: { color: palette.foamSoft, fontSize: 12 },
  nota: { color: palette.foamSoft, fontSize: 11, lineHeight: 15 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  toggleTxt: { color: palette.foamSoft, fontSize: 14, fontWeight: '600' },
  src: { color: palette.foamSoft, fontSize: 11, lineHeight: 15 },
});
