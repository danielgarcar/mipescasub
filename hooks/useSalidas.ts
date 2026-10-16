/**
 * Salidas de pesca: planear, cambiar de estado y ver las de otros pescadores.
 *
 * Privacidad: el punto exacto solo existe en `pescasub_salidas` (visible solo para su dueño). Los demás
 * reciben la zona aproximada por la función `pescasub_salidas_visibles()`. No se envía ningún aviso
 * (correo/SMS): quien tiene acceso lo ve dentro de la app.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { EstadoSalida, Salida, SalidaVisible, VisibilidadSalida } from '@/types';

type SalidaRow = {
  id: string; spot: string | null; lat: number; lon: number; inicio: string; fin_previsto: string;
  salida_real: string | null; estado: EstadoSalida; visibilidad: VisibilidadSalida; personas: number; notas: string | null;
};
const toSalida = (r: SalidaRow): Salida => ({
  id: r.id, spot_id: r.spot, lat: r.lat, lng: r.lon, inicio: r.inicio, fin_previsto: r.fin_previsto,
  salida_real: r.salida_real, estado: r.estado, visibilidad: r.visibilidad, personas: r.personas, notas: r.notas,
});

/** Mis salidas activas (planeadas o en el agua), con el punto exacto. */
export function useMisSalidas() {
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pescasub_salidas')
      .select('*')
      .in('estado', ['planeada', 'en_agua'])
      .order('inicio', { ascending: true });
    setError(!!error);
    if (!error) setSalidas(((data ?? []) as unknown as SalidaRow[]).map(toSalida));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { salidas, loading, error, reload };
}

/** Salidas que puedo ver (mías, de usuarios que las comparten conmigo y públicas), con zona aproximada. */
export function useSalidasVisibles() {
  const [salidas, setSalidas] = useState<SalidaVisible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('pescasub_salidas_visibles');
    setError(!!error);
    if (!error) setSalidas((data ?? []) as SalidaVisible[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { salidas, loading, error, reload };
}

export async function crearSalida(p: {
  spot_id?: string | null; lat: number; lng: number; inicio: Date; fin_previsto: Date;
  visibilidad: VisibilidadSalida; personas: number; notas?: string | null; usuarios: string[];
}): Promise<string> {
  const { data, error } = await supabase
    .from('pescasub_salidas')
    .insert({
      spot: p.spot_id ?? null,
      lat: p.lat,
      lon: p.lng,
      inicio: p.inicio.toISOString(),
      fin_previsto: p.fin_previsto.toISOString(),
      visibilidad: p.visibilidad,
      personas: p.personas,
      notas: p.notas?.trim() || null,
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('No se pudo crear la salida.');
  if (p.visibilidad === 'usuarios' && p.usuarios.length > 0) {
    const { error: e2 } = await supabase
      .from('pescasub_salidas_usuarios')
      .insert(p.usuarios.map((usuario) => ({ salida: data.id, usuario })));
    if (e2) throw e2;
  }
  return data.id as string;
}

/** Entrar al agua / salir / cancelar. "Salir" guarda la hora real. */
export async function cambiarEstado(id: string, estado: EstadoSalida): Promise<void> {
  const cambios: Record<string, unknown> = { estado };
  if (estado === 'fuera') cambios.salida_real = new Date().toISOString();
  const { error } = await supabase.from('pescasub_salidas').update(cambios).eq('id', id);
  if (error) throw error;
}

/** Amplía la hora prevista de vuelta (p. ej. +30 min) sin cambiar nada más. */
export async function ampliarHora(id: string, finActual: string, minutos: number): Promise<void> {
  const fin = new Date(new Date(finActual).getTime() + minutos * 60_000).toISOString();
  const { error } = await supabase.from('pescasub_salidas').update({ fin_previsto: fin }).eq('id', id);
  if (error) throw error;
}

/** Busca un usuario por email para compartir una salida con él. */
export async function buscarUsuario(email: string): Promise<{ id: string; nombre: string }> {
  const mail = email.trim().toLowerCase();
  const { data: perfil, error } = await supabase
    .from('pescasub_perfiles')
    .select('id, nombre, alias')
    .ilike('email', mail)
    .maybeSingle();
  if (error) throw error;
  if (!perfil) throw new Error('No hay ningún usuario registrado con ese email.');
  const { data: auth } = await supabase.auth.getUser();
  if (perfil.id === auth.user?.id) throw new Error('Ese eres tú.');
  return { id: perfil.id as string, nombre: ((perfil.alias as string) || (perfil.nombre as string)) ?? 'Usuario' };
}

/* ---------- utilidades de presentación ---------- */

export function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDiaHora(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const manana = new Date(Date.now() + 86_400_000);
  const dia =
    d.toDateString() === hoy.toDateString() ? 'Hoy'
    : d.toDateString() === manana.toDateString() ? 'Mañana'
    : d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${dia} ${fmtHora(iso)}`;
}

/** Texto de estado que ven los demás; "retrasada" se calcula (no hay avisos automáticos). */
export function estadoVisible(s: { estado: EstadoSalida; inicio: string; fin_previsto: string }): {
  texto: string; tono: 'ok' | 'info' | 'warn';
} {
  const ahora = Date.now();
  if (s.estado === 'en_agua') {
    return ahora > new Date(s.fin_previsto).getTime()
      ? { texto: 'En el agua · pasada la hora de vuelta', tono: 'warn' }
      : { texto: 'En el agua', tono: 'ok' };
  }
  return ahora > new Date(s.inicio).getTime()
    ? { texto: 'Debería haber salido', tono: 'info' }
    : { texto: 'Planeada', tono: 'info' };
}
