import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { beaufort, horasTira, horasValoracion, rumbo, type Conditions } from '@/lib/marineWeather';
import { palette, radii, spacing } from '@/lib/theme';

/* ───────── utilidades ───────── */

const num = (v: number | null | undefined, d = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(d).replace('.', ',');

type Nivel = 'buenas' | 'precaucion' | 'malas';
const PESO: Record<Nivel, number> = { buenas: 0, precaucion: 1, malas: 2 };

/**
 * Valoración orientativa para pescar en apnea a partir del viento, las rachas y el oleaje.
 * Hoy: ahora y las próximas 12 h. Otros días: de 7 a 20 h. Son umbrales prudentes, no una garantía.
 */
function valorar(c: Conditions, di: number): { nivel: Nivel; motivos: string[] } {
  const d = c.dias[di];
  let nivel: Nivel = 'buenas';
  const motivos: string[] = [];
  const subir = (n: Nivel, motivo: string) => {
    if (PESO[n] > PESO[nivel]) nivel = n;
    if (!motivos.includes(motivo)) motivos.push(motivo);
  };

  const muestras = horasValoracion(c, di).map((h) => ({ viento: h.vientoKn, racha: h.rachaKn, ola: h.olaM }));
  if (d?.esHoy) muestras.unshift({ viento: c.actual.vientoKn ?? 0, racha: c.actual.rachaKn ?? 0, ola: c.actual.olaM });
  const max = (f: (m: (typeof muestras)[number]) => number | null) => Math.max(0, ...muestras.map((m) => f(m) ?? 0));
  const ola = max((m) => m.ola), racha = max((m) => m.racha), viento = max((m) => m.viento);

  if (ola >= 2) subir('malas', `Oleaje de hasta ${num(ola, 1)} m`);
  else if (ola >= 1) subir('precaucion', `Oleaje de hasta ${num(ola, 1)} m`);
  if (racha >= 30 || viento >= 22) subir('malas', `Rachas de hasta ${num(racha)} kn`);
  else if (racha >= 20 || viento >= 14) subir('precaucion', `Rachas de hasta ${num(racha)} kn`);
  const avisos = d?.resumen ?? [];
  if (avisos.some((r) => r.icono === '⛈️')) subir('malas', 'Tormenta posible');
  else if (avisos.some((r) => r.icono === '🌫️')) subir('precaucion', 'Niebla posible');

  return { nivel, motivos };
}

const NIVEL = {
  buenas: { titulo: 'Buenas condiciones', color: palette.ok, icono: 'checkmark-circle' as const },
  precaucion: { titulo: 'Precaución', color: palette.pinPoint, icono: 'alert-circle' as const },
  malas: { titulo: 'Condiciones malas', color: palette.limit, icono: 'close-circle' as const },
};

const colorViento = (kn: number | null) =>
  kn === null ? palette.foam : kn >= 22 ? palette.limit : kn >= 14 ? palette.pinPoint : palette.foam;
const colorOla = (m: number | null) =>
  m === null ? palette.foam : m >= 2 ? palette.limit : m >= 1 ? palette.pinPoint : palette.foam;

/* ───────── vista ───────── */

/** Ancho de la columna de etiquetas (Viento / Ola / Lluvia) de la tira horaria. */
const ETIQUETAS = 44;

export function TiempoView({ c, di }: { c: Conditions; di: number }) {
  const d = c.dias[di];
  const [fuentes, setFuentes] = useState(false);
  const [anchoTira, setAnchoTira] = useState(0);
  if (!d) return null;

  const a = c.actual;
  const v = valorar(c, di);
  const nv = NIVEL[v.nivel];
  const cuando = d.esHoy ? 'próximas 12 h' : 'de 7 a 20 h';
  // El viento se da "de dónde viene"; la flecha apunta hacia dónde sopla.
  const flecha = (dir: number | null) => ({ transform: [{ rotate: `${((dir ?? 0) + 180) % 360}deg` }] });

  // Valores de las baldosas: hoy, los de ahora; otros días, los máximos de la ventana.
  const ven = horasValoracion(c, di);
  const pico = <K extends 'rachaKn' | 'olaM'>(k: K) =>
    ven.reduce<(typeof ven)[number] | null>((m, h) => ((h[k] ?? -1) > ((m?.[k] ?? -1) as number) ? h : m), null);
  const hViento = pico('rachaKn'), hOla = pico('olaM');
  const mares = ven.map((h) => h.tempMar).filter((x): x is number => x !== null);
  const aguaMedia = mares.length ? mares.reduce((s, x) => s + x, 0) / mares.length : null;
  const lluviaMax = Math.max(0, ...ven.map((h) => h.lluviaPct ?? 0));
  const lluviaMm = ven.reduce((s, h) => s + (h.lluviaMm ?? 0), 0);

  const tira = horasTira(c, di);
  // Las columnas se reparten el ancho disponible (sin la columna de etiquetas) para que quepan todas sin deslizar.
  const disponible = anchoTira - ETIQUETAS - 12;
  const colW = anchoTira > 0 ? Math.max(34, Math.floor(disponible / Math.max(1, tira.length))) : 40;

  return (
    <View style={{ gap: spacing.m }}>
      {/* Veredicto */}
      <View style={[s.veredicto, { borderColor: nv.color }]}>
        <Ionicons name={nv.icono} size={30} color={nv.color} />
        <View style={{ flex: 1 }}>
          <Text style={[s.vTitulo, { color: nv.color }]}>{nv.titulo}</Text>
          <Text style={s.vTexto}>
            {v.motivos.length ? `${v.motivos.join(' · ')} (${cuando})` : `Viento y oleaje suaves (${cuando})`}
          </Text>
        </View>
      </View>

      {/* Ahora (hoy) o resumen del día */}
      <View style={s.ahora}>
        <Text style={s.iconoGrande}>{d.esHoy ? a.icono : d.icono}</Text>
        <View style={{ flex: 1 }}>
          {d.esHoy ? (
            <Text style={s.temp}>{a.tempAire !== null ? `${num(a.tempAire)}°` : '—'}</Text>
          ) : (
            <Text style={s.temp}>
              {num(d.tMax)}°<Text style={s.tempMin}> / {num(d.tMin)}°</Text>
            </Text>
          )}
          <Text style={s.cielo}>{d.esHoy ? a.cielo : d.cielo}</Text>
        </View>
        {d.amanecer && (
          <View style={s.sol}>
            <Ionicons name="sunny-outline" size={16} color={palette.foamSoft} />
            <Text style={s.solTxt}>{d.amanecer} – {d.atardecer}</Text>
          </View>
        )}
      </View>

      <View style={s.rejilla}>
        {d.esHoy ? (
          <>
            <Tile titulo="Viento" valor={num(a.vientoKn)} unidad="kn" color={colorViento(a.rachaKn ?? a.vientoKn)}
              pie={a.vientoKn !== null ? `${rumbo(a.vientoDir)} · fuerza ${beaufort(a.vientoKn)} · rachas ${num(a.rachaKn)}` : undefined}
              flecha={a.vientoDir !== null ? flecha(a.vientoDir) : undefined} />
            <Tile titulo="Oleaje" valor={num(a.olaM, 1)} unidad="m" color={colorOla(a.olaM)}
              pie={a.olaM !== null ? `${num(a.olaPeriodoS)} s · de ${rumbo(a.olaDir)}` : undefined}
              flecha={a.olaDir !== null ? flecha(a.olaDir) : undefined} />
            <Tile titulo="Agua" valor={num(a.tempMar, 1)} unidad="°C" pie="temperatura del mar" />
            <Tile titulo="Presión" valor={num(a.presionHpa)} unidad="hPa" pie={`nubes ${num(a.nubes)} %`} />
          </>
        ) : (
          <>
            <Tile titulo="Viento máx." valor={num(hViento?.vientoKn ?? null)} unidad="kn" color={colorViento(hViento?.rachaKn ?? null)}
              pie={hViento ? `${rumbo(hViento.vientoDir)} · rachas ${num(hViento.rachaKn)} · a las ${hViento.hora}` : undefined}
              flecha={hViento ? flecha(hViento.vientoDir) : undefined} />
            <Tile titulo="Oleaje máx." valor={num(hOla?.olaM ?? null, 1)} unidad="m" color={colorOla(hOla?.olaM ?? null)}
              pie={hOla && hOla.olaM !== null ? `${num(hOla.olaPeriodoS)} s · de ${rumbo(hOla.olaDir)} · a las ${hOla.hora}` : undefined}
              flecha={hOla && hOla.olaDir !== null ? flecha(hOla.olaDir) : undefined} />
            <Tile titulo="Agua" valor={num(aguaMedia, 1)} unidad="°C" pie="temperatura media del mar" />
            <Tile titulo="Lluvia" valor={String(lluviaMax)} unidad="%" pie={lluviaMm > 0 ? `unos ${num(lluviaMm, 1)} mm en el día` : 'sin precipitación prevista'} />
          </>
        )}
      </View>

      {/* Avisos */}
      {d.resumen.length > 0 && (
        <View style={s.avisos}>
          {d.resumen.map((r) => (
            <Text key={r.texto} style={s.aviso}>{r.icono}  {r.texto}</Text>
          ))}
        </View>
      )}

      {/* Horas */}
      {tira.length > 0 && (
        <View>
          <Text style={s.seccion}>{d.esHoy ? 'Próximas horas' : 'Por horas'}</Text>
          <View style={s.tira} onLayout={(e) => setAnchoTira(Math.round(e.nativeEvent.layout.width))}>
            <View style={s.etiquetas}>
              <Text style={[s.etq, { height: 30 }]} />
              <Text style={[s.etq, { height: 34 }]} />
              <Text style={s.etq}>Viento</Text>
              <Text style={s.etq}>Ola</Text>
              <Text style={s.etq}>Lluvia</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
              {tira.map((h, i) => {
                const nuevoDia = i > 0 && h.fecha !== tira[i - 1].fecha;
                return (
                  <View key={h.fecha + h.hora} style={[s.col, { width: colW }]}>
                    <View style={{ height: 30, justifyContent: 'center' }}>
                      {nuevoDia && <Text style={s.dia}>{h.fecha.slice(8, 10)}/{h.fecha.slice(5, 7)}</Text>}
                      <Text style={s.hora}>{d.esHoy && i === 0 && h.h === c.horaActual ? 'Ahora' : h.hora}</Text>
                    </View>
                    <Text style={s.icoCol}>{h.icono}</Text>
                    <Text style={[s.dato, { color: colorViento(h.rachaKn) }]}>{num(h.vientoKn)}</Text>
                    <Text style={[s.dato, { color: colorOla(h.olaM) }]}>{h.olaM !== null ? num(h.olaM, 1) : '—'}</Text>
                    <Text style={[s.dato, { color: (h.lluviaPct ?? 0) >= 50 ? palette.buoy : palette.foamSoft }]}>
                      {h.lluviaPct !== null ? `${h.lluviaPct}%` : '—'}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
          <Text style={s.nota}>Viento en nudos (con el color de las rachas) · oleaje en metros · probabilidad de lluvia.</Text>
        </View>
      )}

      <Text style={s.nota}>Valoración orientativa a partir de un modelo de previsión. Decide siempre con lo que veas en el mar.</Text>

      {/* Fuentes plegadas */}
      <Pressable onPress={() => setFuentes((f) => !f)} style={s.toggle} accessibilityRole="button" accessibilityState={{ expanded: fuentes }}>
        <Text style={s.toggleTxt}>Fuentes y datos</Text>
        <Ionicons name={fuentes ? 'chevron-up' : 'chevron-down'} size={18} color={palette.foamSoft} />
      </Pressable>
      {fuentes && (
        <View style={{ gap: 4 }}>
          <Text style={s.src}>
            • Cielo, lluvia, tormenta, sol, viento, rachas, temperatura, presión y nubosidad: Open-Meteo Forecast API
            (api.open-meteo.com), que combina modelos de servicios meteorológicos nacionales (DWD, Météo-France, ECMWF…).
          </Text>
          <Text style={s.src}>
            • Oleaje: Open-Meteo Marine API (marine-api.open-meteo.com), con modelos como MFWAM, ECMWF WAM y DWD EWAM (5–25 km).
          </Text>
          <Text style={s.src}>• Temperatura del mar: Météo-France, ~8 km, vía Open-Meteo Marine.</Text>
          <Text style={s.src}>
            • Valoración y avisos de lluvia, tormenta y sol: calculados por la app a partir de la previsión horaria.
          </Text>
          <Text style={s.src}>Weather data by Open-Meteo.com (CC BY 4.0). Previsión de modelo, no aviso oficial.</Text>
        </View>
      )}
    </View>
  );
}

function Tile({
  titulo, valor, unidad, pie, color = palette.foam, flecha,
}: {
  titulo: string; valor: string; unidad: string; pie?: string; color?: string; flecha?: object;
}) {
  return (
    <View style={s.tile}>
      <View style={s.tileCab}>
        <Text style={s.tileTitulo}>{titulo}</Text>
        {flecha && <Ionicons name="arrow-up" size={16} color={palette.foamSoft} style={flecha} />}
      </View>
      <Text style={[s.tileValor, { color }]}>
        {valor}
        <Text style={s.tileUnidad}> {unidad}</Text>
      </Text>
      {!!pie && <Text style={s.tilePie} numberOfLines={2}>{pie}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  veredicto: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.s, padding: spacing.s + 2,
    borderWidth: 1, borderRadius: radii.m, backgroundColor: palette.abyss,
  },
  vTitulo: { fontSize: 17, fontWeight: '700' },
  vTexto: { color: palette.foam, fontSize: 13, lineHeight: 18, marginTop: 1 },
  ahora: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  iconoGrande: { fontSize: 46 },
  temp: { color: palette.foam, fontSize: 38, fontWeight: '300', lineHeight: 44 },
  tempMin: { color: palette.foamSoft, fontSize: 24 },
  cielo: { color: palette.foamSoft, fontSize: 15 },
  sol: { alignItems: 'center', gap: 2 },
  solTxt: { color: palette.foamSoft, fontSize: 12 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  tile: {
    flexGrow: 1, flexBasis: '45%', backgroundColor: palette.abyss, borderRadius: radii.m,
    padding: spacing.s + 4, gap: 2, minHeight: 92,
  },
  tileCab: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileTitulo: { color: palette.foamSoft, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  tileValor: { fontSize: 30, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tileUnidad: { fontSize: 14, fontWeight: '400', color: palette.foamSoft },
  tilePie: { color: palette.foamSoft, fontSize: 12, lineHeight: 16 },
  avisos: { gap: 4 },
  aviso: { color: palette.foam, fontSize: 14, lineHeight: 20 },
  seccion: { color: palette.foamSoft, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  tira: { flexDirection: 'row', backgroundColor: palette.abyss, borderRadius: radii.m, paddingVertical: spacing.s, paddingLeft: spacing.s },
  etiquetas: { width: ETIQUETAS },
  etq: { color: palette.foamSoft, fontSize: 11, height: 24, lineHeight: 24 },
  col: { alignItems: 'center' },
  dia: { color: palette.foamSoft, fontSize: 10, textAlign: 'center' },
  hora: { color: palette.foam, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  icoCol: { fontSize: 22, height: 34, lineHeight: 34 },
  dato: { height: 24, lineHeight: 24, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  nota: { color: palette.foamSoft, fontSize: 11, lineHeight: 15, marginTop: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  toggleTxt: { color: palette.foamSoft, fontSize: 14, fontWeight: '600' },
  src: { color: palette.foamSoft, fontSize: 11, lineHeight: 15 },
});
