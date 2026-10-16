/**
 * Equipo del pescador y checklist de salida/regreso.
 *
 * - El equipo vive en Supabase (`pescasub_equipo`) y se cachea en el dispositivo: el checklist se usa
 *   en el aparcamiento, a menudo sin cobertura, así que se puede LEER y MARCAR sin conexión.
 *   (Añadir o borrar piezas sí requiere conexión.)
 * - Las casillas marcadas se guardan solo en el dispositivo.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { CategoriaEquipo, Equipo } from '@/types';

const KEY_CACHE = 'mipescasub.equipo.cache.v1';
const KEY_CHECK = 'mipescasub.equipo.check.v1';

export type Fase = 'salir' | 'volver';

export const CATEGORIAS: { key: CategoriaEquipo; label: string }[] = [
  { key: 'traje', label: 'Traje' },
  { key: 'pesca', label: 'Pesca' },
  { key: 'seguridad', label: 'Seguridad' },
  { key: 'barco', label: 'Barco / costa' },
  { key: 'otros', label: 'Otros' },
];

/** Equipo típico para empezar sin teclear. */
export const EQUIPO_BASICO: { nombre: string; categoria: CategoriaEquipo }[] = [
  { nombre: 'Traje', categoria: 'traje' },
  { nombre: 'Escarpines y guantes', categoria: 'traje' },
  { nombre: 'Capucha', categoria: 'traje' },
  { nombre: 'Máscara y tubo', categoria: 'pesca' },
  { nombre: 'Aletas', categoria: 'pesca' },
  { nombre: 'Fusil', categoria: 'pesca' },
  { nombre: 'Cinturón y plomos', categoria: 'pesca' },
  { nombre: 'Cuchillo', categoria: 'seguridad' },
  { nombre: 'Boya con banderín', categoria: 'seguridad' },
  { nombre: 'Silbato', categoria: 'seguridad' },
  { nombre: 'Botiquín', categoria: 'seguridad' },
  { nombre: 'Licencia y seguro', categoria: 'otros' },
];

type Row = { id: string; nombre: string; categoria: CategoriaEquipo; nota: string | null; caduca: string | null };
const toEquipo = (r: Row): Equipo => ({ id: r.id, nombre: r.nombre, categoria: r.categoria, nota: r.nota, caduca: r.caduca });

export function useEquipo() {
  const [items, setItems] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pescasub_equipo')
      .select('id, nombre, categoria, nota, caduca')
      .order('creado_en', { ascending: true });
    if (error) {
      // Sin conexión: se usa la última copia guardada.
      setOffline(true);
      try {
        const raw = await AsyncStorage.getItem(KEY_CACHE);
        if (raw) setItems(JSON.parse(raw) as Equipo[]);
      } catch {
        /* sin caché */
      }
    } else {
      setOffline(false);
      const lista = ((data ?? []) as unknown as Row[]).map(toEquipo);
      setItems(lista);
      AsyncStorage.setItem(KEY_CACHE, JSON.stringify(lista)).catch(() => {});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const add = useCallback(
    async (p: { nombre: string; categoria: CategoriaEquipo; caduca?: string | null; nota?: string | null }) => {
      const { error } = await supabase.from('pescasub_equipo').insert({
        nombre: p.nombre.trim(),
        categoria: p.categoria,
        caduca: p.caduca || null,
        nota: p.nota?.trim() || null,
      });
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  const addMany = useCallback(
    async (lista: { nombre: string; categoria: CategoriaEquipo }[]) => {
      const { error } = await supabase.from('pescasub_equipo').insert(lista);
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, p: { nombre: string; categoria: CategoriaEquipo; caduca?: string | null }) => {
      const { error } = await supabase
        .from('pescasub_equipo')
        .update({ nombre: p.nombre.trim(), categoria: p.categoria, caduca: p.caduca || null })
        .eq('id', id);
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('pescasub_equipo').delete().eq('id', id);
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  return { items, loading, offline, reload, add, addMany, update, remove };
}

/** Casillas marcadas por fase ('salir' / 'volver'), persistidas en el dispositivo. */
export function useChecklist() {
  const [marcados, setMarcados] = useState<Record<Fase, string[]>>({ salir: [], volver: [] });

  useEffect(() => {
    AsyncStorage.getItem(KEY_CHECK)
      .then((raw) => raw && setMarcados(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const guardar = (m: Record<Fase, string[]>) => {
    setMarcados(m);
    AsyncStorage.setItem(KEY_CHECK, JSON.stringify(m)).catch(() => {});
  };

  const toggle = useCallback(
    (fase: Fase, id: string) => {
      const actual = marcados[fase];
      guardar({ ...marcados, [fase]: actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id] });
    },
    [marcados],
  );

  const reiniciar = useCallback(
    (fase: Fase) => guardar({ ...marcados, [fase]: [] }),
    [marcados],
  );

  return { marcados, toggle, reiniciar };
}

/** Días hasta la caducidad (negativo = vencido); null si no hay fecha. */
export function diasParaCaducar(caduca?: string | null): number | null {
  if (!caduca) return null;
  const d = new Date(caduca + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}
