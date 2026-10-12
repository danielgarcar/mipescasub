/**
 * useLocation: permiso + posición actual + watcher opcional.
 */

import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
}

export function useLocation(watch = false) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const locate = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de ubicación denegado. Actívalo en Ajustes para registrar spots y capturas.');
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo obtener la posición.');
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
    } else {
      locate();
    }
    return () => {
      sub?.remove();
    };
  }, [watch, locate]);

  return { coords, error, loading, locate };
}
