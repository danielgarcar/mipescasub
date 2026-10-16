import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, radii } from '@/lib/theme';
import { IconButton } from './ui';

export type Basemap = 'carta' | 'osm' | 'satelite' | 'mixta';

const OPCIONES: { key: Basemap; label: string }[] = [
  { key: 'carta', label: 'Carta náutica' },
  { key: 'osm', label: 'OpenStreetMap' },
  { key: 'satelite', label: 'Satélite' },
  { key: 'mixta', label: 'Satélite + carta' },
];

/**
 * Botón único "Capas": abre una hoja con las 4 vistas. Así el mapa queda libre
 * en lugar de llevar 4 pastillas fijas encima.
 */
export function BasemapSwitcher({ value, onChange }: { value: Basemap; onChange: (b: Basemap) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon="layers" label="Cambiar capas del mapa" onPress={() => setOpen(true)} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Cerrar">
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>Vista del mapa</Text>
            {OPCIONES.map((o) => {
              const on = value === o.key;
              return (
                <Pressable
                  key={o.key}
                  style={[styles.opt, on && styles.optOn]}
                  onPress={() => { onChange(o.key); setOpen(false); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? palette.buoy : palette.foamSoft} />
                  <Text style={[styles.optText, on && { color: palette.foam, fontWeight: '700' }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
      <IconButton icon="help-circle-outline" label="Leyenda de la carta" onPress={() => setOpen(true)} />
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
            <Pressable style={styles.close} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar leyenda">
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.m },
  sheet: {
    backgroundColor: palette.surface, borderRadius: radii.l, borderWidth: 1, borderColor: palette.line,
    padding: spacing.m, width: '100%', maxWidth: 440, maxHeight: '85%',
  },
  title: { color: palette.foam, fontSize: 17, fontWeight: '700', marginBottom: spacing.s },
  opt: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, minHeight: 52, paddingHorizontal: spacing.s, borderRadius: radii.m },
  optOn: { backgroundColor: palette.highlight },
  optText: { color: palette.foamSoft, fontSize: 16 },
  section: { color: palette.buoy, fontSize: 12, fontWeight: '700', marginTop: spacing.s, marginBottom: 4 },
  row: { flexDirection: 'row', paddingVertical: 3, gap: spacing.s },
  en: { color: palette.foamSoft, width: '38%', fontSize: 13 },
  es: { color: palette.foam, flex: 1, fontSize: 13 },
  close: { alignSelf: 'flex-end', marginTop: spacing.s, minHeight: 48, paddingHorizontal: spacing.m, justifyContent: 'center' },
  closeText: { color: palette.buoy, fontWeight: '700', fontSize: 16 },
});
