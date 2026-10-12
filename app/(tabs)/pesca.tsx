import { useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useCapturas } from '@/hooks/useSpots';
import { CaptureCard } from '@/components/CaptureCard';
import { StatCard } from '@/components/StatCard';
import { EspeciesList } from '@/components/EspeciesList';
import { ThemedText } from '@/components/ThemedText';
import { palette, spacing } from '@/lib/theme';
import type { Captura } from '@/types';

export default function PescaScreen() {
  const router = useRouter();
  const [vista, setVista] = useState<'capturas' | 'especies'>('capturas');
  const { capturas, loading, error } = useCapturas();

  const total = capturas.length;
  const totalKg = capturas.reduce((acc, c) => acc + (c.peso_kg ?? 0), 0);
  const maxDepth = capturas.reduce((m, c) => Math.max(m, c.profundidad_m ?? 0), 0);

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {([['capturas', 'Mis capturas'], ['especies', 'Especies']] as const).map(([k, l]) => (
          <Pressable key={k} style={[styles.tab, vista === k && styles.tabActive]} onPress={() => setVista(k)}>
            <Text style={[styles.tabText, vista === k && styles.tabTextActive]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {vista === 'especies' ? (
        <EspeciesList />
      ) : (
        <>
      <View style={styles.statsRow}>
        <StatCard label="Capturas" value={total} />
        <StatCard label="Total" value={`${totalKg.toFixed(1)} kg`} />
        <StatCard label="Prof. máx" value={`${maxDepth} m`} />
      </View>

      {loading ? (
        <ThemedText variant="body" style={styles.center}>Cargando capturas…</ThemedText>
      ) : error ? (
        <ThemedText variant="body" style={styles.center}>{error}</ThemedText>
      ) : capturas.length === 0 ? (
        <ThemedText variant="body" style={styles.center}>
          Aún no hay capturas registradas. ¡Empieza registrando la primera!
        </ThemedText>
      ) : (
        <FlatList
          data={capturas}
          keyExtractor={(c: Captura) => c.id}
          contentContainerStyle={{ padding: spacing.m, gap: spacing.s }}
          renderItem={({ item }) => <CaptureCard capture={item} />}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/captura/new')}
        accessibilityLabel="Registrar captura"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  tabs: { flexDirection: 'row', gap: spacing.s, padding: spacing.m, paddingBottom: 0 },
  tab: { paddingVertical: 6, paddingHorizontal: spacing.m, borderRadius: 999, borderWidth: 1, borderColor: palette.line },
  tabActive: { backgroundColor: palette.coral, borderColor: palette.coral },
  tabText: { color: palette.foamSoft, fontWeight: '600' },
  tabTextActive: { color: palette.foam },
  statsRow: {
    flexDirection: 'row', gap: spacing.s, padding: spacing.m,
    borderBottomWidth: 1, borderBottomColor: palette.line,
  },
  center: { textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.l },
  fab: {
    position: 'absolute', right: spacing.m, bottom: spacing.m + 60,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: palette.coral, alignItems: 'center', justifyContent: 'center',
  },
  fabText: { color: palette.foam, fontSize: 28, fontWeight: '700' },
});
