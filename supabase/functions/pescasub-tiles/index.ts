// ============================================================================
// Edge Function: pescasub-tiles
// ----------------------------------------------------------------------------
// Sirve teselas de batimetría MBAR24 (zoom 8–17, PNG) desde Supabase Storage
// (bucket PRIVADO 'teselas-mbar', creado en supabase/setup.sql).
//
//   GET  https://<PROJECT_REF>.supabase.co/functions/v1/pescasub-tiles/{z}/{x}/{y}.png
//   HEAD igual (algunos clientes de prefetch hacen HEAD)
//
//   200 image/png   tesela servida (Cache-Control 30 días → CDN de Storage)
//   404             no existe esa tesela en el bucket (Cache-Control corto:
//                   el visor NO debe cachearla largo; puede aparecer más tarde)
//   400             z/x/y fuera de rango (z 8..17, 0 <= x,y < 2^z) o path inválido
//   500             config incompleta (ver Secrets)
//
// CÓMO SUBIR LA CACHÉ LOCAL DE TESELAS (ya generadas en este PC):
//   Fuente local:  C:/Users/Daniel/AppData/Local/hermes/cache/visor_cartas/tiles/mbar
//   Estructura:    {z}/{x}/{y}.png  ·  8.407 PNG  ·  ~28 MB  ·  z 8..16
//                  (z17 aún no tiene teselas; la función acepta hasta z17 por
//                  diseño, de modo que nuevas generaciones encajen sin cambios)
//   Cobertura:     rango x/y por zoom, por ejemplo:
//                    z 8:  x 121          · y 94
//                    z12:  x 1946..1950   · y 1512..1518
//                    z16:  x 31140..31206 · y 24198..24290
//                  (costa gallega — Rías Baixas y alrededores)
//
//   Opción A (RECOMENDADA — subida recursiva, 1 objeto por tesela):
//       cd C:/Users/Daniel/AppData/Local/hermes/cache/visor_cartas/tiles
//       npx supabase login                          # una vez (token interactivo)
//       npx supabase link --project-ref <PROJECT_REF>
//       npx supabase storage cp --recursive ./mbar "teselas-mbar/mbar"
//     - Deja los objetos como mbar/{z}/{x}/{y}.png. Son 8.407 subidas
//       individuales (con --recursive la CLI las lanza en lotes). Tarda una
//       poca cosa, pero permite sustituir teselas individuales más adelante.
//     - Alternativa sin CLI: Dashboard → Storage → teselas-mbar → Upload →
//       "Upload folder" eligiendo la carpeta `mbar` (conserva subcarpetas).
//
//   Opción B (un único tar.gz, por si las 8k subidas chocan con rate limits):
//       tar -czf mbar24-tiles.tar.gz mbar
//       npx supabase storage cp ./mbar24-tiles.tar.gz "teselas-mbar/mbar24-tiles.tar.gz"
//     PERO esta función NO descomprime: con el tar suelto harían falta pasos
//     extra (otra function que lo extraiga al bucket con std/archive de Deno
//     o vaciado local posterior). Para el MVP usa la Opción A.
//
//   Verificación tras subir (debe devolver 8.407 objetos):
//       npx supabase storage ls teselas-mbar --recursive | wc -l
//
// Secrets/vars (`supabase secrets set ...`; las dos primeras las inyecta la
// plataforma automáticamente):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   PESCASUB_TILES_BUCKET   (opcional, default 'teselas-mbar')
//   PESCASUB_MIN_ZOOM       (opcional, default 8)
//   PESCASUB_MAX_ZOOM       (opcional, default 17)
//
// Auth: desplegar con --verify-jwt=false para MVP (el bucket es PRIVADO; solo
// service_role lee aquí). Si algún día se quiere restringir a usuarios
// logueados: desplegar con --verify-jwt=true y añadir en el cliente el header
// `Authorization: Bearer <access_token>`.
//
// Por qué Storage y no dentro del bundle: el límite de bundle de una Edge
// Function (~12 MB descomprimidos) dejaría fuera las 8.407 teselas; con
// Storage + CDN + cache-control la entrega escala sin tocar código.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") !== undefined
  ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  : undefined;

const SERVICE_ROLE = (SERVICE_ROLE_KEY ?? "").trim();

const BUCKET = Deno.env.get("PESCASUB_TILES_BUCKET") ?? "teselas-mbar";
const MIN_Z = Number(Deno.env.get("PESCASUB_MIN_ZOOM") ?? "8");
const MAX_Z = Number(Deno.env.get("PESCASUB_MAX_ZOOM") ?? "17");

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey",
  "Access-Control-Max-Age": "86400",
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Parsea `{z}/{x}/{y}.png` y devuelve {z,x,y} o null si es inválido. */
function parseTilePath(path: string): { z: number; x: number; y: number } | null {
  const m = path.match(/^\/?(\d+)\/(\d+)\/(\d+)\.png$/i);
  if (!m) return null;
  const z = Number(m[1]);
  const x = Number(m[2]);
  const y = Number(m[3]);
  if (z < MIN_Z || z > MAX_Z) return null;
  const lim = 2 ** z;
  if (x < 0 || x >= lim || y < 0 || y >= lim) return null;
  return { z, x, y };
}

function pngResponse(bytes: ArrayBuffer, status = 200): Response {
  return new Response(bytes, {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=2592000, immutable", // 30 días
    },
  });
}

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...extraHeaders },
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // 1) Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 2) Solo GET/HEAD
  if (req.method !== "GET" && req.method !== "HEAD") {
    return jsonResponse({ error: "method_not_allowed", allowed: ["GET", "HEAD"] }, 405);
  }

  // 3) Config
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return jsonResponse(
      { error: "config_missing", hint: "faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY" },
      500,
    );
  }

  // Cliente service_role: omite RLS y puede leer el bucket privado.
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // 4) Parsear {z}/{x}/{y}.png del path (con o sin prefijo de la function)
  const url = new URL(req.url);
  let rel = url.pathname.replace(/^.*pescasub-tiles\/?/, ""); // tolerante: el gateway puede anteponer /functions/v1
  try {
    rel = decodeURIComponent(rel);
  } catch {
    // si falla el decode, el regex de abajo lo rechaza igualmente
  }
  const parsed = parseTilePath(rel);
  if (!parsed) {
    return jsonResponse(
      {
        error: "invalid_tile",
        usage: `GET ${url.origin}/functions/v1/pescasub-tiles/{z}/{x}/{y}.png  (z ${MIN_Z}..${MAX_Z})`,
      },
      400,
    );
  }
  const { z, x, y } = parsed;

  // 5) Descargar del bucket privado con service_role
  const objectPath = `${z}/${x}/${y}.png`;
  const { data, error } = await supabase.storage.from(BUCKET).download(objectPath);

  if (data) {
    return pngResponse(await data.arrayBuffer());
  }

  // 6) Gestión de errores de Storage
  const msg = (error?.message ?? "sin mensaje").toLowerCase();
  if (msg.includes("not found") || msg.includes("does not exist")) {
    return jsonResponse({ error: "tile_not_found", path: objectPath }, 404, {
      "Cache-Control": "public, max-age=300", // cache corto: la tesela puede subirse después
    });
  }
  return jsonResponse({ error: "storage_error", message: error?.message ?? "sin mensaje" }, 502);
});
