import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ThemedText } from '@/components/ThemedText';
import { ApneaControls } from '@/components/ApneaControls';
import { Button, IconButton, Segmented } from '@/components/ui';
import { Alert } from '@/lib/alert';
import { color, palette, card, spacing, radii } from '@/lib/theme';
import { useApneaTimer } from '@/hooks/useApneaTimer';
import { buildCo2Table, buildO2Table, fmtTime } from '@/hooks/useApneaTables';

const KEY_AVISO = 'mipescasub.apnea.aviso.v1';
const KEEP_AWAKE_TAG = 'apnea-timer';

export default function ApneaScreen() {
  const [tipo, setTipo] = useState<'co2' | 'o2'>('co2');
  const [hold, setHold] = useState(120);
  const [series, setSeries] = useState(8);
  const [voz, setVoz] = useState(true);
  const [avisoVisto, setAvisoVisto] = useState(true); // true hasta leer el almacenamiento, para no parpadear

  useEffect(() => {
    AsyncStorage.getItem(KEY_AVISO)
      .then((v) => setAvisoVisto(v === '1'))
      .catch(() => setAvisoVisto(false));
  }, []);

  const table = useMemo(
    () => (tipo === 'co2' ? buildCo2Table(hold, series) : buildO2Table(hold, series)),
    [tipo, hold, series]
  );

  const timer = useApneaTimer(table.series, voz);
  const activa = timer.phase === 'prepare' || timer.phase === 'apnea';

  // La pantalla no se apaga mientras hay una sesión en marcha.
  useEffect(() => {
    if (timer.isRunning) activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    else deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [timer.isRunning]);

  const cambiarTipo = (k: 'co2' | 'o2') => {
    if (k === tipo) return;
    if (!activa) return setTipo(k);
    Alert.alert('¿Cambiar de tabla?', 'La sesión en curso se detendrá.', [
      { text: 'Seguir con la sesión', style: 'cancel' },
      { text: 'Cambiar', style: 'destructive', onPress: () => { timer.stop(); setTipo(k); } },
    ]);
  };

  const aceptarAviso = () => {
    setAvisoVisto(true);
    AsyncStorage.setItem(KEY_AVISO, '1').catch(() => {});
  };

  const phaseLabel =
    timer.phase === 'prepare' ? 'Respira'
    : timer.phase === 'apnea' ? 'Apnea'
    : timer.phase === 'done' ? '¡Tabla completada!'
    : 'Listo para empezar';
  const phaseColor = timer.phase === 'apnea' ? color.accent : timer.phase === 'prepare' ? color.ok : color.textMuted;
  const progreso = timer.phaseTotal > 0 ? 1 - timer.secondsLeft / timer.phaseTotal : 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}>
      <Segmented
        value={tipo}
        onChange={cambiarTipo}
        options={[{ key: 'co2', label: 'CO₂' }, { key: 'o2', label: 'O₂' }]}
      />

      {/* Timer principal */}
      <View style={styles.timerWrap} accessibilityLiveRegion="polite">
        <Text style={[styles.phase, { color: phaseColor }]}>{phaseLabel}</Text>
        <ThemedText
          variant="mono"
          style={{ fontSize: 72 }}
          accessibilityLabel={`${timer.secondsLeft} segundos`}
        >
          {fmtTime(timer.secondsLeft)}
        </ThemedText>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${Math.round(progreso * 100)}%`, backgroundColor: phaseColor }]} />
        </View>
        <ThemedText variant="small">
          Serie {timer.currentSerie || 1} / {timer.totalSeries}
        </ThemedText>
      </View>

      <ApneaControls t={timer} />

      <View style={styles.vozRow}>
        <IconButton
          icon={voz ? 'volume-high' : 'volume-mute'}
          label={voz ? 'Desactivar voz' : 'Activar voz'}
          onPress={() => setVoz((v) => !v)}
          size={44}
          active={voz}
        />
        <ThemedText variant="small" style={{ flex: 1 }}>
          {voz ? 'Voz y cuenta atrás activadas' : 'Solo vibración'}
        </ThemedText>
      </View>

      {/* Recordatorio de seguridad siempre visible */}
      <View style={styles.safety}>
        <Ionicons name="warning" size={18} color={color.warn} />
        <ThemedText variant="small" style={{ flex: 1, color: palette.foam }}>
          Entrena en seco, sentado o tumbado y acompañado. Nunca en el agua ni conduciendo.
        </ThemedText>
      </View>

      <View style={card}>
        <ThemedText variant="h3">{table.nombre}</ThemedText>
        <ThemedText variant="body">{table.descripcion}</ThemedText>
      </View>

      {/* Ajustes: se bloquean mientras hay sesión */}
      <View style={[card, activa && { opacity: 0.5 }]}>
        <ThemedText variant="h3">Parámetros</ThemedText>
        <Stepper
          label={tipo === 'co2' ? 'Apnea fija' : 'Respiración fija'}
          value={fmtTime(hold)}
          disabled={activa}
          onMinus={() => setHold((h) => Math.max(30, h - 15))}
          onPlus={() => setHold((h) => Math.min(600, h + 15))}
          minusLabel="Menos 15 segundos"
          plusLabel="Más 15 segundos"
        />
        <Stepper
          label="Nº de series"
          value={String(series)}
          disabled={activa}
          onMinus={() => setSeries((s) => Math.max(2, s - 1))}
          onPlus={() => setSeries((s) => Math.min(16, s + 1))}
          minusLabel="Una serie menos"
          plusLabel="Una serie más"
        />
      </View>

      {/* Detalle de la tabla con la serie actual resaltada */}
      <View style={card}>
        <ThemedText variant="h3">Detalle de la tabla</ThemedText>
        {table.series.map((seg) => {
          const serieActiva = timer.phase === 'apnea' ? timer.currentSerie : timer.currentSerie + 1;
          const actual = activa && seg.serie === serieActiva;
          const c = actual ? palette.foam : palette.foamSoft;
          return (
            <View key={seg.serie} style={[styles.segLine, actual && styles.segActual]}>
              <ThemedText variant="small" style={{ width: 40, color: c }}>#{seg.serie}</ThemedText>
              <ThemedText variant="small" style={{ flex: 1, color: c }}>Respira {fmtTime(seg.prepareSec)}</ThemedText>
              <ThemedText variant="small" style={{ flex: 1, color: c }}>Apnea {fmtTime(seg.holdSec)}</ThemedText>
            </View>
          );
        })}
      </View>

      <Modal visible={!avisoVisto} transparent animationType="fade" onRequestClose={aceptarAviso}>
        <View style={styles.backdrop}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <Ionicons name="warning" size={32} color={color.warn} />
            <ThemedText variant="h2">Antes de empezar</ThemedText>
            <ThemedText variant="body">
              Las tablas de apnea pueden provocar pérdida de conocimiento sin aviso.
            </ThemedText>
            <ThemedText variant="body">• Practícalas siempre en seco: sentado o tumbado.</ThemedText>
            <ThemedText variant="body">• Nunca en el agua, en la bañera, ni conduciendo.</ThemedText>
            <ThemedText variant="body">• No hiperventiles antes de empezar.</ThemedText>
            <ThemedText variant="body">• Mejor con compañía. Si notas mareo o malestar, termina.</ThemedText>
            <Button label="Entendido" onPress={aceptarAviso} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Stepper({
  label, value, onMinus, onPlus, disabled, minusLabel, plusLabel,
}: {
  label: string; value: string; onMinus: () => void; onPlus: () => void; disabled?: boolean; minusLabel: string; plusLabel: string;
}) {
  return (
    <View style={styles.paramRow}>
      <ThemedText variant="body" style={{ flex: 1 }}>{label}</ThemedText>
      <View style={styles.steps}>
        <IconButton icon="remove" label={minusLabel} onPress={disabled ? () => {} : onMinus} size={44} />
        <ThemedText variant="h2" style={{ minWidth: 52, textAlign: 'center' }}>{value}</ThemedText>
        <IconButton icon="add" label={plusLabel} onPress={disabled ? () => {} : onPlus} size={44} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  timerWrap: { alignItems: 'center', paddingVertical: spacing.m, gap: 6 },
  phase: { fontSize: 14, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  bar: { height: 6, alignSelf: 'stretch', backgroundColor: palette.surface, borderRadius: 3, overflow: 'hidden', marginVertical: 4 },
  barFill: { height: 6, borderRadius: 3 },
  vozRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  safety: {
    flexDirection: 'row', gap: spacing.s, alignItems: 'center', padding: spacing.s,
    borderRadius: radii.m, borderWidth: 1, borderColor: color.warn,
  },
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.s },
  steps: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  segLine: { flexDirection: 'row', gap: spacing.s, paddingVertical: 6, paddingHorizontal: spacing.s, borderRadius: radii.s },
  segActual: { backgroundColor: palette.highlight },
  backdrop: { flex: 1, backgroundColor: 'rgba(2,22,39,0.85)', justifyContent: 'center', padding: spacing.m },
  sheet: {
    backgroundColor: palette.surface, borderRadius: radii.l, padding: spacing.l, gap: spacing.s,
    borderWidth: 1, borderColor: palette.line, maxWidth: 440, alignSelf: 'center', width: '100%',
  },
});
