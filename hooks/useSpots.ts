/**
 * Hooks de consultas a Supabase para spots, capturas y especies.
 *
 * Las tablas reales tienen columnas en español (`creado_en`, `descripcion`, `lon`…); aquí se
 * convierten las filas a los tipos de `@/types`, que son los que usa el resto de la app.
 */

import { useCallback, useEffect, useState } from 'react';
import { storageUrl, supabase } from '@/lib/supabase';
import type { Spot, Captura, Especie, Comentario, Compartido } from '@/types';

/* ---------------------------------- Spots ---------------------------------- */

/** Fila real de `pescasub_spots` (`lat`/`lon` van junto a `geom`). */
type SpotRow = {
  id: string;
  usuario: string;
  nombre: string;
  descripcion: string | null;
  tipo_fondo: string | null;
  profundidad_max: number | null;
  creado_en: string;
  lat: number | null;
  lon: number | null;
  fotos: string[] | null;
  publico: boolean;
};

function toSpot(r: SpotRow): Spot {
  return {
    id: r.id,
    created_at: r.creado_en,
    nombre: r.nombre,
    description: r.descripcion,
    lat: Number(r.lat),
    lng: Number(r.lon),
    fondo: (r.tipo_fondo ?? 'mixto') as Spot['fondo'],
    profundidad_max: r.profundidad_max === null ? null : Number(r.profundidad_max),
    fotos: r.fotos,
    user_id: r.usuario,
    publico: r.publico,
  };
}

/** Lista de spots ordenada por fecha de creación. */
export function useSpots() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pescasub_spots')
      .select('*')
      .order('creado_en', { ascending: false });
    if (error) setError(error.message);
    else
      setSpots(
        ((data ?? []) as unknown as SpotRow[]).filter((r) => r.lat !== null && r.lon !== null).map(toSpot),
      );
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { spots, loading, error, reload };
}

/** Insertar spot nuevo. */
export async function addSpot(payload: {
  nombre: string;
  description?: string | null;
  lat: number;
  lng: number;
  fondo: Spot['fondo'];
  profundidad_max?: number | null;
  fotos?: string[] | null;
  publico?: boolean;
}): Promise<Spot | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Inicia sesión para añadir un spot');
  const { data, error } = await supabase
    .from('pescasub_spots')
    .insert({
      usuario: auth.user.id,
      nombre: payload.nombre,
      descripcion: payload.description ?? null,
      tipo_fondo: payload.fondo,
      profundidad_max: payload.profundidad_max ?? null,
      // `lat` y `lon` son columnas generadas a partir de `geom`: no se insertan.
      geom: `SRID=4326;POINT(${payload.lng} ${payload.lat})`,
      fotos: payload.fotos ?? null,
      publico: payload.publico ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data ? toSpot(data as unknown as SpotRow) : null;
}

/** Fetch de un spot por id. */
export async function fetchSpot(id: string): Promise<Spot | null> {
  const { data, error } = await supabase.from('pescasub_spots').select('*').eq('id', id).single();
  if (error) return null;
  return data ? toSpot(data as unknown as SpotRow) : null;
}

/* ------------------- Visibilidad, usuarios con acceso y comentarios ------------------- */

/** Cambia un spot a público (lo ve cualquiera) o privado (solo dueño y compartidos). */
export async function setSpotPublico(spotId: string, publico: boolean): Promise<void> {
  const { error } = await supabase.from('pescasub_spots').update({ publico }).eq('id', spotId);
  if (error) throw error;
}

/** Usuarios con los que está compartido un spot (solo lo puede ver su dueño). */
export async function fetchCompartidos(spotId: string): Promise<Compartido[]> {
  const { data, error } = await supabase.from('pescasub_spots_compartidos').select('usuario').eq('spot', spotId);
  if (error || !data?.length) return [];
  const ids = data.map((r: any) => r.usuario as string);
  const { data: perfiles } = await supabase.from('pescasub_perfiles').select('id, nombre, alias, email').in('id', ids);
  const por = new Map((perfiles ?? []).map((p: any) => [p.id as string, p]));
  return ids.map((id) => {
    const p: any = por.get(id);
    return { user_id: id, nombre: p?.alias || p?.nombre || 'Usuario', email: p?.email ?? null };
  });
}

/** Comparte un spot con el usuario que tenga ese email. Devuelve su nombre. */
export async function compartirSpot(spotId: string, email: string): Promise<string> {
  const mail = email.trim().toLowerCase();
  const { data: perfil, error: e1 } = await supabase
    .from('pescasub_perfiles')
    .select('id, nombre, alias')
    .ilike('email', mail)
    .maybeSingle();
  if (e1) throw e1;
  if (!perfil) throw new Error('No hay ningún usuario registrado con ese email.');
  const { data: auth } = await supabase.auth.getUser();
  if (perfil.id === auth.user?.id) throw new Error('Ese eres tú: ya tienes acceso a tu spot.');
  const { error } = await supabase.from('pescasub_spots_compartidos').insert({ spot: spotId, usuario: perfil.id });
  if (error) {
    if ((error as any).code === '23505') throw new Error('Ya está compartido con ese usuario.');
    throw error;
  }
  return (perfil.alias as string) || (perfil.nombre as string);
}

export async function dejarDeCompartir(spotId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('pescasub_spots_compartidos').delete().eq('spot', spotId).eq('usuario', userId);
  if (error) throw error;
}

/** Comentarios de un spot, del más antiguo al más reciente. */
export function useComentarios(spotId: string) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('pescasub_spot_comentarios')
      .select('id, spot, usuario, contenido, creado_en')
      .eq('spot', spotId)
      .order('creado_en', { ascending: true });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const filas = (data ?? []) as any[];
    const ids = [...new Set(filas.map((c) => c.usuario as string))];
    const { data: perfiles } = ids.length
      ? await supabase.from('pescasub_perfiles').select('id, nombre, alias').in('id', ids)
      : { data: [] as any[] };
    const por = new Map((perfiles ?? []).map((p: any) => [p.id as string, p.alias || p.nombre]));
    setComentarios(
      filas.map((c) => ({
        id: c.id,
        spot_id: c.spot,
        user_id: c.usuario,
        autor: por.get(c.usuario) ?? 'Usuario',
        contenido: c.contenido,
        created_at: c.creado_en,
      })),
    );
    setError(null);
    setLoading(false);
  }, [spotId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { comentarios, loading, error, reload };
}

export async function addComentario(spotId: string, contenido: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Inicia sesión para comentar');
  const { error } = await supabase
    .from('pescasub_spot_comentarios')
    .insert({ spot: spotId, usuario: auth.user.id, contenido: contenido.trim() });
  if (error) throw error;
}

export async function deleteComentario(id: string): Promise<void> {
  const { error } = await supabase.from('pescasub_spot_comentarios').delete().eq('id', id);
  if (error) throw error;
}

/* --------------------------------- Capturas --------------------------------- */

/** Fila real de `pescasub_pescas`. */
type PescaRow = {
  id: string;
  usuario: string;
  spot: string | null;
  especie: string;
  peso_kg: number | null;
  longitud_cm: number | null;
  profundidad_captura: number | null;
  fecha: string;
  foto_url: string[] | null;
  notas: string | null;
};

function toCaptura(r: PescaRow): Captura {
  return {
    id: r.id,
    created_at: r.fecha,
    spot_id: r.spot,
    especie: r.especie,
    peso_kg: Number(r.peso_kg ?? 0),
    profundidad_m: Number(r.profundidad_captura ?? 0),
    foto_url: r.foto_url?.[0] ?? null,
    notas: r.notas,
    user_id: r.usuario,
  };
}

/** Lista de capturas, opcionalmente filtradas por spot. */
export function useCapturas(spotId?: string) {
  const [capturas, setCapturas] = useState<Captura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('pescasub_pescas').select('*');
    if (spotId) q = q.eq('spot', spotId);
    const { data, error } = await q.order('fecha', { ascending: false });
    if (error) setError(error.message);
    else setCapturas(((data ?? []) as unknown as PescaRow[]).map(toCaptura));
    setLoading(false);
  }, [spotId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { capturas, loading, error, reload };
}

/** Insertar captura de pesca submarina. */
export async function addCaptura(payload: {
  spot_id?: string | null;
  especie: string;
  peso_kg: number;
  profundidad_m: number;
  foto_url?: string | null;
  notas?: string | null;
}): Promise<Captura | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Inicia sesión para registrar una captura');
  const { data, error } = await supabase
    .from('pescasub_pescas')
    .insert({
      usuario: auth.user.id,
      spot: payload.spot_id ?? null,
      especie: payload.especie,
      peso_kg: payload.peso_kg,
      profundidad_captura: Math.round(payload.profundidad_m),
      foto_url: payload.foto_url ? [payload.foto_url] : null,
      notas: payload.notas ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data ? toCaptura(data as unknown as PescaRow) : null;
}

/** Fetch de capturas filtradas por spot. */
export async function fetchSpotCapturas(spotId: string): Promise<Captura[]> {
  const { data, error } = await supabase
    .from('pescasub_pescas')
    .select('*')
    .eq('spot', spotId)
    .order('fecha', { ascending: false });
  if (error) return [];
  return ((data ?? []) as unknown as PescaRow[]).map(toCaptura);
}

/* ---------------------------------- Fotos ---------------------------------- */

/**
 * Sube una foto al bucket público `fotos-pesca`. Las políticas de Storage exigen que la
 * primera carpeta sea el id del usuario: `<uid>/<carpeta>/<archivo>`. Devuelve la URL pública.
 */
export async function uploadPhoto(uri: string, carpeta: 'capturas' | 'spots'): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const path = `${auth.user.id}/${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage
    .from('fotos-pesca')
    .upload(path, body, { upsert: true, contentType: ext === 'png' ? 'image/png' : 'image/jpeg' });
  if (error) throw error;
  return storageUrl('fotos-pesca', path);
}

/* --------------------------------- Especies --------------------------------- */

/** Catálogo de especies (`pescasub_especies`, cargado desde galiciapesca.com). */
export function useEspecies() {
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pescasub_especies')
      .select('id, slug, nombre, nombre_cientifico, familia, descripcion, talla_minima_cm, imagen_url, url_fuente')
      .order('nombre', { ascending: true })
      .limit(1000);
    if (error) setError(error.message);
    else setEspecies((data ?? []) as unknown as Especie[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { especies, loading, error, reload };
}
