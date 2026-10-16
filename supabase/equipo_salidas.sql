-- ============================================================================
--  Equipo (checklist) y Salidas de pesca
--  Solo AÑADE tablas pescasub_* (no toca nada existente). Idempotente.
--
--  Privacidad de las salidas:
--   · La tabla pescasub_salidas guarda el punto EXACTO y solo la lee su dueño (RLS).
--   · Todos los demás ven únicamente la zona APROXIMADA (celda de ~2 km) a través de
--     pescasub_salidas_visibles(), una función SECURITY DEFINER que nunca devuelve el punto exacto.
--   · Visibilidad: 'privada' (solo yo) · 'usuarios' (los que yo indique, ven mi nombre)
--                  · 'publica' (cualquier usuario con sesión, sin nombre).
--   · No se envía ningún aviso (ni correo ni SMS): quien tiene acceso ve el estado en la app.
-- ============================================================================

-- ---------- Equipo ----------
create table if not exists public.pescasub_equipo (
  id         uuid primary key default gen_random_uuid(),
  usuario    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre     text not null check (char_length(nombre) between 1 and 80),
  categoria  text not null default 'otros'
             check (categoria in ('traje','pesca','seguridad','barco','otros')),
  nota       text check (nota is null or char_length(nota) <= 300),
  caduca     date,
  creado_en  timestamptz not null default now()
);
create index if not exists pescasub_equipo_usuario_idx on public.pescasub_equipo (usuario);

alter table public.pescasub_equipo enable row level security;
drop policy if exists "pescasub_equipo_dueno" on public.pescasub_equipo;
create policy "pescasub_equipo_dueno" on public.pescasub_equipo
  for all to authenticated
  using (usuario = auth.uid()) with check (usuario = auth.uid());

-- ---------- Salidas ----------
create table if not exists public.pescasub_salidas (
  id           uuid primary key default gen_random_uuid(),
  usuario      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  spot         uuid references public.pescasub_spots(id) on delete set null,
  lat          double precision not null check (lat between -90 and 90),
  lon          double precision not null check (lon between -180 and 180),
  inicio       timestamptz not null,
  fin_previsto timestamptz not null,
  salida_real  timestamptz,
  estado       text not null default 'planeada'
               check (estado in ('planeada','en_agua','fuera','cancelada')),
  visibilidad  text not null default 'privada'
               check (visibilidad in ('privada','usuarios','publica')),
  personas     int  not null default 1 check (personas between 1 and 20),
  notas        text check (notas is null or char_length(notas) <= 300),
  creado_en    timestamptz not null default now(),
  check (fin_previsto > inicio)
);
create index if not exists pescasub_salidas_usuario_idx on public.pescasub_salidas (usuario, estado);
create index if not exists pescasub_salidas_publicas_idx on public.pescasub_salidas (visibilidad, fin_previsto)
  where visibilidad <> 'privada';

alter table public.pescasub_salidas enable row level security;
drop policy if exists "pescasub_salidas_dueno" on public.pescasub_salidas;
create policy "pescasub_salidas_dueno" on public.pescasub_salidas
  for all to authenticated
  using (usuario = auth.uid()) with check (usuario = auth.uid());

-- Usuarios con los que el dueño comparte una salida (modo 'usuarios').
create table if not exists public.pescasub_salidas_usuarios (
  salida  uuid not null references public.pescasub_salidas(id) on delete cascade,
  usuario uuid not null references auth.users(id) on delete cascade,
  primary key (salida, usuario)
);
create index if not exists pescasub_salidas_usuarios_usuario_idx on public.pescasub_salidas_usuarios (usuario);

alter table public.pescasub_salidas_usuarios enable row level security;
drop policy if exists "pescasub_salidas_usuarios_dueno" on public.pescasub_salidas_usuarios;
create policy "pescasub_salidas_usuarios_dueno" on public.pescasub_salidas_usuarios
  for all to authenticated
  using (exists (select 1 from public.pescasub_salidas s where s.id = salida and s.usuario = auth.uid()))
  with check (
    usuario <> auth.uid()
    and exists (select 1 from public.pescasub_salidas s where s.id = salida and s.usuario = auth.uid())
  );

-- ---------- Lo que ve cada usuario (zona aproximada) ----------
-- Celda de 0,02° (~2,2 km de alto): se devuelve el CENTRO de la celda, nunca el punto exacto.
create or replace function public.pescasub_salidas_visibles()
returns table (
  id           uuid,
  es_mia       boolean,
  autor        text,
  zona_lat     double precision,
  zona_lng     double precision,
  inicio       timestamptz,
  fin_previsto timestamptz,
  estado       text,
  personas     int,
  visibilidad  text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    (s.usuario = auth.uid()),
    -- el nombre solo se enseña al dueño y a los usuarios elegidos; la vista pública es anónima
    case when s.usuario = auth.uid() or s.visibilidad = 'usuarios'
         then coalesce(p.alias, p.nombre) end,
    floor(s.lat / 0.02) * 0.02 + 0.01,
    floor(s.lon / 0.02) * 0.02 + 0.01,
    s.inicio,
    s.fin_previsto,
    s.estado,
    s.personas,
    s.visibilidad
  from public.pescasub_salidas s
  left join public.pescasub_perfiles p on p.id = s.usuario
  where auth.uid() is not null
    and s.estado in ('planeada', 'en_agua')
    and s.fin_previsto > now() - interval '6 hours'
    and s.inicio < now() + interval '3 days'
    and (
      s.usuario = auth.uid()
      or s.visibilidad = 'publica'
      or (s.visibilidad = 'usuarios' and exists (
            select 1 from public.pescasub_salidas_usuarios u
            where u.salida = s.id and u.usuario = auth.uid()))
    )
  order by s.inicio;
$$;

revoke all on function public.pescasub_salidas_visibles() from public, anon;
grant execute on function public.pescasub_salidas_visibles() to authenticated;
