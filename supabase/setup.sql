-- ============================================================================
-- perez-sub · setup.sql — infraestructura nueva del lado servidor (idempotente)
--
-- Ejecutar en Supabase Studio → SQL Editor → Run (o, con CLI:
-- `supabase db execute -f supabase/setup.sql --db-url $SUPABASE_DB_URL`).
--
-- NO crea las tablas pescasub_* que YA existen en el proyecto
-- (pescasub_perfiles, pescasub_spots, pescasub_pescas, pescasub_apneas,
--  pescasub_entrenamientos, pescasub_foro_hilos, pescasub_foro_mensajes,
--  pescasub_metco_chunkvalor, pescasub_progresion).
-- Solo añade:
--   1) public.pescasub_meteo_cache — caché Open-Meteo Marine escrita por la
--      edge function pescasub-cron-meteo.
--   2) bucket Storage 'fotos-pesca' — público en LECTURA; solo el DUEÑO
--      escribe/actualiza/borra (rutas `{uid}/nombre.jpg`).
--   3) bucket Storage 'teselas-mbar' — privado; lo lee únicamente la edge
--      function pescasub-tiles con la clave de servicio.
--
-- Reemplaza los placeholders antes de nada y ejecuta de arriba a abajo.
-- ============================================================================

-- 0) Extensiones -------------------------------------------------------------
-- gen_random_uuid() viene de pgcrypto (preinstalada en Supabase); por si acaso
-- se ejecuta en un proyecto recién creado:
create extension if not exists pgcrypto;

-- ============================================================================
-- 1) Tabla de caché meteo: pescasub_meteo_cache
--
-- Cada fila = un punto geográfico (clave "lat,lon" con 2 decimales ≈ 1 km),
-- con el último valor `current` devuelto por Open-Meteo Marine.
-- La escribe SOLO la edge function pescasub-cron-meteo (service_role omite
-- RLS); la app la lee (política SELECT para anon+authenticated).
-- ============================================================================
create table if not exists public.pescasub_meteo_cache (
  clave                     text primary key,                    -- "12.34,-5.67"
  latitude                  double precision not null,           -- ya redondeada a 2 dec
  longitude                 double precision not null,           -- ya redondeada a 2 dec
  wave_height               double precision,                    -- m · current.wave_height
  sea_surface_temperature   double precision,                    -- °C · current.sea_surface_temperature
  source                    text not null default 'open-meteo-marine',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.pescasub_meteo_cache is
  'Caché de Open-Meteo Marine (current: wave_height, sea_surface_temperature). Escrita por la edge function pescasub-cron-meteo; clave = lat,lon redondeadas a 2 decimales.';

create index if not exists pescasub_meteo_cache_updated_at_idx
  on public.pescasub_meteo_cache (updated_at desc);

alter table public.pescasub_meteo_cache enable row level security;

drop policy if exists "pescasub_meteo_cache_select_todos" on public.pescasub_meteo_cache;
create policy "pescasub_meteo_cache_select_todos"
  on public.pescasub_meteo_cache for select
  to anon, authenticated
  using (true);

-- SIN políticas INSERT/UPDATE/DELETE a propósito: la escritura es exclusiva de
-- la edge function (service_role), que omite RLS. Así nadie desde el cliente
-- puede envenenar la caché.

-- ============================================================================
-- 2) Buckets de Storage
-- ============================================================================
-- 2a) 'fotos-pesca' — público en lectura; escritura solo del dueño.
--     Convención de ruta OBLIGATORIA: la primera carpeta del objeto debe ser
--     el uid del usuario autenticado → `{uid}/mi-foto.jpg`.
--     Las filas de pescasub_pescas guardarán referencias tipo `fotos text[]`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-pesca', 'fotos-pesca', true, 10485760,           -- 10 MB por foto
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2b) 'teselas-mbar' — PRIVADO; no accesible por URL pública. Su único
--     consumidor es la edge function pescasub-tiles, que lee con la clave
--     service_role. Estructura de objetos: `{z}/{x}/{y}.png` (z 8..17;
--     la caché local actual va de z8 a z16).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'teselas-mbar', 'teselas-mbar', false, 5242880,          -- 5 MB por tesela
  array['image/png']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- 3) Políticas RLS de Storage para 'fotos-pesca'
--    LECTURA: cualquier usuario (anon incluido) — bucket público y mostrado
--             en resúmenes de pescas sin login.
--    ESCRITURA (insert/update/delete): solo el dueño, validado porque el
--             primer segmento de la ruta del objeto == auth.uid().
--    Para 'teselas-mbar' NO se crean políticas: al ser privado y solo
--    consumido por service_role, la denegación por defecto es lo correcto.
-- ============================================================================

-- SELECT: todos leen
drop policy if exists "fotos_pesca_select_publico" on storage.objects;
create policy "fotos_pesca_select_publico"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'fotos-pesca');

-- INSERT: auth + dueño (primer segmento de ruta = uid)
drop policy if exists "fotos_pesca_insert_dueno" on storage.objects;
create policy "fotos_pesca_insert_dueno"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-pesca'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: dueño (y la nueva ruta sigue siéndolo)
drop policy if exists "fotos_pesca_update_dueno" on storage.objects;
create policy "fotos_pesca_update_dueno"
  on storage.objects for update
  to authenticated
  using (   bucket_id = 'fotos-pesca'
        and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'fotos-pesca'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: dueño
drop policy if exists "fotos_pesca_delete_dueno" on storage.objects;
create policy "fotos_pesca_delete_dueno"
  on storage.objects for delete
  to authenticated
  using (   bucket_id = 'fotos-pesca'
        and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- 4) (OPCIONAL, comentado) Cron para pescasub-cron-meteo vía pg_cron + pg_net
--
-- La edge function se calendariza por HTTP; requiere las extensiones pg_cron y
-- pg_net habilitadas (en Supabase: Database → Extensions). Descomenta y
-- sustituye placeholders.
-- ============================================================================
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- Antes: fija el secret de la función → `supabase secrets set PESCASUB_CRON_SECRET=<VALOR>`
--
-- select cron.schedule(
--   'pescasub-meteo-cada-30min',
--   '*/30 * * * *',
--   $$ select net.http_post(
--         url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/pescasub-cron-meteo',
--         headers := jsonb_build_object(
--           'Content-Type', 'application/json',
--           'x-cron-secret', '<PESCASUB_CRON_SECRET>'
--         ),
--         body    := jsonb_build_object('force', false)
--       ); $$
-- );
--
-- Alternativa sin cron en base de datos: programar la llamada con un cron
-- externo (GitHub Actions, cron-job.org, ...) apuntando a la misma URL con el
-- header x-cron-secret.
