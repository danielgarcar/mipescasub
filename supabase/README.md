# perez-sub · lado servidor Supabase

Configuración de Supabase para **perez-sub** (app Expo que vive en el mismo
repo, otra carpeta). Todas las credenciales y refs del proyecto Supabase son
**placeholders** (`<PROJECT_REF>`) — solo el usuario las conoce.

```
supabase/
├── README.md                          ← este fichero
├── setup.sql                          ← DDL inline: tabla caché meteo + buckets + RLS
├── types
│   └── database.ts                    ← tipos TS a mano de las tablas pescasub_*
└── functions/
    ├── pescasub-tiles
    │   └── index.ts                   ← sirve teselas MBAR24 desde Storage
    └── pescasub-cron-meteo
        └── index.ts                   ← Open-Meteo Marine → pescasub_meteo_cache
```

## 1. Requisitos previos

- Proyecto Supabase activo con las tablas `pescasub_*` ya creadas:
  `pescasub_perfiles`, `pescasub_spots`, `pescasub_pescas`, `pescasub_apneas`,
  `pescasub_entrenamientos`, `pescasub_foro_hilos`, `pescasub_foro_mensajes`,
  `pescasub_metco_chunkvalor`, `pescasub_progresion`.
  Este `setup.sql` NO las toca.
- La CLI se descarga on-demand con npx; no hace falta instalarla global:

```bash
npx supabase --version
```

## 2. setup.sql — tabla de caché + buckets

Abre el **SQL Editor** del Dashboard del proyecto y pega `supabase/setup.sql`
completo. Es idempotente (se puede re-ejecutar). Crea:

| Objeto                        | Tipo     | Notas |
|-------------------------------|----------|-------|
| `public.pescasub_meteo_cache` | tabla    | caché Open-Meteo Marine; clave = `"lat,lon"` a 2 decimales |
| bucket `fotos-pesca`          | Storage  | público en **lectura**; solo el **dueño** escribe (RLS `{uid}/...`) |
| bucket `teselas-mbar`         | Storage  | **privado**; solo lo lee la edge function con service_role |

También lleva al final el bloque (comentado) del cron `pg_cron` + `pg_net`.

## 3. Edge Functions — despliegue

### 3.1 Login y link (una vez por máquina)

```bash
cd <repo>/supabase
npx supabase login                       # abre el navegador; guarda el token
npx supabase link --project-ref <PROJECT_REF>
# pedirá la db password del proyecto (no va al repo)
```

### 3.2 Variables / Secrets

```bash
# pescasub-tiles — todos opcionales (defaults razonables en el código):
npx supabase secrets set PESCASUB_TILES_BUCKET=teselas-mbar
npx supabase secrets set PESCASUB_MIN_ZOOM=8
npx supabase secrets set PESCASUB_MAX_ZOOM=17

# pescasub-cron-meteo:
npx supabase secrets set PESCASUB_CRON_SECRET="$(openssl rand -hex 32)"
npx supabase secrets set PESCASUB_METEO_POINTS='[{"latitude":36.02,"longitude":-5.60}]'
npx supabase secrets set PESCASUB_METEO_TTL_MIN=30
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta la plataforma
automáticamente en la Edge Function, no hace falta setearlas. Consulta la
cabecera de cada `index.ts` para la lista completa y sus defaults.

### 3.3 Desplegar

```bash
npx supabase functions deploy pescasub-tiles --project-ref <PROJECT_REF> --verify-jwt=false
npx supabase functions deploy pescasub-cron-meteo --project-ref <PROJECT_REF> --verify-jwt=false
```

`--verify-jwt=false` solo recomendado en MVP. Con `true`, los clientes deben
incluir `Authorization: Bearer <access_token>` y el cron debe mandar el JWT
del service_role (o desactivar el gate dejando `PESCASUB_CRON_SECRET` vacío —
en cuyo caso pásalo solo por red interna).

### 3.4 Probar

```bash
# tesela que SÍ existe (la única del z8 en la caché local actual):
curl -i "https://<PROJECT_REF>.supabase.co/functions/v1/pescasub-tiles/8/121/94.png"
#   → 200 image/png, Cache-Control: public,max-age=2592000,immutable

# tesela no existente (fuera de cobertura):
curl -i "https://<PROJECT_REF>.supabase.co/functions/v1/pescasub-tiles/8/121/95.png"
#   → 404 JSON, Cache-Control corto (300 s)

# meteo, llamada manual (POST; sin PESCASUB_CRON_SECRET seteado):
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/pescasub-cron-meteo" \
  -H "Content-Type: application/json" \
  -d '{"points":[{"latitude":36.02,"longitude":-5.60}],"force":true}'

# meteo, como la llamaría el cron (con secret):
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/pescasub-cron-meteo" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <VALOR>" \
  -d '{"force":false}'
```

### 3.5 Subir la caché de teselas MBAR24 a Storage

La caché ya generada vive en este PC en
`C:/Users/Daniel/AppData/Local/hermes/cache/visor_cartas/tiles/mbar`
({z}/{x}/{y}.png, 8.407 PNG, ~28 MB, z8..z16; z17 aún sin generar). La
documentación completa está **dentro de** `functions/pescasub-tiles/index.ts`.
Resumen de la Opción A (recomendada):

```bash
cd C:/Users/Daniel/AppData/Local/hermes/cache/visor_cartas/tiles
npx supabase login && npx supabase link --project-ref <PROJECT_REF>
npx supabase storage cp --recursive ./mbar "teselas-mbar/mbar"
# comprobación (debe salir 8.407):
npx supabase storage ls teselas-mbar --recursive | wc -l
```

## 4. Cliente tipado (`types/database.ts`)

Escrito **a mano** a partir de los nombres de las tablas ya existentes. Cuando
el esquema esté confirmado, se puede regenerar de la base de datos real con:

```bash
npx supabase gen types typescript \
  --project-id <PROJECT_REF> \
  --schema public > supabase/types/database.ts
```

Import en Expo:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types/database";

const supabase: SupabaseClient<Database> = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
);
```

## 5. RLS de 'fotos-pesca' (resumen)

| Acción   | Quién         | Condición                                        |
|----------|---------------|--------------------------------------------------|
| SELECT   | anon + auth   | bucket 'fotos-pesca' (público en lectura)        |
| INSERT   | authenticated | primer segmento de ruta == `auth.uid()`          |
| UPDATE   | authenticated | dueño (ruta `{uid}/...`), check de nueva ruta    |
| DELETE   | authenticated | dueño (ruta `{uid}/...`)                         |

Convención: guarda los objetos con el uid como primera carpeta. Sin política
extra, nadie puede leer/escribir el bucket 'teselas-mbar' (solo service_role).

## 6. Cron (opcional) para pescasub-cron-meteo

Al final de `setup.sql` hay un bloque **comentado** que programa la function
cada 30 min con `pg_cron` + `pg_net`. Alternativa sin cron en base de datos:
GitHub Actions, cron-job.org, etc., apuntando a la URL con header
`x-cron-secret` (o querystring `?cron_secret=`).
