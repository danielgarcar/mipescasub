/**
 * perez-sub · tipos Database (a mano, basado en las tablas ya existentes)
 * ----------------------------------------------------------------------------
 * Genera tipado para `createClient<Database>(url, key)` de supabase-js.
 *
 * ⚠️  Las tablas pescasub_* YA existen en el proyecto Supabase del usuario; los
 * nombres de columna aquí son una conjetura razonada de nomenclatura
 * Supabase-style (snake_case, created_at/updated_at, *_id FK, PostGIS text
 * para geom). ANTES de usar en producción, regenéralo contra el esquema real:
 *
 *   npx supabase gen types typescript \
 *     --project-id <PROJECT_REF> \
 *     --schema public > supabase/types/database.ts
 *
 * Fuente de las tablas cubiertas (las que nombra el enunciado):
 *   pescasub_perfiles, pescasub_spots, pescasub_pescas, pescasub_apneas,
 *   pescasub_entrenamientos, pescasub_foro_hilos, pescasub_foro_mensajes,
 *   pescasub_metco_chunkvalor, pescasub_progresion
 * Más la de infraestructura nueva: pescasub_meteo_cache (setup.sql, DDL real).
 */

/** Helpers estándar de supabase-gen (equivalentes a los auto-generados) */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      /** Perfil de usuario, 1:1 con auth.users */
      pescasub_perfiles: {
        Row: {
          id: string;                       // uuid = auth.users.id
          username: string | null;
          nombre: string | null;
          apellidos: string | null;
          avatar_url: string | null;
          nivel: string | null;             // 'novato' | 'intermedio' | 'avanzado' | ...
          biografia: string | null;
          created_at: string;               // timestamptz
          updated_at: string | null;
        };
        Insert: {
          id: string;
          username?: string | null;
          nombre?: string | null;
          apellidos?: string | null;
          avatar_url?: string | null;
          nivel?: string | null;
          biografia?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          username?: string | null;
          nombre?: string | null;
          apellidos?: string | null;
          avatar_url?: string | null;
          nivel?: string | null;
          biografia?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pescasub_perfiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      /** Spots de pesca subacuática (coordenadas + meta) */
      pescasub_spots: {
        Row: {
          id: number;                       // bigserial
          nombre: string;
          descripcion: string | null;
          latitud: number | null;           // double precision (o PostGIS en geom — ver nota)
          longitud: number | null;
          /* fallback WKT/GeoJSON si la tabla usa columna geom PostGIS:
             geom: string | null  (format "SRID=4326;POINT(lon lat)")          */
          created_by: string | null;        // uuid → pescasub_perfiles.id
          creado_por: string | null;
          profundidad_max: number | null;   // metros
          corrientes: string | null;
          fondo: string | null;             // 'roca','arena','posidonia',...
          created_at: string;
        };
        Insert: {
          nombre: string;
          descripcion?: string | null;
          latitud?: number | null;
          longitud?: number | null;
          created_by?: string | null;
          creado_por?: string | null;
          profundidad_max?: number | null;
          corrientes?: string | null;
          fondo?: string | null;
        };
        Update: Record<string, unknown> & {
          id?: number;
          nombre?: string;
        };
        Relationships: [];
      };

      /** Une usuarios con spots (favoritos / históricos) */
      pescasub_pescas: {
        Row: {
          id: number;
          perfil_id: string;                // uuid → pescasub_perfiles.id
          spot_id: number | null;           // → pescasub_spots.id
          fecha: string;                    // date
          especie: string | null;
          cantidad: number | null;
          peso_max: number | null;          // kg
          tamano_max: number | null;        // cm
          notas: string | null;
          fotos: string[] | null;           // rutas con nombre en bucket 'fotos-pesca'
          created_at: string;
        };
        Insert: {
          perfil_id: string;
          spot_id?: number | null;
          fecha: string;
          especie?: string | null;
          cantidad?: number | null;
          peso_max?: number | null;
          tamano_max?: number | null;
          notas?: string | null;
          fotos?: string[] | null;
        };
        Update: Record<string, unknown> & { id?: number };
        Relationships: [];
      };

      /** Apneas: tabla de entrenos de respiración (CO2/O2 tables, dinámicas...) */
      pescasub_apneas: {
        Row: {
          id: number;
          perfil_id: string;                // uuid → pescasub_perfiles.id
          tipo: string | null;              // 'estatica' | 'dinamica' | 'co2' | 'o2' | ...
          tiempo_segundos: number | null;   // apnea
          distancia_metros: number | null;  // dinámica
          repeticiones: number | null;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          perfil_id: string;
          tipo?: string | null;
          tiempo_segundos?: number | null;
          distancia_metros?: number | null;
          repeticiones?: number | null;
          notas?: string | null;
        };
        Update: Record<string, unknown> & { id?: number };
        Relationships: [];
      };

      /** Entrenamientos generales (gimnasio, natación, carrera...) */
      pescasub_entrenamientos: {
        Row: {
          id: number;
          perfil_id: string;                // uuid → pescasub_perfiles.id
          fecha: string;                    // date
          tipo: string | null;
          duracion_min: number | null;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          perfil_id: string;
          fecha: string;
          tipo?: string | null;
          duracion_min?: number | null;
          notas?: string | null;
        };
        Update: Record<string, unknown> & { id?: number };
        Relationships: [];
      };

      /** Hilos del foro */
      pescasub_foro_hilos: {
        Row: {
          id: number;
          titulo: string;
          categoria: string | null;
          creado_por: string;               // uuid → pescasub_perfiles.id
          fijado: boolean | null;
          cerrado: boolean | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          titulo: string;
          categoria?: string | null;
          creado_por: string;
          fijado?: boolean | null;
          cerrado?: boolean | null;
        };
        Update: Record<string, unknown> & { id?: number };
        Relationships: [];
      };

      /** Mensajes del foro */
      pescasub_foro_mensajes: {
        Row: {
          id: number;
          hilo_id: number;                  // → pescasub_foro_hilos.id (cascade)
          autor_id: string;                 // uuid → pescasub_perfiles.id
          contenido: string;                // text
          created_at: string;
          edited_at: string | null;
        };
        Insert: {
          hilo_id: number;
          autor_id: string;
          contenido: string;
        };
        Update: Record<string, unknown> & { id?: number };
        Relationships: [
          {
            foreignKeyName: "pescasub_foro_mensajes_hilo_id_fkey";
            columns: ["hilo_id"];
            referencedRelation: "pescasub_foro_hilos";
            referencedColumns: ["id"];
          },
        ];
      };

      /** Tabla técnica de chunks de valores highlights (import METCO) */
      pescasub_metco_chunkvalor: {
        Row: {
          id: number;
          chunk_id: number;                 // FK a la tabla de chunks METCO (no listada)
          variable: string | null;
          valor: number | null;
          fecha: string | null;
          created_at: string;
        };
        Insert: {
          chunk_id: number;
          variable?: string | null;
          valor?: number | null;
          fecha?: string | null;
        };
        Update: Record<string, unknown> & { id?: number };
        Relationships: [];
      };

      /** Progresión del pescador (métricas por fecha / variantes de nivel) */
      pescasub_progresion: {
        Row: {
          id: number;
          perfil_id: string;                // uuid → pescasub_perfiles.id
          fecha: string;                    // date
          metrica: string | null;           // 'tiempo_apnea','peso_total',...
          valor: number | null;
          nivel_alcanzado: string | null;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          perfil_id: string;
          fecha: string;
          metrica?: string | null;
          valor?: number | null;
          nivel_alcanzado?: string | null;
          notas?: string | null;
        };
        Update: Record<string, unknown> & { id?: number };
        Relationships: [];
      };

      /** Caché meteo — DDL real en supabase/setup.sql (NO conjetura) */
      pescasub_meteo_cache: {
        Row: {
          clave: string;                    // PK "lat,lon" a 2 decimales
          latitude: number;
          longitude: number;
          wave_height: number | null;
          sea_surface_temperature: number | null;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          clave: string;
          latitude: number;
          longitude: number;
          wave_height?: number | null;
          sea_surface_temperature?: number | null;
          source?: string;                  // default 'open-meteo-marine'
        };
        Update: {
          clave?: string;
          latitude?: number;
          longitude?: number;
          wave_height?: number | null;
          sea_surface_temperature?: number | null;
          source?: string;
        };
        Relationships: [];
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      /** si el proyecto define un enum de niveles en el esquema, reflejarlo aquí */
      pescasub_nivel:
        | "novato"
        | "intermedio"
        | "avanzado"
        | "experto";
    };
    CompositeTypes: Record<string, never>;
  };
};

/** Tipos de conveniencia para uso directo en la app (supabase-js v2) */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

/** Atajos frecuentes */
export type Perfil = Tables<"pescasub_perfiles">;
export type Spot = Tables<"pescasub_spots">;
export type Pesca = Tables<"pescasub_pescas">;
export type Apnea = Tables<"pescasub_apneas">;
export type Entrenamiento = Tables<"pescasub_entrenamientos">;
export type ForoHilo = Tables<"pescasub_foro_hilos">;
export type ForoMensaje = Tables<"pescasub_foro_mensajes">;
export type MetcoChunkValor = Tables<"pescasub_metco_chunkvalor">;
export type Progresion = Tables<"pescasub_progresion">;
export type MeteoCacheRow = Tables<"pescasub_meteo_cache">;
