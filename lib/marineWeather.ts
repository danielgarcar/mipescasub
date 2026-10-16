/**
 * Tiempo y mareas de un punto con Open-Meteo (gratuita, sin clave; uso no comercial):
 *  - api.open-meteo.com          -> viento, temperatura, nubosidad, presión, lluvia
 *  - marine-api.open-meteo.com   -> oleaje, temperatura del mar y nivel del mar (incluye marea)
 *
 * El nivel del mar viene de un modelo global de baja resolución (~8 km): sirve para saber si
 * la marea sube o baja y las horas aproximadas de pleamar/bajamar, no como tablas oficiales
 * (para eso, las del IHM).
 *
 * La previsión se organiza por días (hoy y los 3 siguientes), cada uno con sus 24 horas.
 */

export type TideEvent = {
  tipo: 'pleamar' | 'bajamar';
  /** día local, YYYY-MM-DD */
  fecha: string;
  /** HH:MM */
  hora: string;
  /** minutos desde las 00:00 */
  min: number;
  /** marca de tiempo (misma referencia que `ahoraTs`) */
  ts: number;
  alturaM: number;
};

/** Datos de una hora concreta. */
export type HoraDato = {
  fecha: string;
  /** 0-23 */
  h: number;
  hora: string;
  icono: string;
  cielo: string;
  tempAire: number | null;
  vientoKn: number;
  rachaKn: number;
  vientoDir: number;
  olaM: number | null;
  olaPeriodoS: number | null;
  olaDir: number | null;
  tempMar: number | null;
  lluviaPct: number | null;
  lluviaMm: number | null;
  nivelM: number | null;
  esDia: boolean;
};

export type Dia = {
  fecha: string;
  /** "Hoy", "Mañana", "vie 18" */
  etiqueta: string;
  esHoy: boolean;
  horas: HoraDato[];
  /** Avisos del día: lluvia, tormenta, sol… */
  resumen: { icono: string; texto: string }[];
  amanecer: string | null;
  atardecer: string | null;
  tMin: number | null;
  tMax: number | null;
  icono: string;
  cielo: string;
  mareas: TideEvent[];
  /** Nivel del mar de las 24 horas del día (m, respecto al medio); null si falta el dato. */
  niveles: (number | null)[];
};

export type Conditions = {
  zonaHoraria: string;
  /** hora local actual del punto, en la misma referencia que `TideEvent.ts` */
  ahoraTs: number;
  /** hora local actual (0-23) */
  horaActual: number;
  actual: {
    cielo: string;
    icono: string;
    tempAire: number | null;
    vientoKn: number | null;
    rachaKn: number | null;
    vientoDir: number | null;
    presionHpa: number | null;
    nubes: number | null;
    olaM: number | null;
    olaPeriodoS: number | null;
    olaDir: number | null;
    tempMar: number | null;
    nivelMarM: number | null;
  };
  tendencia: 'subiendo' | 'bajando' | null;
  /** Próxima pleamar o bajamar a partir de ahora (puede estar en un día posterior). */
  proximoExtremo: TideEvent | null;
  dias: Dia[];
};

const WMO_ES: Record<number, string> = {
  0: 'Despejado', 1: 'Poco nuboso', 2: 'Parcialmente nuboso', 3: 'Nublado', 45: 'Niebla', 48: 'Niebla con escarcha',
  51: 'Llovizna débil', 53: 'Llovizna', 55: 'Llovizna intensa', 56: 'Llovizna helada', 57: 'Llovizna helada intensa',
  61: 'Lluvia débil', 63: 'Lluvia', 65: 'Lluvia fuerte', 66: 'Lluvia helada', 67: 'Lluvia helada fuerte',
  71: 'Nieve débil', 73: 'Nieve', 75: 'Nieve fuerte', 77: 'Granizo fino', 80: 'Chubascos débiles', 81: 'Chubascos',
  82: 'Chubascos fuertes', 85: 'Chubascos de nieve', 86: 'Chubascos de nieve fuertes', 95: 'Tormenta',
  96: 'Tormenta con granizo', 99: 'Tormenta con granizo fuerte',
};

const lluvia = (c: number) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82);
const nieve = (c: number) => (c >= 71 && c <= 77) || c === 85 || c === 86;
const tormenta = (c: number) => c >= 95;

export function iconoCielo(code: number, dia: boolean): string {
  if (tormenta(code)) return '⛈️';
  if (nieve(code)) return '🌨️';
  if (lluvia(code)) return code >= 63 || code >= 81 ? '🌧️' : '🌦️';
  if (code === 45 || code === 48) return '🌫️';
  if (code === 0) return dia ? '☀️' : '🌙';
  if (code === 1) return dia ? '🌤️' : '🌙';
  if (code === 2) return dia ? '⛅' : '☁️';
  return '☁️';
}

const RUMBOS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export function rumbo(grados: number | null): string {
  if (grados === null || Number.isNaN(grados)) return '—';
  return RUMBOS[Math.round(grados / 45) % 8];
}

/** Escala Beaufort a partir de nudos. */
export function beaufort(kn: number): number {
  const lim = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
  const i = lim.findIndex((l) => kn < l);
  return i === -1 ? 12 : i;
}

async function getJson(url: string): Promise<any | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 2026-10-12T20:00 -> 12/10 */
function fecha(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Todas las pleamares y bajamares de la serie; la hora se afina con una parábola por los tres puntos. */
function extremos(times: string[], levels: (number | null)[]): TideEvent[] {
  const out: TideEvent[] = [];
  for (let i = 1; i < levels.length - 1; i++) {
    const a = levels[i - 1], b = levels[i], c = levels[i + 1];
    if (a === null || b === null || c === null) continue;
    const pleamar = b > a && b >= c;
    const bajamar = b < a && b <= c;
    if (!pleamar && !bajamar) continue;
    const den = a - 2 * b + c;
    const delta = den !== 0 ? (0.5 * (a - c)) / den : 0; // desplazamiento en horas respecto a i
    const ts = new Date(times[i] + ':00').getTime() + delta * 3600_000;
    const d = new Date(ts);
    const alt = den !== 0 ? b - (0.25 * (a - c) * (a - c)) / den : b; // valor en el vértice de la parábola
    out.push({
      tipo: pleamar ? 'pleamar' : 'bajamar',
      fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      min: d.getHours() * 60 + d.getMinutes(),
      ts,
      alturaM: alt,
    });
  }
  return out;
}

/** Avisos de un tramo [desde, hasta) de la serie horaria. */
function resumir(w: any, desde: number, hasta: number, ahora: number): { icono: string; texto: string }[] {
  const h = w?.hourly;
  if (!h?.time) return [];
  const out: { icono: string; texto: string }[] = [];
  const fin = Math.min(h.time.length, hasta);
  const hora = (i: number) =>
    i === ahora ? 'ahora' : i - desde < 24 && h.time[i].slice(0, 10) === h.time[desde].slice(0, 10)
      ? h.time[i].slice(11, 16)
      : `${fecha(h.time[i])} ${h.time[i].slice(11, 16)}`;
  const idx = (f: (i: number) => boolean) => {
    for (let i = desde; i < fin; i++) if (f(i)) return i;
    return -1;
  };

  const iTor = idx((i) => tormenta(h.weather_code?.[i] ?? 0));
  if (iTor >= 0) out.push({ icono: '⛈️', texto: `Tormenta posible: ${hora(iTor)}` });

  const iLl = idx(
    (i) =>
      lluvia(h.weather_code?.[i] ?? 0) ||
      (h.precipitation?.[i] ?? 0) >= 0.3 ||
      (h.precipitation_probability?.[i] ?? 0) >= 60,
  );
  if (iLl >= 0) {
    let max = 0;
    for (let i = desde; i < fin; i++) max = Math.max(max, h.precipitation?.[i] ?? 0);
    out.push({ icono: '🌧️', texto: `Lluvia prevista: ${hora(iLl)}${max > 0 ? ` (hasta ${max.toFixed(1)} mm/h)` : ''}` });
  } else {
    out.push({ icono: '☂️', texto: 'Sin lluvia prevista' });
  }

  const iNieve = idx((i) => nieve(h.weather_code?.[i] ?? 0));
  if (iNieve >= 0) out.push({ icono: '🌨️', texto: `Nieve posible: ${hora(iNieve)}` });
  const iNiebla = idx((i) => [45, 48].includes(h.weather_code?.[i] ?? 0));
  if (iNiebla >= 0) out.push({ icono: '🌫️', texto: `Niebla posible: ${hora(iNiebla)}` });

  // Sol: horas de día con cielo despejado o poco nuboso.
  let sol = 0;
  for (let i = desde; i < fin; i++) if (h.is_day?.[i] === 1 && (h.weather_code?.[i] ?? 3) <= 1) sol++;
  out.push(
    sol >= 3
      ? { icono: '☀️', texto: `Sol: unas ${sol} h de cielo despejado o poco nuboso` }
      : { icono: '☁️', texto: 'Poco sol previsto (cielo cubierto o nuboso)' },
  );

  let rachaMax = 0;
  for (let i = desde; i < fin; i++) rachaMax = Math.max(rachaMax, h.wind_gusts_10m?.[i] ?? 0);
  if (rachaMax >= 25) out.push({ icono: '💨', texto: `Rachas fuertes previstas: hasta ${Math.round(rachaMax)} kn` });
  return out;
}

function etiquetaDia(f: string, i: number): string {
  if (i === 0) return 'Hoy';
  if (i === 1) return 'Mañana';
  const d = new Date(f + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }).replace('.', '');
}

export async function getConditions(lat: number, lng: number): Promise<Conditions | null> {
  const q = `latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&timezone=auto&forecast_days=4`;
  const [w, m] = await Promise.all([
    getJson(
      `https://api.open-meteo.com/v1/forecast?${q}&wind_speed_unit=kn` +
        '&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,pressure_msl,cloud_cover,is_day' +
        '&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation_probability,precipitation,weather_code,is_day' +
        '&daily=sunrise,sunset',
    ),
    getJson(
      `https://marine-api.open-meteo.com/v1/marine?${q}` +
        '&current=wave_height,wave_period,wave_direction,sea_surface_temperature,sea_level_height_msl' +
        '&hourly=wave_height,wave_period,wave_direction,sea_surface_temperature,sea_level_height_msl',
    ),
  ]);
  if (!w && !m) return null;

  const wc = w?.current ?? {};
  const mc = m?.current ?? {};
  const horasW: string[] = w?.hourly?.time ?? [];
  const horasM: string[] = m?.hourly?.time ?? [];
  const hw = w?.hourly ?? {};
  const hm = m?.hourly ?? {};
  const base: string[] = horasW.length ? horasW : horasM;
  if (!base.length) return null;

  const nowIso: string = (mc.time ?? wc.time ?? base[0]) as string;
  const hoyFecha = nowIso.slice(0, 10);
  const horaActual = parseInt(nowIso.slice(11, 13), 10) || 0;
  const ahoraTs = new Date(nowIso.slice(0, 16) + ':00').getTime();
  const idxM = new Map<string, number>(horasM.map((t, i) => [t, i]));

  // Mareas: todos los extremos de la serie, repartidos por día.
  const nivel: (number | null)[] = hm.sea_level_height_msl ?? [];
  const todos = extremos(horasM, nivel);
  const iNow = Math.max(0, horasM.findIndex((t) => t >= nowIso.slice(0, 13) + ':00'));
  const aN = nivel[iNow], bN = nivel[iNow + 1];
  const tendencia = aN != null && bN != null ? (bN > aN ? 'subiendo' : 'bajando') : null;
  const proximoExtremo = todos.find((e) => e.ts > ahoraTs) ?? null;

  // Días presentes en la serie, a partir de hoy.
  const fechas: string[] = [];
  for (const t of base) {
    const f = t.slice(0, 10);
    if (f >= hoyFecha && !fechas.includes(f)) fechas.push(f);
  }

  const dias: Dia[] = fechas.slice(0, 4).map((f, di) => {
    const horas: HoraDato[] = [];
    let primero = -1;
    for (let h = 0; h < 24; h++) {
      const t = `${f}T${pad(h)}:00`;
      const i = horasW.indexOf(t);
      if (i < 0) continue;
      if (primero < 0) primero = i;
      const j = idxM.get(t) ?? -1;
      const code: number = hw.weather_code?.[i] ?? 3;
      const esDia = hw.is_day?.[i] !== 0;
      horas.push({
        fecha: f, h, hora: `${pad(h)}:00`,
        icono: iconoCielo(code, esDia), cielo: WMO_ES[code] ?? '—',
        tempAire: hw.temperature_2m?.[i] ?? null,
        vientoKn: hw.wind_speed_10m?.[i] ?? 0,
        rachaKn: hw.wind_gusts_10m?.[i] ?? 0,
        vientoDir: hw.wind_direction_10m?.[i] ?? 0,
        olaM: j >= 0 ? (hm.wave_height?.[j] ?? null) : null,
        olaPeriodoS: j >= 0 ? (hm.wave_period?.[j] ?? null) : null,
        olaDir: j >= 0 ? (hm.wave_direction?.[j] ?? null) : null,
        tempMar: j >= 0 ? (hm.sea_surface_temperature?.[j] ?? null) : null,
        lluviaPct: hw.precipitation_probability?.[i] ?? null,
        lluviaMm: hw.precipitation?.[i] ?? null,
        nivelM: j >= 0 ? (nivel[j] ?? null) : null,
        esDia,
      });
    }

    // Icono y cielo del día: el del mediodía, salvo que haya tormenta o lluvia sostenida en horas de luz.
    const luz = horas.filter((x) => x.h >= 8 && x.h <= 20);
    const medio = horas.find((x) => x.h === 14) ?? horas[0];
    const codes = luz.map((x) => hw.weather_code?.[horasW.indexOf(`${f}T${pad(x.h)}:00`)] ?? 3);
    let icono = medio ? iconoCielo(hw.weather_code?.[horasW.indexOf(`${f}T14:00`)] ?? 3, true) : '☁️';
    let cielo = medio?.cielo ?? '—';
    if (codes.some(tormenta)) { icono = '⛈️'; cielo = 'Tormenta posible'; }
    else if (codes.filter(lluvia).length >= 3) { icono = '🌧️'; cielo = 'Lluvia'; }

    const temps = horas.map((x) => x.tempAire).filter((x): x is number => x !== null);
    const desde = di === 0 ? Math.max(0, base.indexOf(nowIso.slice(0, 13) + ':00')) : primero;
    const hasta = di === 0 ? desde + 24 : primero + 24;

    return {
      fecha: f,
      etiqueta: etiquetaDia(f, di),
      esHoy: di === 0,
      horas,
      resumen: resumir(w, Math.max(0, desde), hasta, di === 0 ? desde : -1),
      amanecer: w?.daily?.sunrise?.[di]?.slice(11, 16) ?? null,
      atardecer: w?.daily?.sunset?.[di]?.slice(11, 16) ?? null,
      tMin: temps.length ? Math.min(...temps) : null,
      tMax: temps.length ? Math.max(...temps) : null,
      icono,
      cielo,
      mareas: todos.filter((e) => e.fecha === f),
      niveles: Array.from({ length: 24 }, (_, h) => {
        const j = idxM.get(`${f}T${pad(h)}:00`);
        return j === undefined ? null : (nivel[j] ?? null);
      }),
    };
  });

  return {
    zonaHoraria: w?.timezone ?? m?.timezone ?? '',
    ahoraTs,
    horaActual,
    actual: {
      cielo: WMO_ES[wc.weather_code] ?? '—',
      icono: iconoCielo(wc.weather_code ?? 3, wc.is_day !== 0),
      tempAire: wc.temperature_2m ?? null,
      vientoKn: wc.wind_speed_10m ?? null,
      rachaKn: wc.wind_gusts_10m ?? null,
      vientoDir: wc.wind_direction_10m ?? null,
      presionHpa: wc.pressure_msl ?? null,
      nubes: wc.cloud_cover ?? null,
      olaM: mc.wave_height ?? null,
      olaPeriodoS: mc.wave_period ?? null,
      olaDir: mc.wave_direction ?? null,
      tempMar: mc.sea_surface_temperature ?? null,
      nivelMarM: mc.sea_level_height_msl ?? null,
    },
    tendencia,
    proximoExtremo,
    dias,
  };
}

/* ───────── ventanas de horas para cada vista ───────── */

/** Horas que cuentan para valorar un día: hoy, desde ahora y las 12 siguientes; el resto, de 7 a 20 h. */
export function horasValoracion(c: Conditions, di: number): HoraDato[] {
  const d = c.dias[di];
  if (!d) return [];
  if (!d.esHoy) return d.horas.filter((x) => x.h >= 7 && x.h <= 20);
  const todas = c.dias.slice(0, 2).flatMap((x) => x.horas);
  const i0 = todas.findIndex((x) => x.fecha === d.fecha && x.h === c.horaActual);
  return todas.slice(Math.max(0, i0), Math.max(0, i0) + 13);
}

/**
 * Columnas de la tira horaria: cada 3 h y como máximo 6, para que quepan en el panel sin deslizar.
 * Hoy: desde ahora (si queda poco día, se completa con la mañana siguiente); otros días: de 6 a 21 h.
 */
export function horasTira(c: Conditions, di: number): HoraDato[] {
  const d = c.dias[di];
  if (!d) return [];
  const paso = (xs: HoraDato[]) => xs.filter((x) => x.h % 3 === 0);
  if (!d.esHoy) return paso(d.horas.filter((x) => x.h >= 6 && x.h <= 21));
  const hoy = paso(d.horas.filter((x) => x.h >= c.horaActual));
  if (hoy.length >= 6 || !c.dias[1]) return hoy.slice(0, 6);
  return [...hoy, ...paso(c.dias[1].horas.filter((x) => x.h >= 6 && x.h <= 21))].slice(0, 6);
}
