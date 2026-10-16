import { View, StyleSheet } from 'react-native';
import { Button } from './ui';
import { spacing } from '@/lib/theme';
import type { useApneaTimer } from '@/hooks/useApneaTimer';

type Timer = ReturnType<typeof useApneaTimer>;

export function ApneaControls({ t }: { t: Timer }) {
  const isDone = t.phase === 'done';
  const isIdle = t.phase === 'idle';

  if (isIdle || isDone) {
    return (
      <View style={styles.col}>
        <Button label={isDone ? 'Repetir' : 'Iniciar'} icon={isDone ? 'refresh' : 'play'} onPress={t.start} style={styles.big} />
      </View>
    );
  }
  return (
    <View style={styles.col}>
      <View style={styles.row}>
        <Button
          label={t.isRunning ? 'Pausa' : 'Reanudar'}
          icon={t.isRunning ? 'pause' : 'play'}
          variant="secondary"
          onPress={t.isRunning ? t.pause : t.resume}
          style={styles.half}
        />
        <Button label="Saltar" icon="play-skip-forward" variant="secondary" onPress={t.skip} style={styles.half} />
      </View>
      <Button label="Terminar" icon="stop" variant="danger" onPress={t.stop} />
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: spacing.s, marginTop: spacing.s },
  row: { flexDirection: 'row', gap: spacing.s },
  half: { flex: 1 },
  big: { minHeight: 60 },
});
