/**
 * Mi PescaSub — tipos de dominio (alineados con las tablas pescasub_* de Supabase).
 * Los nombres de columnas pueden requerir ajuste al conectar con tu instancia.
 */

export type SpotFondo =
  | 'roca'
  | 'roca-arena'
  | 'arena'
  | 'posidonia'
  | 'mixto'
  | 'casco-hundimiento';

export interface Spot {
  id: string;
  created_at?: string;
  nombre: string;
  description?: string | null;
  lat: number;
  lng: number;
  fondo: SpotFondo;
  profundidad_max?: number | null; // metros
  fotos?: string[] | null; // URLs de storage
  user_id?: string | null;
  /** true = lo ve cualquiera; false = solo su dueño y los usuarios con los que se comparte. */
  publico?: boolean;
}

/** Comentario de un spot (`pescasub_spot_comentarios`). */
export interface Comentario {
  id: string;
  spot_id: string;
  user_id: string;
  autor: string;
  contenido: string;
  created_at: string;
}

/** Usuario con el que se ha compartido un spot privado. */
export interface Compartido {
  user_id: string;
  nombre: string;
  email: string | null;
}

export interface Captura {
  id: string;
  created_at?: string;
  spot_id?: string | null;
  especie: string;
  peso_kg: number;
  profundidad_m: number;
  foto_url?: string | null;
  notas?: string | null;
  user_id?: string | null;
}

export interface ForoHilo {
  id: string;
  created_at?: string;
  titulo: string;
  contenido: string;
  categoria?: string | null;
  autor?: string | null;
  user_id?: string | null;
  respuestas_count?: number;
}

export interface ForoRespuesta {
  id: string;
  created_at?: string;
  hilo_id: string;
  contenido: string;
  autor?: string | null;
  user_id?: string | null;
}

/** Fila de `pescasub_perfiles` (columnas reales de la BD). */
export interface Perfil {
  id: string; // = auth user id
  nombre: string;
  alias?: string | null;
  club?: string | null;
  nivel_apnea?: string | null;
  foto_url?: string | null;
}

/** Especie del catálogo `pescasub_especies` (fuente: galiciapesca.com/especie/). */
export interface Especie {
  id: string;
  slug: string;
  nombre: string;
  nombre_cientifico?: string | null;
  familia?: string | null;
  descripcion?: string | null;
  talla_minima_cm?: number | null;
  imagen_url?: string | null;
  url_fuente: string;
}

/** Fila de una tabla de entrenamiento (CO2 u O2). */
export interface ApneaSegment {
  /** duración total del segmento en segundos (apnea u oxigenación según fase) */
  holdSec: number;
  /** duración de recuperación en segundos */
  prepareSec: number;
  /** fase: apnea sostenida u oxigenación */
  fase: 'apnea' | 'oxigenacion';
  /** número de serie (1..n) */
  serie: number;
}

export interface ApneaTable {
  tipo: 'co2' | 'o2';
 nombre: string;
  descripcion: string;
  series: ApneaSegment[];
}
