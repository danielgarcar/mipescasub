import { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useCapturas } from '@/hooks/useSpots';
import { CaptureCard } from '@/components/CaptureCard';
import { StatCard } from '@/components/StatCard';
import { EspeciesList } from '@/components/EspeciesList';
import { EmptyState, ErrorState, Fab, Segmented } from '@/components/ui';
import { ThemedText } from '@/components/ThemedText';
import { palette, spacing } from '@/lib/theme';
import type { Captura } from '@/types';

export default function PescaScreen() {
  const router = useRouter();
  const [vista, setVista] = useState<'capturas' | 'especies'>('capturas');
  const { capturas, loading, error, reload } = useCapturas();

  const total = capturas.length;
  const totalKg = capturas.reduce((acc, c) => acc + (c.peso_kg ?? 0), 0);
  const maxDepth = capturas.reduce((m, c) => Math.max(m, c.profundidad_m ?? 0), 0);

  return (
    <View style={styles.root}>
      <Segmented
        style={styles.seg}
        value={vista}
        onChange={setVista}
        options={[{ key: 'capturas', label: 'Mis capturas' }, { key: 'especies', label: 'Especies' }]}
      />

      {vista === 'especies' ? (
        <EspeciesList />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard label="Capturas" value={total} />
            <StatCard label="Total" value={`${totalKg.toFixed(1)} kg`} />
            <StatCard label="Prof. máx" value={`${maxDepth} m`} />
          </View>

          {error && capturas.length === 0 ? (
            <ErrorState onRetry={reload} />
          ) : !loading && capturas.length === 0 ? (
            <EmptyState
              icon="fish-outline"
              title="Aún no hay capturas"
              text="Registra tu primera pieza con foto, peso y profundidad."
              actionLabel="Registrar captura"
              onAction={() => router.push('/captura/new')}
            />
          ) : (
            <FlatList
              data={capturas}
              keyExtractor={(c: Captura) => c.id}
              contentContainerStyle={{ padding: spacing.m, paddingBottom: 96, gap: spacing.s }}
              refreshing={loading}
              onRefresh={reload}
              ListHeaderComponent={loading && capturas.length === 0 ? <ThemedText variant="body">Cargando…</ThemedText> : null}
              renderItem={({ item }) => <CaptureCard capture={item} />}
            />
          )}

          <Fab label="Registrar captura" onPress={() => router.push('/captura/new')} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  seg: { margin: spacing.m, marginBottom: 0 },
  statsRow: {
    flexDirection: 'row', gap: spacing.s, padding: spacing.m,
    borderBottomWidth: 1, borderBottomColor: palette.line,
  },
});
