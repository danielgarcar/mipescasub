/**
 * Tiempo y mareas de un punto con Open-Meteo (gratuita, sin clave; uso no comercial):
 *  - api.open-meteo.com          -> viento, temperatura, nubosidad, presión, lluvia
 *  - marine-api.open-meteo.com   -> oleaje, temperatura del mar y nivel del mar (incluye marea)
 *
 * El nivel del mar viene de un modelo global de baja resolución (~8 km): sirve para saber si
 * la marea sube o baja y las horas aproximadas de pleamar/bajamar, no como tablas oficiales
 * (para eso, las del IHM).
 */

export type TideEvent = { tipo: 'pleamar' | 'bajamar'; hora: string; alturaM: number };

export type HourForecast = {
  hora: string;
  icono: string;
  cielo: string;
  vientoKn: number;
  rachaKn: number;
  vientoDir: number;
  olaM: number | null;
  lluviaPct: number | null;
};

export type Conditions = {
  zonaHoraria: string;
  actual: {
    cielo: string;
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
  marea: { tendencia: 'subiendo' | 'bajando' | null; eventos: TideEvent[] };
  proximas: HourForecast[];
  /** Avisos de las próximas 24 h: lluvia, tormenta, sol… */
  resumen: { icono: string; texto: string }[];
  amanecer: string | null;
  atardecer: string | null;
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

/** Extremos de la serie horaria; la hora se afina con una parábola por los tres puntos. */
function extremos(times: string[], levels: (number | null)[], desde: number): TideEvent[] {
  const out: TideEvent[] = [];
  for (let i = Math.max(1, desde); i < levels.length - 1; i++) {
    const a = levels[i - 1], b = levels[i], c = levels[i + 1];
    if (a === null || b === null || c === null) continue;
    const pleamar = b > a && b >= c;
    const bajamar = b < a && b <= c;
    if (!pleamar && !bajamar) continue;
    const den = a - 2 * b + c;
    const delta = den !== 0 ? (0.5 * (a - c)) / den : 0; // desplazamiento en horas respecto a i
    const t = new Date(times[i] + ':00').getTime() + delta * 3600_000;
    const d = new Date(t);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const alt = den !== 0 ? b - (0.25 * (a - c) * (a - c)) / den : b; // valor en el vértice de la parábola
    out.push({ tipo: pleamar ? 'pleamar' : 'bajamar', hora: `${fecha(times[i])} ${hh}:${mm}`, alturaM: alt });
  }
  return out;
}

/** Avisos de las próximas 24 h a partir de la serie horaria. */
function resumir(w: any, desde: number): { icono: string; texto: string }[] {
  const h = w?.hourly;
  if (!h?.time) return [];
  const out: { icono: string; texto: string }[] = [];
  const fin = Math.min(h.time.length, desde + 24);
  const hora = (i: number) => (i === desde ? 'ahora' : `${fecha(h.time[i])} ${h.time[i].slice(11, 16)}`);
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
    out.push({ icono: '☂️', texto: 'Sin lluvia prevista en las próximas 24 h' });
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

export async function getConditions(lat: number, lng: number): Promise<Conditions | null> {
  const q = `latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&timezone=auto&forecast_days=3`;
  const [w, m] = await Promise.all([
    getJson(
      `https://api.open-meteo.com/v1/forecast?${q}&wind_speed_unit=kn` +
        '&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,pressure_msl,cloud_cover' +
        '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation_probability,precipitation,weather_code,is_day' +
        '&daily=sunrise,sunset',
    ),
    getJson(
      `https://marine-api.open-meteo.com/v1/marine?${q}` +
        '&current=wave_height,wave_period,wave_direction,sea_surface_temperature,sea_level_height_msl' +
        '&hourly=wave_height,sea_level_height_msl',
    ),
  ]);
  if (!w && !m) return null;

  const wc = w?.current ?? {};
  const mc = m?.current ?? {};
  const horasW: string[] = w?.hourly?.time ?? [];
  const horasM: string[] = m?.hourly?.time ?? [];

  // Mareas: desde la hora actual.
  const nowIso: string = mc.time ?? wc.time ?? '';
  const iNow = Math.max(0, horasM.findIndex((t) => t >= nowIso.slice(0, 13) + ':00'));
  const nivel: (number | null)[] = m?.hourly?.sea_level_height_msl ?? [];
  const eventos = extremos(horasM, nivel, iNow).slice(0, 4);
  const aN = nivel[iNow], bN = nivel[iNow + 1];
  const tendencia = aN != null && bN != null ? (bN > aN ? 'subiendo' : 'bajando') : null;

  // Próximas horas cada 3 h.
  const iW = Math.max(0, horasW.findIndex((t) => t >= nowIso.slice(0, 13) + ':00'));
  const proximas: HourForecast[] = [];
  for (let k = 0; k < 9 && iW + k * 3 < horasW.length; k++) {
    const i = iW + k * 3;
    const j = horasM.indexOf(horasW[i]);
    const code: number = w.hourly.weather_code?.[i] ?? 3;
    proximas.push({
      icono: iconoCielo(code, w.hourly.is_day?.[i] !== 0),
      cielo: WMO_ES[code] ?? '—',
      hora: fecha(horasW[i]) + ' ' + horasW[i].slice(11, 16),
      vientoKn: w.hourly.wind_speed_10m[i],
      rachaKn: w.hourly.wind_gusts_10m[i],
      vientoDir: w.hourly.wind_direction_10m[i],
      olaM: j >= 0 ? (m?.hourly?.wave_height?.[j] ?? null) : null,
      lluviaPct: w.hourly.precipitation_probability?.[i] ?? null,
    });
  }

  const resumen = resumir(w, iW);

  return {
    zonaHoraria: w?.timezone ?? m?.timezone ?? '',
    actual: {
      cielo: WMO_ES[wc.weather_code] ?? '—',
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
    marea: { tendencia, eventos },
    proximas,
    resumen,
    amanecer: w?.daily?.sunrise?.[0]?.slice(11, 16) ?? null,
    atardecer: w?.daily?.sunset?.[0]?.slice(11, 16) ?? null,
  };
}
