/**
 * Cliente Supabase centralizado para Mi PescaSub.
 *
 * Lee las variables de entorno Expo (definidas en .env, ver .env.example):
 *   - EXPO_PUBLIC_SUPA_URL   -> URL del proyecto (placeholder https://TU-PROYECTO.supabase.co)
 *   - EXPO_PUBLIC_SUPA_ANON  -> anon key pública
 *
 * NO hardcodear credenciales: siempre EXPO_PUBLIC_* para que Metro las inyecte.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPA_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPA_ANON ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Fallar suave durante el desarrollo si faltan las env:
  console.warn(
    '[perez-sub] Faltan EXPO_PUBLIC_SUPA_URL / EXPO_PUBLIC_SUPA_ANON en .env. ' +
      'Copia .env.example a .env y completa la URL y la anon key de tu proyecto Supabase.'
  );
}

// En el render estático/SSR de web (Node) no existe `window` y AsyncStorage
// revienta con "window is not defined"; allí no persistimos sesión.
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: !isSSR,
    autoRefreshToken: !isSSR,
    // En web, los enlaces del email (recuperar contraseña, confirmar cuenta) traen la sesión en la URL.
    detectSessionInUrl: Platform.OS === 'web' && !isSSR,
    ...(isSSR ? {} : { storage: AsyncStorage }),
  },
});

/** Helper para construir URLs de Storage con bucket + path. */
export function storageUrl(bucket: string, path: string, options?: { transform?: number }) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const url = data.publicUrl;
  if (options?.transform) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}width=${options.transform}&quality=70&resize=contain`;
  }
  return url;
}

/**
 * Edge function real desplegada (MBAR24 IHM, 16 m): sirve las teselas de
 * batimetría de la Ría de Pontevedra/Vigo (z 8..17) desde Storage.
 */
export const BATHYMETRY_TILE_HOST =
  'https://nuqfiwtcoeeutnnjslty.supabase.co/functions/v1/pescasub-tiles';

// La edge espera .png FINAL del path; el UrlTemplate de react-native-maps no
// añade extensión, por eso tilesOficial escribe {z}/{x}/{y}.png.
export function tilesOficial(z: number, x: number, y: number): string {
  return `https://nuqfiwtcoeeutnnjslty.supabase.co/functions/v1/pescasub-tiles/${z}/${x}/${y}.png`;
}

/** true si la página se abrió desde el enlace de "recuperar contraseña" (solo web). */
export const abiertoDesdeRecuperacion =
  Platform.OS === 'web' && typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);
