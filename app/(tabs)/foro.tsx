import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, Text, TextInput, Modal } from 'react-native';
import { Alert } from '@/lib/alert';
import { ThemedText } from '@/components/ThemedText';
import { palette, card, spacing, radii } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import type { ForoHilo } from '@/types';

export default function ForoScreen() {
  const [hilos, setHilos] = useState<ForoHilo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Los hilos solo tienen título; el texto está en `pescasub_foro_mensajes` (el primer mensaje).
    const { data, error } = await supabase
      .from('pescasub_foro_hilos')
      .select('id, usuario, titulo, categoria, creado_en')
      .order('creado_en', { ascending: false });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const filas = (data ?? []) as { id: string; usuario: string; titulo: string; categoria: string | null; creado_en: string }[];
    const ids = filas.map((h) => h.id);
    const usuarios = [...new Set(filas.map((h) => h.usuario))];

    const [msgs, perfiles] = await Promise.all([
      ids.length
        ? supabase
            .from('pescasub_foro_mensajes')
            .select('hilo, contenido, creado_en')
            .in('hilo', ids)
            .order('creado_en', { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      usuarios.length
        ? supabase.from('pescasub_perfiles').select('id, alias, nombre').in('id', usuarios)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const primero = new Map<string, string>();
    const cuenta = new Map<string, number>();
    for (const m of (msgs.data ?? []) as { hilo: string; contenido: string }[]) {
      if (!primero.has(m.hilo)) primero.set(m.hilo, m.contenido);
      cuenta.set(m.hilo, (cuenta.get(m.hilo) ?? 0) + 1);
    }
    const nombre = new Map<string, string>();
    for (const p of (perfiles.data ?? []) as { id: string; alias: string | null; nombre: string }[]) {
      nombre.set(p.id, p.alias || p.nombre);
    }

    setHilos(
      filas.map((h) => ({
        id: h.id,
        created_at: h.creado_en,
        titulo: h.titulo,
        categoria: h.categoria,
        contenido: primero.get(h.id) ?? '',
        autor: nombre.get(h.usuario) ?? null,
        user_id: h.usuario,
        respuestas_count: Math.max(0, (cuenta.get(h.id) ?? 0) - 1),
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const publish = async () => {
    if (!titulo.trim() || !contenido.trim()) {
      Alert.alert('Campos incompletos', 'Rellena título y contenido antes de publicar.');
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      Alert.alert('Inicia sesión', 'Necesitas una cuenta para abrir un hilo (pestaña Perfil).');
      return;
    }
    const { data: hilo, error } = await supabase
      .from('pescasub_foro_hilos')
      .insert({ usuario: auth.user.id, titulo: titulo.trim(), categoria: 'general' })
      .select('id')
      .single();
    if (error || !hilo) {
      Alert.alert('Error', error?.message ?? 'No se pudo crear el hilo.');
      return;
    }
    const { error: errMsg } = await supabase
      .from('pescasub_foro_mensajes')
      .insert({ hilo: hilo.id, usuario: auth.user.id, contenido: contenido.trim() });
    if (errMsg) {
      Alert.alert('Error', errMsg.message);
      return;
    }
    setModalVisible(false);
    setTitulo('');
    setContenido('');
    load();
  };

  return (
    <View style={styles.root}>
      {loading && <ThemedText variant="body" style={styles.center}>Cargando hilos…</ThemedText>}
      {!loading && hilos.length === 0 && (
        <ThemedText variant="body" style={styles.center}>
          Todavía no hay discusiones. ¡Abre el primer hilo!
        </ThemedText>
      )}
      {error && <ThemedText variant="body" style={styles.center}>{error}</ThemedText>}

      <FlatList
        data={hilos}
        keyExtractor={(h) => h.id}
        contentContainerStyle={{ padding: spacing.m, gap: spacing.s }}
        renderItem={({ item }) => (
          <View style={card}>
            <ThemedText variant="h3" numberOfLines={1}>{item.titulo}</ThemedText>
            <ThemedText variant="body" numberOfLines={2}>{item.contenido}</ThemedText>
            <View style={styles.meta}>
              <ThemedText variant="small">
                {item.autor ?? 'Anónimo'}
                {item.respuestas_count ? ` · ${item.respuestas_count} respuesta(s)` : ''}
              </ThemedText>
              {item.created_at && (
                <ThemedText variant="small">{new Date(item.created_at).toLocaleDateString('es-ES')}</ThemedText>
              )}
            </View>
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)} accessibilityLabel="Nuevo hilo">
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ThemedText variant="h2">Nuevo hilo</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Título"
              placeholderTextColor={palette.foamSoft}
              value={titulo}
              onChangeText={setTitulo}
              maxLength={120}
            />
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="¿De qué quieres hablar?"
              placeholderTextColor={palette.foamSoft}
              value={contenido}
              onChangeText={setContenido}
              multiline
              numberOfLines={5}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.btnGhost} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.btnSolid} onPress={publish}>
                <Text style={styles.btnSolidText}>Publicar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  center: { textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.l },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  fab: {
    position: 'absolute', right: spacing.m, bottom: spacing.m + 60,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: palette.coral, alignItems: 'center', justifyContent: 'center',
  },
  fabText: { color: palette.foam, fontSize: 28, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(2,22,39,0.8)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: palette.surface, padding: spacing.m,
    borderTopLeftRadius: radii.l, borderTopRightRadius: radii.l, gap: spacing.s,
  },
  input: {
    backgroundColor: palette.abyss, borderRadius: radii.s,
    color: palette.foam, paddingHorizontal: spacing.m, paddingVertical: spacing.s,
    borderWidth: 1, borderColor: palette.line,
  },
  inputMulti: { minHeight: 110, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.s, marginTop: spacing.xs },
  btnGhost: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radii.s, borderWidth: 1, borderColor: palette.line },
  btnGhostText: { color: palette.foam },
  btnSolid: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radii.s, backgroundColor: palette.coral },
  btnSolidText: { color: palette.foam, fontWeight: '700' },
});
