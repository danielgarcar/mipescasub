import { View, Pressable, StyleSheet, Text } from 'react-native';
import { ThemedText } from './ThemedText';
import { palette, spacing, radii } from '@/lib/theme';
import type { useApneaTimer } from '@/hooks/useApneaTimer';

type Timer = ReturnType<typeof useApneaTimer>;

export function ApneaControls({ t }: { t: Timer }) {
  const isDone = t.phase === 'done';
  const isIdle = t.phase === 'idle';

  return (
    <View style={styles.row}>
      {isIdle && (
        <Pressable style={[styles.btn, styles.start]} onPress={t.start}>
          <Text style={styles.startText}>▶ Iniciar</Text>
        </Pressable>
      )}
      {isDone && (
        <Pressable style={[styles.btn, styles.start]} onPress={t.start}>
          <Text style={styles.startText}>↻ Repetir</Text>
        </Pressable>
      )}
      {!isIdle && !isDone && (
        <>
          <Pressable style={styles.btn} onPress={t.isRunning ? t.pause : t.resume}>
            <Text style={styles.btnText}>{t.isRunning ? '⏸ Pausa' : '▶ Reanudar'}</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={t.skip}>
            <Text style={styles.btnText}>⏭ Saltar</Text>
          </Pressable>
        </>
      )}
      {!isIdle && <Pressable style={[styles.btn, styles.stop]} onPress={t.stop}>
        <Text style={styles.btnText}>■ Terminar</Text>
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, justifyContent: 'center', marginTop: spacing.m },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.highlight,
  },
  start: { backgroundColor: palette.ok, borderColor: palette.ok, minWidth: 140, alignItems: 'center' },
  stop: { backgroundColor: palette.coral, borderColor: palette.coral },
  btnText: { color: palette.foam, fontSize: 15, fontWeight: '600' },
  startText: { color: palette.deep, fontSize: 15, fontWeight: '700' },
});
