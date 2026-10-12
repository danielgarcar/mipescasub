/**
 * hook de autenticación Supabase (email + contraseña).
 *
 * También guarda si el usuario llegó desde el enlace de "recuperar contraseña": mientras eso
 * ocurra debe elegir una contraseña nueva antes de entrar a la app.
 */

import { useEffect, useState, useCallback } from 'react';
import { abiertoDesdeRecuperacion, supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Estado de recuperación compartido por todos los componentes que usan el hook.
let recuperando = abiertoDesdeRecuperacion;
const oyentes = new Set<(v: boolean) => void>();
const fijarRecuperando = (v: boolean) => {
  recuperando = v;
  oyentes.forEach((f) => f(v));
};

/** Termina el modo de recuperación (tras guardar la contraseña nueva) y limpia la URL. */
export function terminarRecuperacion() {
  if (typeof window !== 'undefined' && window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  fijarRecuperando(false);
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(recuperando);

  useEffect(() => {
    oyentes.add(setRecovery);
    setRecovery(recuperando);
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (event === 'PASSWORD_RECOVERY') fijarRecuperando(true);
    });
    return () => {
      oyentes.delete(setRecovery);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    return supabase.auth.signUp({ email, password });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { session, loading, recovery, signUp, signIn, signOut, user: session?.user ?? null };
}
