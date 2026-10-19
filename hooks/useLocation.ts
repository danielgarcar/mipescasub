/**
 * useLocation: permiso + posición actual + watcher opcional.
 */

import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
}

/** `auto = false`: no pide permiso ni posición al montar; solo cuando se llama a `locate()`. */
export function useLocation(watch = false, auto = true) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(auto);

  const locate = useCallback(async (): Promise<Coords | null> => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de ubicación denegado. Actívalo en Ajustes para registrar spots y capturas.');
        setLoading(false);
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCoords(c);
      setError(null);
      return c;
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo obtener la posición.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let sub: { remove(): void } | null = null;
    if (watch) {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          sub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
            (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
          );
        } else {
          setError('Permiso de ubicación denegado.');
          setLoading(false);
        }
      })();
    } else if (auto) {
      locate();
    }
    return () => {
      sub?.remove();
    };
  }, [watch, auto, locate]);

  return { coords, error, loading, locate };
}
