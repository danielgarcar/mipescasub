import { useCallback } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, EmptyState, ErrorState } from '@/components/ui';
import { SalidaCard } from '@/components/SalidaCard';
import { useMisSalidas, useSalidasVisibles } from '@/hooks/useSalidas';
import { palette, spacing } from '@/lib/theme';

/** Pestaña "Salidas": las mías y las de otros pescadores que puedo ver (zona aproximada). */
export function SalidasView() {
  const router = useRouter();
  const mias = useMisSalidas();
  const visibles = useSalidasVisibles();

  // Al volver de crear o cambiar una salida se refresca.
  useFocusEffect(
    useCallback(() => {
      mias.reload();
      visibles.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const otras = visibles.salidas.filter((s) => !s.es_mia);
  const verMapa = (lat: number, lng: number) =>
    router.push({ pathname: '/', params: { lat: String(lat), lng: String(lng) } });

  if (mias.error && visibles.error) return <ErrorState onRetry={() => { mias.reload(); visibles.reload(); }} />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.m, paddingBottom: 40, gap: spacing.m }}>
      <Button label="Planear salida" icon="add" onPress={() => router.push('/salida/new')} />

      <Text style={styles.seccion}>Mis salidas</Text>
      {mias.salidas.length === 0 ? (
        <EmptyState
          icon="boat-outline"
          title="Sin salidas planeadas"
          text="Cuéntale a quien tú elijas dónde, cuándo y con cuánta gente vas a pescar."
        />
      ) : (
        <View style={{ gap: spacing.s }}>
          {mias.salidas.map((s) => (
            <SalidaCard
              key={s.id}
              s={{ ...s, es_mia: true }}
              onPress={() => router.push({ pathname: '/salida/[id]', params: { id: s.id } })}
            />
          ))}
        </View>
      )}

      <Text style={styles.seccion}>Otros pescadores</Text>
      {otras.length === 0 ? (
        <Text style={styles.vacio}>Nadie ha compartido salidas contigo por ahora.</Text>
      ) : (
        <View style={{ gap: spacing.s }}>
          {otras.map((s) => (
            <SalidaCard key={s.id} s={s} onVerMapa={() => verMapa(s.zona_lat, s.zona_lng)} />
          ))}
          <Text style={styles.nota}>De las salidas de otros solo ves una zona aproximada (unos 2 km), nunca el punto exacto.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  seccion: { color: palette.foamSoft, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.s },
  vacio: { color: palette.foamSoft, fontSize: 14 },
  nota: { color: palette.foamSoft, fontSize: 12, lineHeight: 17 },
});
