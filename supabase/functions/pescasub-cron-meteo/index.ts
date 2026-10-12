// ============================================================================
// Edge Function: pescasub-cron-meteo
// ----------------------------------------------------------------------------
// Consulta la API Open-Meteo Marine y cachea el resultado en la tabla
// public.pescasub_meteo_cache (DDL inline en supabase/setup.sql).
//
// API:  https://marine-api.open-meteo.com/v1/marine
//         ?latitude={lat}&longitude={lon}
//         &current=wave_height,sea_surface_temperature
//
//   GET/POST https://<PROJECT_REF>.supabase.co/functions/v1/pescasub-cron-meteo
//
//   POST body (opcional): { "points": [ { "latitude": 36.02, "longitude": -5.60 } ],
//                           "force": true }
//
//   Respuesta típica (200):
//     {
//       "ok": true,
//       "consultados": 12,
//       "consultados_stale": 3,
//       "actualizados": [ {"clave":"36.02,-5.60","wave_height":1.2,
//                          "sea_surface_temperature":18.4,"updated_at":"..."} ],
//       "omitidos_frescos": 9,
//       "fallos_fetch": 0,
//       "ttl_min": 30
//     }
//
// De dónde salen los puntos (en orden de prioridad):
//   1. body POST "points" (pruebas / ad-hoc)
//   2. secret PESCASUB_METEO_POINTS (JSON, misma forma que body.points)
//   3. tabla pescasub_spots — lee todos los spots y DEDUPLICA a 2 decimales
//      (≈1 km, la resolución de pescasub_meteo_cache con clave "lat,lon")
//
// NOTA sobre el esquema de pescasub_spots: las columnas de ubicación no se
// pueden confirmar desde aquí (la tabla ya existe y no hay DDL local). El
// descubridor es tolerante: busca lat en {lat, latitude, latitud} y lon en
// {lon, lng, longitud, longitude}, con fallback a geometría serializada tipo
// PostGIS "(lon lat)". Si tu tabla usa otros nombres, lo más robusto es
// definir PESCASUB_METEO_POINTS y no depender del descubrimiento automático.
//
// Secrets (`supabase secrets set ...`; las dos primeras auto-inyectadas):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   PESCASUB_CRON_SECRET   — si se define, toda llamada debe traer el header
//                            `x-cron-secret: <valor>` (o ?cron_secret=). Sin
//                            él, se queda en modo abierto (MVP / pruebas).
//   PESCASUB_METEO_POINTS  — JSON de puntos fijos (opcional)
//   PESCASUB_METEO_TTL_MIN — TTL de caché en minutos (default 30)
//
// Cron: ver bloque opcional al final de supabase/setup.sql (pg_cron + pg_net)
// o un cron externo que llame a esta URL con el header x-cron-secret.
// ============================================================================

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
const CRON_SECRET = Deno.env.get("PESCASUB_CRON_SECRET") ?? "";
const TTL_MIN = Number(Deno.env.get("PESCASUB_METEO_TTL_MIN") ?? "30");

const METEO_API = "https://marine-api.open-meteo.com/v1/marine";
const CURRENT_FIELDS = "wave_height,sea_surface_temperature";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-cron-secret",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface MeteoPoint {
  latitude: number;
  longitude: number;
}

interface CacheRow {
  clave: string;
  latitude: number;
  longitude: number;
  wave_height: number | null;
  sea_surface_temperature: number | null;
  source: string;
}

interface UpdateSummary {
  clave: string;
  wave_height: number | null;
  sea_surface_temperature: number | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Cifra clave = "lat,lon" redondeadas a 2 decimales (≈1 km)
// ---------------------------------------------------------------------------
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function clave(lat: number, lon: number): string {
  return `${round2(lat)},${round2(lon)}`;
}

// ---------------------------------------------------------------------------
// Dedupe (una única entrada por clave "lat,lon")
// ---------------------------------------------------------------------------
function dedupe(points: MeteoPoint[]): MeteoPoint[] {
  const seen = new Map<string, MeteoPoint>();
  for (const p of points) {
    if (typeof p.latitude !== "number" || typeof p.longitude !== "number") continue;
    if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) continue;
    const k = clave(p.latitude, p.longitude);
    if (!seen.has(k)) seen.set(k, p);
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// Descubre puntos desde pescasub_spots (mapping tolerante) — SERVICE ROLE
// ---------------------------------------------------------------------------
async function discoverPointsFromSpots(
  supabase: SupabaseClient,
): Promise<MeteoPoint[]> {
  // select("*") para no romper si las columnas se llaman distinto
  const { data, error } = await supabase.from("pescasub_spots").select("*").limit(500);
  if (error) {
    console.error("pescasub_spots select error:", error.message);
    return [];
  }

  const out: MeteoPoint[] = [];
  for (const spot of (data ?? []) as Record<string, unknown>[]) {
    const latCandidates = [spot.lat, spot.latitude, spot.latitud];
    const lonCandidates = [spot.lon, spot.lng, spot.longitud, spot.longitude];
    const lat = latCandidates.find(
      (v): v is number => typeof v === "number" && Number.isFinite(v),
    );
    const lon = lonCandidates.find(
      (v): v is number => typeof v === "number" && Number.isFinite(v),
    );
    if (lat !== undefined && lon !== undefined) {
      out.push({ latitude: lat, longitude: lon });
      continue;
    }
    // Fallback: geometría PostGIS serializada (string "lon lat" o "(lon lat)")
    const geom = (spot.geom ?? spot.ubicacion ?? spot.localizacion) as unknown;
    if (typeof geom === "string") {
      const nums = geom.match(/-?\d+(\.\d+)?/g);
      if (nums && nums.length >= 2) {
        const a = Number(nums[0]);
        const b = Number(nums[1]);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          // PostGIS ASText pone lon primero: si a cabe en rango de lon y b en
          // rango de lat, asumimos (lon lat)
          if (Math.abs(a) <= 180 && Math.abs(b) <= 90) {
            out.push({ latitude: b, longitude: a });
          } else {
            out.push({ latitude: a, longitude: b });
          }
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Open-Meteo Marine — batch: latitude=a,b&longitude=c,d → array de resultados
// ---------------------------------------------------------------------------
async function fetchMeteo(
  points: MeteoPoint[],
): Promise<{ rows: CacheRow[]; failedCount: number }> {
  if (points.length === 0) return { rows: [], failedCount: 0 };

  const lats = points.map((p) => round2(p.latitude)).join(",");
  const lons = points.map((p) => round2(p.longitude)).join(",");
  const url = `${METEO_API}?latitude=${lats}&longitude=${lons}&current=${CURRENT_FIELDS}&timezone=auto`;

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    console.error("Open-Meteo HTTP", res.status, await res.text());
    return { rows: [], failedCount: points.length };
  }

  const body = await res.json();
  // Un punto → objeto único; varios → array
  const entries: Record<string, unknown>[] = Array.isArray(body) ? body : [body];

  const rows: CacheRow[] = [];
  entries.forEach((entry: Record<string, unknown>, i: number) => {
    const lat = Number(entry.latitude ?? points[i]?.latitude);
    const lon = Number(entry.longitude ?? points[i]?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const current = (entry.current ?? {}) as Record<string, unknown>;
    const wh = typeof current.wave_height === "number" ? current.wave_height : null;
    const sst = typeof current.sea_surface_temperature === "number"
      ? current.sea_surface_temperature
      : null;
    rows.push({
      clave: clave(lat, lon),
      latitude: round2(lat),
      longitude: round2(lon),
      wave_height: wh,
      sea_surface_temperature: sst,
      source: "open-meteo-marine",
    });
  });

  return { rows, failedCount: points.length - rows.length };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // 1) Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed", allowed: ["GET", "POST"] }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(
      { error: "config_missing", hint: "faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY" },
      500,
    );
  }

  // 2) Gate opcional anti-spam: si hay PESCASUB_CRON_SECRET, exigirlo
  const url = new URL(req.url);
  const provided = req.headers.get("x-cron-secret") ?? url.searchParams.get("cron_secret") ?? "";
  if (CRON_SECRET && provided !== CRON_SECRET) {
    return json({ error: "unauthorized", hint: "header x-cron-secret o ?cron_secret=" }, 401);
  }

  // 3) Cuerpo (POST; opcional)
  let bodyPoints: MeteoPoint[] | undefined;
  let force = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        bodyPoints = Array.isArray(body.points) ? (body.points as MeteoPoint[]) : undefined;
        force = Boolean(body.force);
      }
    } catch {
      // body vacío/inválido → usa env o spots
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // 4) Resolver puntos de trabajo (prioridad body > env > spots)
  let points: MeteoPoint[] = [];
  if (bodyPoints && bodyPoints.length > 0) {
    points = dedupe(bodyPoints);
  } else {
    const envRaw = Deno.env.get("PESCASUB_METEO_POINTS");
    if (envRaw) {
      try {
        const parsed = JSON.parse(envRaw) as MeteoPoint[];
        points = dedupe(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error("PESCASUB_METEO_POINTS inválido:", (e as Error).message);
      }
    }
  }
  if (points.length === 0) {
    points = dedupe(await discoverPointsFromSpots(supabase));
  }

  // Cap de seguridad: Open-Meteo acepta bastantes coordenadas por request,
  // pero nos limitamos a 100 por lote para no exceder el tamaño permitido.
  if (points.length > 100) points = points.slice(0, 100);

  if (points.length === 0) {
    return json({ ok: true, consultados: 0, actualizados: [], note: "sin puntos que consultar" });
  }

  // 5) Saltar puntos "frescos" (updated_at < TTL) salvo force=true
  const keys = points.map((p) => clave(p.latitude, p.longitude));
  const fresh = new Set<string>();
  const cutoff = Date.now() - TTL_MIN * 60_000;
  if (!force) {
    // PostgREST limita el tamaño de `in(...)`; troceamos
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100);
      const { data, error } = await supabase
        .from("pescasub_meteo_cache")
        .select("clave, updated_at")
        .in("clave", chunk);
      if (error) {
        console.error("cache select error:", error.message);
        continue;
      }
      for (const r of (data ?? []) as { clave: string; updated_at: string }[]) {
        if (new Date(r.updated_at).getTime() > cutoff) fresh.add(r.clave);
      }
    }
  }
  const stale = points.filter((p) => !fresh.has(clave(p.latitude, p.longitude)));

  if (stale.length === 0) {
    return json({
      ok: true,
      consultados: keys.length,
      consultados_stale: 0,
      actualizados: [],
      omitidos_frescos: fresh.size,
      ttl_min: TTL_MIN,
    });
  }

  // 6) Consultar API en lotes de 100 y upsert a la caché
  const actualizados: UpdateSummary[] = [];
  let fallosFetch = 0;
  const nowIso = new Date().toISOString();
  for (let i = 0; i < stale.length; i += 100) {
    const batch = stale.slice(i, i + 100);
    const { rows, failedCount } = await fetchMeteo(batch);
    fallosFetch += failedCount;
    if (rows.length === 0) continue;
    const { error: upsertErr } = await supabase
      .from("pescasub_meteo_cache")
      .upsert(rows, { onConflict: "clave" });
    if (upsertErr) {
      return json({ ok: false, error: "upsert_failed", message: upsertErr.message }, 500);
    }
    for (const r of rows) {
      actualizados.push({
        clave: r.clave,
        wave_height: r.wave_height,
        sea_surface_temperature: r.sea_surface_temperature,
        updated_at: nowIso,
      });
    }
  }

  return json({
    ok: true,
    consultados: keys.length,
    consultados_stale: stale.length,
    actualizados,
    fallos_fetch: fallosFetch,
    omitidos_frescos: fresh.size,
    ttl_min: TTL_MIN,
  });
});
