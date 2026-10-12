import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, radii } from '@/lib/theme';

export type Basemap = 'carta' | 'osm' | 'satelite' | 'mixta';

const OPCIONES: { key: Basemap; label: string }[] = [
  { key: 'carta', label: 'Carta náutica' },
  { key: 'osm', label: 'OpenStreetMap' },
  { key: 'satelite', label: 'Satélite' },
  { key: 'mixta', label: 'Satélite + carta' },
];

/** Selector de vista: carta náutica (ENC del IHM), OpenStreetMap, satélite o satélite con los datos de la carta encima. */
export function BasemapSwitcher({ value, onChange }: { value: Basemap; onChange: (b: Basemap) => void }) {
  return (
    <View style={styles.switcher}>
      {OPCIONES.map((o) => (
        <Pressable
          key={o.key}
          style={[styles.pill, value === o.key && styles.pillActive]}
          onPress={() => onChange(o.key)}
          accessibilityLabel={`Vista ${o.label}`}
        >
          <Text style={[styles.pillText, value === o.key && styles.pillTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Los textos de la carta (sand, rock…) vienen dibujados en la imagen del IHM y no se pueden
// traducir; esta leyenda da su equivalencia en español.
const FONDOS: [string, string][] = [
  ['sand', 'arena'], ['mud', 'fango'], ['gravel', 'grava'], ['stone', 'piedra / canto'],
  ['rock', 'roca'], ['boulders', 'bloques'], ['cobbles', 'cantos rodados'], ['pebbles', 'guijarros'],
  ['shingle', 'guijarros gruesos'], ['clay', 'arcilla'], ['silt', 'limo'], ['ooze', 'cieno'],
  ['coral', 'coral'], ['shells', 'conchas'], ['weed / kelp', 'algas'], ['fine / medium / coarse', 'fino / medio / grueso'],
];
const OTROS: [string, string][] = [
  ['Rk', 'roca'], ['Wk', 'pecio'], ['Obstn', 'obstrucción'], ['PA', 'posición aproximada'],
  ['Fl / Q / Iso / Oc', 'destellos / centelleo / isófase / ocultaciones'], ['W / R / G / Y', 'blanca / roja / verde / amarilla'],
  ['m / M', 'metros de altura / millas de alcance'], ['Anch.', 'fondeadero'], ['Cable', 'cable submarino'],
];

export function ChartLegendButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable style={styles.fab} onPress={() => setOpen(true)} accessibilityLabel="Leyenda de la carta">
        <Text style={styles.fabText}>?</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>Leyenda de la carta náutica</Text>
            <ScrollView>
              <Text style={styles.section}>Tipo de fondo</Text>
              {FONDOS.map(([en, es]) => <Row key={en} en={en} es={es} />)}
              <Text style={styles.section}>Abreviaturas</Text>
              {OTROS.map(([en, es]) => <Row key={en} en={en} es={es} />)}
            </ScrollView>
            <Pressable style={styles.close} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Row({ en, es }: { en: string; es: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.en}>{en}</Text>
      <Text style={styles.es}>{es}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: {
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line,
    borderRadius: radii.m, padding: 4, gap: 4,
  },
  pill: { paddingVertical: 6, paddingHorizontal: spacing.s, borderRadius: radii.s },
  pillActive: { backgroundColor: palette.coral },
  pillText: { color: palette.foamSoft, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  pillTextActive: { color: palette.foam },
  fab: {
    width: 48, height: 48, borderRadius: radii.pill, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center',
  },
  fabText: { color: palette.foam, fontSize: 22, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.m },
  sheet: {
    backgroundColor: palette.surface, borderRadius: radii.m, borderWidth: 1, borderColor: palette.line,
    padding: spacing.m, width: '100%', maxWidth: 440, maxHeight: '85%',
  },
  title: { color: palette.foam, fontSize: 16, fontWeight: '700', marginBottom: spacing.s },
  section: { color: palette.buoy, fontSize: 12, fontWeight: '700', marginTop: spacing.s, marginBottom: 4 },
  row: { flexDirection: 'row', paddingVertical: 3, gap: spacing.s },
  en: { color: palette.foamSoft, width: '38%', fontSize: 13 },
  es: { color: palette.foam, flex: 1, fontSize: 13 },
  close: { alignSelf: 'flex-end', marginTop: spacing.s, padding: spacing.s },
  closeText: { color: palette.buoy, fontWeight: '700' },
});
