import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { Badge, Button, Chip, EmptyState, Field, IconButton, Segmented } from '@/components/ui';
import { ThemedText } from '@/components/ThemedText';
import { CATEGORIAS, EQUIPO_BASICO, diasParaCaducar, useChecklist, useEquipo, type Fase } from '@/hooks/useEquipo';
import { palette, radii, spacing, TOUCH } from '@/lib/theme';
import type { CategoriaEquipo, Equipo } from '@/types';

const CADUCIDADES: { key: string; label: string; meses: number | null }[] = [
  { key: 'no', label: 'Sin fecha', meses: null },
  { key: '6', label: '6 meses', meses: 6 },
  { key: '12', label: '1 año', meses: 12 },
  { key: '24', label: '2 años', meses: 24 },
];

const iso = (meses: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
};

/**
 * Checklist "de avión" + gestión del equipo.
 * Dos fases: antes de salir (no dejarse nada) y al volver (no olvidar nada en la playa o el coche).
 */
export function EquipoView({ faseInicial = 'salir' }: { faseInicial?: Fase }) {
  const { items, loading, offline, add, addMany, update, remove } = useEquipo();
  const { marcados, toggle, reiniciar } = useChecklist();
  const [fase, setFase] = useState<Fase>(faseInicial);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Equipo | 'nuevo' | null>(null);

  const hechos = marcados[fase].filter((id) => items.some((i) => i.id === id)).length;
  const completo = items.length > 0 && hechos === items.length;

  const grupos = useMemo(
    () => CATEGORIAS.map((c) => ({ ...c, items: items.filter((i) => i.categoria === c.key) })).filter((g) => g.items.length > 0),
    [items],
  );

  const cargarBasico = async () => {
    try {
      await addMany(EQUIPO_BASICO);
    } catch {
      Alert.alert('Sin conexión', 'Para añadir equipo necesitas conexión. Inténtalo de nuevo.');
    }
  };

  const borrar = (it: Equipo) =>
    Alert.alert(`¿Quitar "${it.nombre}"?`, 'Desaparecerá de tu equipo y de la lista.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => remove(it.id).catch(() => Alert.alert('No se pudo quitar', 'Comprueba tu conexión.')),
      },
    ]);

  if (!loading && items.length === 0) {
    return (
      <>
        <EmptyState
          icon="clipboard-outline"
          title="Tu equipo, siempre a mano"
          text="Apunta lo que llevas a pescar y marca cada pieza antes de salir y al volver. Así no se queda nada atrás."
          actionLabel="Cargar equipo básico"
          onAction={cargarBasico}
        />
        <View style={{ paddingHorizontal: spacing.l }}>
          <Button label="Añadir pieza a mano" variant="ghost" onPress={() => setForm('nuevo')} />
        </View>
        <FormEquipo valor={form} onClose={() => setForm(null)} onAdd={add} onUpdate={update} />
      </>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.m, paddingBottom: 40, gap: spacing.m }}>
      <Segmented
        value={fase}
        onChange={setFase}
        options={[{ key: 'salir', label: 'Antes de salir' }, { key: 'volver', label: 'Al volver' }]}
      />

      {/* Progreso */}
      <View style={[styles.progreso, completo && { borderColor: palette.ok }]} accessibilityLiveRegion="polite">
        <Ionicons
          name={completo ? 'checkmark-circle' : 'list-circle-outline'}
          size={28}
          color={completo ? palette.ok : palette.foamSoft}
        />
        <View style={{ flex: 1 }}>
          <ThemedText variant="h3">
            {completo ? (fase === 'salir' ? 'Todo listo para salir' : 'No te dejas nada') : `${hechos} de ${items.length}`}
          </ThemedText>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${items.length ? (hechos / items.length) * 100 : 0}%`, backgroundColor: completo ? palette.ok : palette.buoy }]} />
          </View>
        </View>
        {hechos > 0 && <IconButton icon="refresh" label="Reiniciar lista" onPress={() => reiniciar(fase)} size={40} />}
      </View>

      {offline && <Badge text="Sin conexión: usando la copia guardada" tone="warn" icon="cloud-offline-outline" />}

      {grupos.map((g) => (
        <View key={g.key} style={{ gap: 2 }}>
          <Text style={styles.cat}>{g.label}</Text>
          <View style={styles.grupo}>
            {g.items.map((it, i) => {
              const on = marcados[fase].includes(it.id);
              const dias = diasParaCaducar(it.caduca);
              const aviso = dias !== null && dias <= 30;
              return (
                <View key={it.id} style={[styles.fila, i > 0 && styles.sep]}>
                  <Pressable
                    style={styles.check}
                    onPress={() => toggle(fase, it.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={it.nombre}
                  >
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={on ? palette.ok : palette.foamSoft} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.nombre, on && styles.hecho]}>{it.nombre}</Text>
                      {aviso && (
                        <Badge
                          text={dias! < 0 ? 'Caducado' : `Caduca en ${dias} d`}
                          tone={dias! < 0 ? 'danger' : 'warn'}
                          icon="alert-circle-outline"
                        />
                      )}
                    </View>
                  </Pressable>
                  {editando && (
                    <View style={styles.acciones}>
                      <IconButton icon="create-outline" label={`Editar ${it.nombre}`} onPress={() => setForm(it)} size={40} />
                      <IconButton icon="trash-outline" label={`Quitar ${it.nombre}`} onPress={() => borrar(it)} size={40} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <View style={styles.pie}>
        <Button label="Añadir pieza" icon="add" variant="secondary" style={{ flex: 1 }} onPress={() => setForm('nuevo')} />
        <Button
          label={editando ? 'Hecho' : 'Editar'}
          icon={editando ? 'checkmark' : 'create-outline'}
          variant="ghost"
          style={{ flex: 1 }}
          onPress={() => setEditando((e) => !e)}
        />
      </View>

      <FormEquipo valor={form} onClose={() => setForm(null)} onAdd={add} onUpdate={update} />
    </ScrollView>
  );
}

function FormEquipo({
  valor, onClose, onAdd, onUpdate,
}: {
  valor: Equipo | 'nuevo' | null;
  onClose: () => void;
  onAdd: (p: { nombre: string; categoria: CategoriaEquipo; caduca?: string | null }) => Promise<void>;
  onUpdate: (id: string, p: { nombre: string; categoria: CategoriaEquipo; caduca?: string | null }) => Promise<void>;
}) {
  const edit = valor && valor !== 'nuevo' ? valor : null;
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState<CategoriaEquipo>('pesca');
  const [cad, setCad] = useState('no');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState<typeof valor>(null);

  // Al abrir se rellena con la pieza que se edita (o en blanco).
  if (valor !== abierto) {
    setAbierto(valor);
    setNombre(edit?.nombre ?? '');
    setCategoria(edit?.categoria ?? 'pesca');
    setCad(edit?.caduca ? 'mantener' : 'no');
    setError(null);
  }

  const guardar = async () => {
    if (!nombre.trim()) return setError('Escribe el nombre.');
    const meses = CADUCIDADES.find((c) => c.key === cad)?.meses ?? null;
    const caduca = cad === 'mantener' ? edit?.caduca ?? null : meses ? iso(meses) : null;
    setGuardando(true);
    try {
      if (edit) await onUpdate(edit.id, { nombre, categoria, caduca });
      else await onAdd({ nombre, categoria, caduca });
      onClose();
    } catch {
      setError('No se pudo guardar. Comprueba tu conexión.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal visible={!!valor} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fondoModal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.hoja}>
          <ThemedText variant="h2">{edit ? 'Editar pieza' : 'Nueva pieza'}</ThemedText>
          <Field label="Nombre" value={nombre} onChangeText={setNombre} error={error} autoCapitalize="sentences" />
          <Text style={styles.sub}>Categoría</Text>
          <View style={styles.chips}>
            {CATEGORIAS.map((c) => (
              <Chip key={c.key} label={c.label} on={categoria === c.key} onPress={() => setCategoria(c.key)} />
            ))}
          </View>
          <Text style={styles.sub}>Caduca o revisar en</Text>
          <View style={styles.chips}>
            {edit?.caduca && <Chip label={`Mantener (${edit.caduca})`} on={cad === 'mantener'} onPress={() => setCad('mantener')} />}
            {CADUCIDADES.map((c) => (
              <Chip key={c.key} label={c.label} on={cad === c.key} onPress={() => setCad(c.key)} />
            ))}
          </View>
          <View style={styles.acc}>
            <Button label="Cancelar" variant="ghost" compact onPress={onClose} />
            <Button label="Guardar" compact onPress={guardar} loading={guardando} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  progreso: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.m, padding: spacing.m,
    backgroundColor: palette.surface, borderRadius: radii.m, borderWidth: 1, borderColor: palette.line,
  },
  bar: { height: 6, borderRadius: 3, backgroundColor: palette.abyss, overflow: 'hidden', marginTop: 6 },
  barFill: { height: 6, borderRadius: 3 },
  cat: { color: palette.foamSoft, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 4, marginBottom: 4 },
  grupo: { backgroundColor: palette.surface, borderRadius: radii.m, borderWidth: 1, borderColor: palette.line, overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'center' },
  sep: { borderTopWidth: 1, borderTopColor: palette.line },
  check: { flex: 1, minHeight: TOUCH + 8, flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.m, paddingVertical: spacing.s },
  nombre: { color: palette.foam, fontSize: 17 },
  hecho: { color: palette.foamSoft, textDecorationLine: 'line-through' },
  acciones: { flexDirection: 'row', gap: spacing.xs, paddingRight: spacing.s },
  pie: { flexDirection: 'row', gap: spacing.s },
  fondoModal: { flex: 1, backgroundColor: 'rgba(2,22,39,0.8)', justifyContent: 'flex-end' },
  hoja: { backgroundColor: palette.surface, padding: spacing.m, borderTopLeftRadius: radii.l, borderTopRightRadius: radii.l, gap: spacing.s },
  sub: { color: palette.foamSoft, fontSize: 13, fontWeight: '600', marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  acc: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.s, marginTop: spacing.s },
});
