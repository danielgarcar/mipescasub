/**
 * Información de un punto del mapa: posición GPS, profundidad y tipo de fondo.
 *
 * Fuentes (todas públicas, sin clave):
 *  - ENC del IHM (WMS GetFeatureInfo): rango de profundidad (DEPARE) y tipo de fondo (SBDARE/NATSUR).
 *    Los tipos de fondo de la carta son puntos sueltos, así que si el punto pulsado no tiene
 *    ninguno se buscan en anillos crecientes y se devuelve el más cercano (con su distancia).
 *  - EMODnet Bathymetry: profundidad media de la malla (~115 m).
 *  - EMODnet Geology: sustrato del fondo modelado (cartografía por polígonos), como estimación.
 */

export type SeabedFound = {
  /** Tipos en español, p. ej. ['arena', 'fango']. */
  tipos: string[];
  /** Calidad de la superficie si la carta la indica (fino, grueso…). */
  calidad: string[];
  /** Distancia aproximada al dato de la carta (0 = en el propio punto). */
  distanciaM: number;
};

export type PointInfo = {
  lat: number;
  lng: number;
  profundidadM: number | null;
  rangoCartaM: [number, number] | null;
  fondoCarta: SeabedFound | null;
  fondoModelo: string | null;
};

const ENC_INFO = 'https://ideihm.covam.es/encwms';
const R = 6378137;

const FONDO_ES: Record<string, string> = {
  mud: 'fango', 'fine sand': 'arena fina', sand: 'arena', gravel: 'grava', stone: 'piedra', rock: 'roca',
  rocks: 'roca', boulders: 'bloques', cobbles: 'cantos rodados', pebbles: 'guijarros', shingle: 'guijarros gruesos',
  clay: 'arcilla', silt: 'limo', ooze: 'cieno', coral: 'coral', 'coral head': 'cabeza de coral', shells: 'conchas',
  'weed (including kelp)': 'algas', kelp: 'algas', 'sea-weed': 'algas', 'sea weed': 'algas', lava: 'lava',
  bedrock: 'roca madre', fine: 'fino', medium: 'medio', coarse: 'grueso', hard: 'duro', soft: 'blando',
  sticky: 'pegajoso', stiff: 'compacto', muddy: 'fangoso', sandy: 'arenoso', 'broken (shells)': 'fragmentado',
};

const MODELO_ES: Record<string, string> = {
  mud: 'fango', 'mud to muddy sand': 'fango a arena fangosa', sand: 'arena', 'muddy sand': 'arena fangosa',
  'sandy mud': 'fango arenoso', 'coarse substrate': 'sustrato grueso (grava / piedra)', 'mixed sediment': 'sedimento mixto',
  'rock or other hard substrata': 'roca u otro sustrato duro', 'sandy gravel': 'grava arenosa', 'gravelly sand': 'arena con grava',
  gravel: 'grava', 'muddy gravel': 'grava fangosa', 'rock & boulders': 'roca y bloques',
};

export function traducirFondo(en: string): string {
  const k = en.trim().toLowerCase();
  return FONDO_ES[k] ?? k;
}

function traducirModelo(en: string): string {
  const k = en.trim().toLowerCase();
  return MODELO_ES[k] ?? FONDO_ES[k] ?? en.trim();
}

function toMercator(lat: number, lng: number): [number, number] {
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [x, y];
}

async function getText(url: string): Promise<string | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** GetFeatureInfo de la ENC en un punto (en metros Mercator). Escala ~55 m/px: a esa escala la carta
 *  muestra los tipos de fondo y el pixel consultado tolera ~100 m de distancia a su símbolo. */
function encInfo(x: number, y: number): Promise<string | null> {
  const half = 300;
  const url =
    `${ENC_INFO}?service=WMS&version=1.3.0&request=GetFeatureInfo&layers=ENC&query_layers=ENC&styles=` +
    `&format=image/png&info_format=text/plain&crs=EPSG:3857&width=11&height=11&i=5&j=5` +
    `&bbox=${x - half},${y - half},${x + half},${y + half}&feature_count=60`;
  return getText(url);
}

function parseSeabed(text: string): { tipos: string[]; calidad: string[] } | null {
  const bloque = text.match(/Seabed Area \(SBDARE\)[\s\S]*?(?=\n\S|$)/);
  if (!bloque) return null;
  const lista = (etiqueta: string) => {
    const m = bloque[0].match(new RegExp(`${etiqueta}[^\\n]*?\\):\\s*([^\\n]*)`));
    if (!m) return [];
    return m[1]
      .split(/;|,/)
      .map((s) => s.replace(/\(\d+\)/, '').trim())
      .filter(Boolean)
      .map(traducirFondo);
  };
  const tipos = lista('(?:Natural|Nature of) surface \\(NATSUR');
  if (!tipos.length) return null;
  return { tipos, calidad: lista('(?:Natural|Nature of) qualifying terms \\(NATQUA') };
}

function parseDepthRange(text: string): [number, number] | null {
  const a = text.match(/DRVAL1\):\s*(-?[\d.]+)/);
  const b = text.match(/DRVAL2\):\s*(-?[\d.]+)/);
  return a && b ? [parseFloat(a[1]), parseFloat(b[1])] : null;
}

async function seabedCarta(
  x: number,
  y: number,
  centro: string | null,
): Promise<{ found: SeabedFound | null; rango: [number, number] | null }> {
  const rango = centro ? parseDepthRange(centro) : null;
  const c = centro ? parseSeabed(centro) : null;
  if (c) return { found: { ...c, distanciaM: 0 }, rango };
  for (const radio of [200, 400, 700, 1000]) {
    const textos = await Promise.all(
      Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return encInfo(x + radio * Math.cos(a), y + radio * Math.sin(a));
      }),
    );
    for (const t of textos) {
      const s = t ? parseSeabed(t) : null;
      if (s) return { found: { ...s, distanciaM: radio }, rango };
    }
  }
  return { found: null, rango };
}

async function profundidadEmodnet(lat: number, lng: number): Promise<number | null> {
  const d = 0.0005;
  const url =
    'https://ows.emodnet-bathymetry.eu/wms?service=WMS&version=1.1.1&request=GetFeatureInfo' +
    '&layers=emodnet:mean&query_layers=emodnet:mean&styles=&srs=EPSG:4326' +
    `&bbox=${lng - d},${lat - d},${lng + d},${lat + d}&width=101&height=101&x=50&y=50&info_format=application/json`;
  const t = await getText(url);
  try {
    const v = t ? JSON.parse(t)?.features?.[0]?.properties?.Depth : null;
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
}

async function sustratoModelo(lat: number, lng: number): Promise<string | null> {
  // Se prueba el punto y, si cae en un hueco, cuatro puntos a ~300 m.
  const pts: [number, number][] = [[lat, lng]];
  const d = 0.003;
  pts.push([lat + d, lng], [lat - d, lng], [lat, lng + d], [lat, lng - d]);
  for (const [la, ln] of pts) {
    const h = 0.05;
    const url =
      'https://drive.emodnet-geology.eu/geoserver/gtk/wms?service=WMS&version=1.3.0&request=GetFeatureInfo' +
      '&layers=seabed_substrate_250k&query_layers=seabed_substrate_250k&styles=&crs=EPSG:4326' +
      `&bbox=${la - h},${ln - h},${la + h},${ln + h}&width=101&height=101&i=50&j=50&info_format=application/json`;
    const t = await getText(url);
    try {
      const p = t ? JSON.parse(t)?.features?.[0]?.properties : null;
      const txt: string | undefined = p?.original_substrate?.trim() || p?.folk_5cl_txt?.replace(/^\d+\.\s*/, '');
      if (txt) return traducirModelo(txt);
    } catch {
      /* siguiente punto */
    }
  }
  return null;
}

export async function getPointInfo(lat: number, lng: number): Promise<PointInfo> {
  const [x, y] = toMercator(lat, lng);
  const centro = await encInfo(x, y);
  const [carta, profundidadM, fondoModelo] = await Promise.all([
    seabedCarta(x, y, centro),
    profundidadEmodnet(lat, lng),
    sustratoModelo(lat, lng),
  ]);
  return {
    lat,
    lng,
    profundidadM: profundidadM !== null && profundidadM < 0 ? Math.abs(profundidadM) : null,
    rangoCartaM: carta.rango,
    fondoCarta: carta.found,
    fondoModelo,
  };
}

/** 42.38123° N, 8.80123° O */
export function formatDecimal(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? 'E' : 'O'}`;
}

/** 42° 22.874' N, 8° 48.073' O (grados y minutos, habitual en náutica) */
export function formatNautical(lat: number, lng: number): string {
  const f = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    const g = Math.floor(a);
    return `${g}° ${((a - g) * 60).toFixed(3)}' ${v >= 0 ? pos : neg}`;
  };
  return `${f(lat, 'N', 'S')}, ${f(lng, 'E', 'O')}`;
}
