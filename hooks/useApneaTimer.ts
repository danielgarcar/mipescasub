/**
 * useApneaTimer: máquina de estados de una tabla de apnea (CO2 u O2).
 *
 * Estados: 'idle' | 'prepare' (oxigenación / respiración) | 'apnea' (hold) | 'done'
 * Marca de Elliott Haptics mediante expo-haptics en transición de fase.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

export type ApneaPhase = 'idle' | 'prepare' | 'apnea' | 'done';

export interface TableState {
  phase: ApneaPhase;
  currentSerie: number;
  totalSeries: number;
  /** segundos restantes de la fase actual */
  secondsLeft: number;
  /** duración total de la fase actual (para barras de progreso) */
  phaseTotal: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skip: () => void;
}

function buzz(kind: 'start' | 'change' | 'end') {
  if (Platform.OS === 'web') return;
  if (kind === 'change') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } else if (kind === 'end') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
}

function say(text: string) {
  if (Platform.OS === 'web') return;
  Speech.stop();
  Speech.speak(text, { language: 'es-ES', rate: 1.05 });
}

export function useApneaTimer(
  segments: { holdSec: number; prepareSec: number; fase: 'apnea' | 'oxigenacion' }[],
  /** Voz y cuenta atrás hablada (la vibración siempre se mantiene). */
  voice = true,
): TableState {
  const [phase, setPhase] = useState<ApneaPhase>('idle');
  const [currentSerie, setCurrentSerie] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [phaseTotal, setPhaseTotal] = useState(0);

  // Guardamos la serie activa y su fase para no leer el índice fuera de rango en el interval.
  const segRef = useRef<number>(0); // 0-based index into segments
  const halfRef = useRef<'prepare' | 'apnea'>('prepare');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clear();
    setPhase('idle');
    setCurrentSerie(0);
    setSecondsLeft(0);
    setIsRunning(false);
    segRef.current = 0;
    halfRef.current = 'prepare';
  }, [clear]);

  const finish = useCallback(() => {
    clear();
    setPhase('done');
    setIsRunning(false);
    setSecondsLeft(0);
    buzz('end');
  }, [clear]);

  const beginSegment = useCallback(
    (segIndex: number, half: 'prepare' | 'apnea') => {
      const seg = segments[segIndex];
      if (!seg) {
        finish();
        return;
      }
      const dur = half === 'prepare' ? seg.prepareSec : seg.holdSec;
      halfRef.current = half;
      segRef.current = segIndex;
      setPhase(half === 'prepare' ? 'prepare' : 'apnea');
      setSecondsLeft(dur);
      setPhaseTotal(dur);
      if (half === 'apnea') setCurrentSerie(segIndex + 1);
      buzz('change');
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            // fin de mitad — pasar a la otra mitad o a la siguiente serie
            const next: 'prepare' | 'apnea' = halfRef.current === 'apnea' ? 'prepare' : 'apnea';
            const nextSeg = next === 'prepare' ? segRef.current + 1 : segRef.current;
            if (nextSeg >= segments.length) {
              finish();
              return 0;
            }
            beginSegment(nextSeg, next);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    },
    [segments, finish]
  );

  const start = useCallback(() => {
    if (segments.length === 0) return;
    stop();
    setIsRunning(true);
    beginSegment(0, 'prepare');
  }, [beginSegment, stop, segments.length]);

  const pause = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (isRunning || phase === 'idle' || phase === 'done') return;
    setIsRunning(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          const next: 'prepare' | 'apnea' = halfRef.current === 'apnea' ? 'prepare' : 'apnea';
          const nextSeg = next === 'prepare' ? segRef.current + 1 : segRef.current;
          if (nextSeg >= segments.length) {
            finish();
            return 0;
          }
          beginSegment(nextSeg, next);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [isRunning, phase, finish, beginSegment]);

  const skip = useCallback(() => {
    if (phase === 'idle' || phase === 'done') return;
    const next: 'prepare' | 'apnea' = halfRef.current === 'apnea' ? 'prepare' : 'apnea';
    const nextSeg = next === 'prepare' ? segRef.current + 1 : segRef.current;
    if (nextSeg >= segments.length) {
      finish();
    } else {
      beginSegment(nextSeg, next);
    }
  }, [phase, finish, beginSegment]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      Speech.stop();
    };
  }, []);

  // Avisos de cambio de fase (para quien entrena con los ojos cerrados).
  useEffect(() => {
    if (!voice) return;
    if (phase === 'prepare') say('Respira');
    else if (phase === 'apnea') say('Apnea');
    else if (phase === 'done') say('Tabla completada');
  }, [phase, currentSerie, voice]);

  // Cuenta atrás: 10 s (solo en apnea) y 3-2-1 con vibración corta.
  useEffect(() => {
    if (!isRunning) return;
    if (secondsLeft >= 1 && secondsLeft <= 3) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (voice) say(String(secondsLeft));
    } else if (secondsLeft === 10 && voice) {
      say('Diez segundos');
    }
  }, [secondsLeft, isRunning, voice]);

  return { phase, currentSerie, totalSeries: segments.length, secondsLeft, phaseTotal, isRunning, start, pause, resume, stop, skip };
}
