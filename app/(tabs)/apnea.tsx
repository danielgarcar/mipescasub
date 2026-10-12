import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Text } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ApneaControls } from '@/components/ApneaControls';
import { palette, card, spacing, radii } from '@/lib/theme';
import { useApneaTimer } from '@/hooks/useApneaTimer';
import { buildCo2Table, buildO2Table, fmtTime } from '@/hooks/useApneaTables';

export default function ApneaScreen() {
  const [tipo, setTipo] = useState<'co2' | 'o2'>('co2');
  const [hold, setHold] = useState(120);
  const [series, setSeries] = useState(8);

  const table = useMemo(
    () => (tipo === 'co2' ? buildCo2Table(hold, series) : buildO2Table(hold, series)),
    [tipo, hold, series]
  );

  const timer = useApneaTimer(table.series);

  const phaseLabel =
    timer.phase === 'prepare' ? 'Preparación'
    : timer.phase === 'apnea' ? 'Apnea'
    : timer.phase === 'done' ? '¡Tabla completada!'
    : 'Listo para empezar';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}>
      {/* Selector de tipo */}
      <View style={styles.segRow}>
        {(['co2', 'o2'] as const).map((k) => (
          <Pressable
            key={k}
            style={[styles.segBtn, tipo === k && styles.segActive]}
            onPress={() => { setTipo(k); timer.stop(); }}
          >
            <Text style={[styles.segText, tipo === k && { color: palette.deep, fontWeight: '700' }]}>
              {k === 'co2' ? 'CO₂' : 'O₂'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Título + descripción */}
      <View style={card}>
        <ThemedText variant="h2">{table.nombre}</ThemedText>
        <ThemedText variant="body">{table.descripcion}</ThemedText>
      </View>

      {/* Timer principal */}
      <View style={styles.timerWrap}>
        <ThemedText variant="small" style={{ color: palette.buoy, letterSpacing: 2, textTransform: 'uppercase' }}>
          {phaseLabel}
        </ThemedText>
        <ThemedText variant="mono" style={{ fontSize: 64 }}>
          {fmtTime(timer.secondsLeft)}
        </ThemedText>
        <ThemedText variant="small">
          Serie {timer.currentSerie || 1} / {timer.totalSeries}
        </ThemedText>
      </View>

      {/* Controles */}
      <ApneaControls t={timer} />

      {/* Ajustes rápidos */}
      <View style={card}>
        <ThemedText variant="h3">Parámetros</ThemedText>
        <View style={styles.paramRow}>
          <ThemedText variant="body">{tipo === 'co2' ? 'Apnea fija' : 'Apnea inicial'}</ThemedText>
          <View style={styles.steps}>
            <Pressable style={styles.stepBtn} onPress={() => setHold((h) => Math.max(30, h - 15))}>
              <Text style={styles.stepText}>−15s</Text>
            </Pressable>
            <ThemedText variant="h3">{fmtTime(hold)}</ThemedText>
            <Pressable style={styles.stepBtn} onPress={() => setHold((h) => Math.min(600, h + 15))}>
              <Text style={styles.stepText}>+15s</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.paramRow}>
          <ThemedText variant="body">Nº de series</ThemedText>
          <View style={styles.steps}>
            <Pressable style={styles.stepBtn} onPress={() => setSeries((s) => Math.max(2, s - 1))}>
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <ThemedText variant="h3">{series}</ThemedText>
            <Pressable style={styles.stepBtn} onPress={() => setSeries((s) => Math.min(16, s + 1))}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Detalle de la tabla */}
      <View style={card}>
        <ThemedText variant="h3">Detalle de la tabla</ThemedText>
        {table.series.map((seg) => (
          <View key={seg.serie} style={styles.segLine}>
            <ThemedText variant="small" style={{ width: 40 }}>#{seg.serie}</ThemedText>
            <ThemedText variant="small" style={{ flex: 1 }}>Apnea {fmtTime(seg.holdSec)}</ThemedText>
            <ThemedText variant="small" style={{ flex: 1 }}>Prep {fmtTime(seg.prepareSec)}</ThemedText>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  segRow: { flexDirection: 'row', borderRadius: radii.pill, borderWidth: 1, borderColor: palette.line, overflow: 'hidden' },
  segBtn: { flex: 1, padding: spacing.s, alignItems: 'center', backgroundColor: palette.surface },
  segActive: { backgroundColor: palette.buoy },
  segText: { color: palette.foam, fontSize: 15, fontWeight: '600' },
  timerWrap: { alignItems: 'center', paddingVertical: spacing.m, gap: 4 },
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.s },
  steps: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  stepBtn: {
    paddingHorizontal: spacing.m, paddingVertical: 6,
    borderRadius: radii.s, backgroundColor: palette.highlight, borderWidth: 1, borderColor: palette.line,
  },
  stepText: { color: palette.foam, fontSize: 14, fontWeight: '600' },
  segLine: { flexDirection: 'row', gap: spacing.s, paddingVertical: 2 },
});
