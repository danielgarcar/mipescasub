import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Modal, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Alert } from '@/lib/alert';
import { ThemedText } from '@/components/ThemedText';
import { Button, EmptyState, ErrorState, Fab, Field } from '@/components/ui';
import { palette, card, spacing, radii } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import type { ForoHilo } from '@/types';

export default function ForoScreen() {
  const router = useRouter();
  const [publicando, setPublicando] = useState(false);
  const [errores, setErrores] = useState<{ titulo?: string; contenido?: string }>({});
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
    const e: { titulo?: string; contenido?: string } = {};
    if (!titulo.trim()) e.titulo = 'Escribe un título.';
    if (!contenido.trim()) e.contenido = 'Escribe el mensaje.';
    setErrores(e);
    if (e.titulo || e.contenido) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      Alert.alert('Inicia sesión', 'Necesitas una cuenta para abrir un hilo (pestaña Perfil).');
      return;
    }
    setPublicando(true);
    const { data: hilo, error } = await supabase
      .from('pescasub_foro_hilos')
      .insert({ usuario: auth.user.id, titulo: titulo.trim(), categoria: 'general' })
      .select('id')
      .single();
    if (error || !hilo) {
      setPublicando(false);
      Alert.alert('No se pudo publicar', 'Inténtalo de nuevo en unos segundos.');
      return;
    }
    const { error: errMsg } = await supabase
      .from('pescasub_foro_mensajes')
      .insert({ hilo: hilo.id, usuario: auth.user.id, contenido: contenido.trim() });
    setPublicando(false);
    if (errMsg) {
      Alert.alert('No se pudo publicar', 'Inténtalo de nuevo en unos segundos.');
      return;
    }
    setModalVisible(false);
    setTitulo('');
    setContenido('');
    load();
  };

  return (
    <View style={styles.root}>
      {error && hilos.length === 0 ? (
        <ErrorState onRetry={load} />
      ) : !loading && hilos.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="Todavía no hay discusiones"
          text="Pregunta por un spot, el material o las condiciones del mar."
          actionLabel="Abrir el primer hilo"
          onAction={() => setModalVisible(true)}
        />
      ) : (
        <FlatList
          data={hilos}
          keyExtractor={(h) => h.id}
          contentContainerStyle={{ padding: spacing.m, paddingBottom: 96, gap: spacing.s }}
          refreshing={loading}
          onRefresh={load}
          renderItem={({ item }) => (
            <Pressable
              style={card}
              onPress={() => router.push({ pathname: '/foro/[id]', params: { id: item.id, titulo: item.titulo } })}
              accessibilityRole="button"
              accessibilityLabel={`Hilo: ${item.titulo}`}
            >
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
            </Pressable>
          )}
        />
      )}

      <Fab label="Nuevo hilo" onPress={() => setModalVisible(true)} />

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <ThemedText variant="h2">Nuevo hilo</ThemedText>
            <Field label="Título" value={titulo} onChangeText={setTitulo} maxLength={120} error={errores.titulo} />
            <Field label="Mensaje" value={contenido} onChangeText={setContenido} multiline error={errores.contenido} />
            <View style={styles.modalActions}>
              <Button label="Cancelar" variant="ghost" compact onPress={() => setModalVisible(false)} />
              <Button label="Publicar" compact onPress={publish} loading={publicando} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  modalBg: { flex: 1, backgroundColor: 'rgba(2,22,39,0.8)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: palette.surface, padding: spacing.m,
    borderTopLeftRadius: radii.l, borderTopRightRadius: radii.l, gap: spacing.s,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.s, marginTop: spacing.xs },
});
