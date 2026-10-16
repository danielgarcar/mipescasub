import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { ampliarHora, cambiarEstado, estadoVisible, fmtDiaHora } from '@/hooks/useSalidas';
import { ThemedText } from '@/components/ThemedText';
import { Badge, Button, ErrorState } from '@/components/ui';
import { card, palette, radii, spacing } from '@/lib/theme';
import type { Salida } from '@/types';

const VIS_TXT = { privada: 'Solo tú', usuarios: 'Usuarios elegidos', publica: 'Todos (zona aproximada)' } as const;

/** Seguimiento de mi salida: entrar al agua, salir y ampliar la hora de vuelta. */
export default function SalidaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [s, setS] = useState<Salida | null>(null);
  const [nombres, setNombres] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const { data, error } = await supabase.from('pescasub_salidas').select('*').eq('id', id).single();
    if (error || !data) return setError(true);
    const r = data as any;
    setS({
      id: r.id, spot_id: r.spot, lat: r.lat, lng: r.lon, inicio: r.inicio, fin_previsto: r.fin_previsto,
      salida_real: r.salida_real, estado: r.estado, visibilidad: r.visibilidad, personas: r.personas, notas: r.notas,
    });
    if (r.visibilidad === 'usuarios') {
      const { data: us } = await supabase.from('pescasub_salidas_usuarios').select('usuario').eq('salida', id);
      const ids = (us ?? []).map((u: any) => u.usuario as string);
      if (ids.length) {
        const { data: ps } = await supabase.from('pescasub_perfiles').select('id, nombre, alias').in('id', ids);
        setNombres((ps ?? []).map((p: any) => p.alias || p.nombre));
      }
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const accion = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch {
      Alert.alert('No se pudo actualizar', 'Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const cancelar = () =>
    Alert.alert('¿Cancelar la salida?', 'Dejará de ser visible para los demás.', [
      { text: 'Mantener', style: 'cancel' },
      { text: 'Cancelar salida', style: 'destructive', onPress: () => accion(() => cambiarEstado(s!.id, 'cancelada')) },
    ]);

  const revisarEquipo = (fase: 'salir' | 'volver') =>
    router.push({ pathname: '/(tabs)/pesca', params: { vista: 'equipo', fase } });

  if (error) return <ErrorState onRetry={load} />;
  if (!s) return null;

  const est = estadoVisible(s);
  const terminada = s.estado === 'fuera' || s.estado === 'cancelada';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing.m, gap: spacing.m, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: 'Mi salida' }} />

      <View style={[card, { gap: spacing.s }]}>
        <View style={styles.cab}>
          <Ionicons name="boat-outline" size={26} color={palette.buoy} />
          <ThemedText variant="h2" style={{ flex: 1 }}>
            {s.estado === 'fuera' ? 'Salida terminada' : s.estado === 'cancelada' ? 'Salida cancelada' : est.texto}
          </ThemedText>
          {!terminada && <Badge text={est.texto} tone={est.tono} />}
        </View>
        <Fila k="Salida" v={fmtDiaHora(s.inicio)} />
        <Fila k="Vuelta prevista" v={fmtDiaHora(s.fin_previsto)} />
        {s.salida_real && <Fila k="Saliste del agua" v={fmtDiaHora(s.salida_real)} />}
        <Fila k="Personas" v={String(s.personas)} />
        <Fila k="Visible para" v={VIS_TXT[s.visibilidad]} />
        {nombres.length > 0 && <Fila k="Usuarios" v={nombres.join(', ')} />}
        {!!s.notas && <Fila k="Notas" v={s.notas} />}
      </View>

      {s.estado === 'planeada' && (
        <>
          <Button label="Revisar equipo antes de salir" icon="clipboard-outline" variant="secondary" onPress={() => revisarEquipo('salir')} />
          <Button label="Entro al agua" icon="water" onPress={() => accion(() => cambiarEstado(s.id, 'en_agua'))} loading={busy} />
          <Button label="Cancelar salida" variant="danger" onPress={cancelar} />
        </>
      )}

      {s.estado === 'en_agua' && (
        <>
          <Button label="Ya estoy fuera" icon="checkmark-circle" onPress={() => accion(() => cambiarEstado(s.id, 'fuera'))} loading={busy} style={{ minHeight: 60 }} />
          <Button
            label="Necesito 30 min más"
            icon="time-outline"
            variant="secondary"
            onPress={() => accion(() => ampliarHora(s.id, s.fin_previsto, 30))}
          />
          <ThemedText variant="small">
            Pulsa "Ya estoy fuera" al terminar. Quienes ven tu salida sabrán que has vuelto. No se envía ningún aviso automático.
          </ThemedText>
        </>
      )}

      {terminada && (
        <>
          {s.estado === 'fuera' && (
            <Button label="Revisar equipo al volver" icon="clipboard-outline" onPress={() => revisarEquipo('volver')} />
          )}
          <Button label="Volver" variant="ghost" onPress={() => router.back()} />
        </>
      )}
    </ScrollView>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  cab: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  fila: { flexDirection: 'row', gap: spacing.s, paddingVertical: 2 },
  k: { color: palette.foamSoft, width: 120, fontSize: 15 },
  v: { color: palette.foam, flex: 1, fontSize: 15, borderRadius: radii.s },
});
