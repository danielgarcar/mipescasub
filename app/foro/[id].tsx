import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert } from '@/lib/alert';
import { ThemedText } from '@/components/ThemedText';
import { EmptyState, ErrorState, Field, IconButton } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { palette, card, spacing } from '@/lib/theme';

type Msg = { key: string; autor: string; contenido: string; fecha: string | null };

/** Hilo del foro: mensajes en orden cronológico y respuesta rápida abajo. */
export default function HiloScreen() {
  const { id, titulo } = useLocalSearchParams<{ id: string; titulo?: string }>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error } = await supabase
      .from('pescasub_foro_mensajes')
      .select('*')
      .eq('hilo', id)
      .order('creado_en', { ascending: true });
    if (error) {
      setError(true);
      setLoading(false);
      return;
    }
    const filas = (data ?? []) as any[];
    const usuarios = [...new Set(filas.map((m) => m.usuario))];
    const { data: perfiles } = usuarios.length
      ? await supabase.from('pescasub_perfiles').select('id, alias, nombre').in('id', usuarios)
      : { data: [] as any[] };
    const nombre = new Map<string, string>();
    for (const p of (perfiles ?? []) as any[]) nombre.set(p.id, p.alias || p.nombre);
    setMsgs(
      filas.map((m, i) => ({
        key: String(m.id ?? i),
        autor: nombre.get(m.usuario) ?? 'Anónimo',
        contenido: m.contenido,
        fecha: m.creado_en ?? null,
      })),
    );
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const responder = async () => {
    const contenido = texto.trim();
    if (!contenido) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return Alert.alert('Inicia sesión', 'Necesitas una cuenta para responder.');
    setEnviando(true);
    const { error } = await supabase
      .from('pescasub_foro_mensajes')
      .insert({ hilo: id, usuario: auth.user.id, contenido });
    setEnviando(false);
    if (error) return Alert.alert('No se pudo enviar', 'Inténtalo de nuevo en unos segundos.');
    setTexto('');
    load();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: titulo ?? 'Hilo' }} />
      {error && msgs.length === 0 ? (
        <ErrorState onRetry={load} />
      ) : !loading && msgs.length === 0 ? (
        <EmptyState icon="chatbubble-outline" title="Hilo sin mensajes" />
      ) : (
        <FlatList
          data={msgs}
          keyExtractor={(m) => m.key}
          contentContainerStyle={{ padding: spacing.m, gap: spacing.s }}
          refreshing={loading}
          onRefresh={load}
          renderItem={({ item, index }) => (
            <View style={[card, index === 0 && { borderColor: palette.buoy }]}>
              <ThemedText variant="small" style={{ color: palette.buoy, fontWeight: '700' }}>{item.autor}</ThemedText>
              <ThemedText variant="body" style={{ color: palette.foam }}>{item.contenido}</ThemedText>
              {!!item.fecha && (
                <ThemedText variant="small">{new Date(item.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</ThemedText>
              )}
            </View>
          )}
        />
      )}
      <View style={styles.composer}>
        <View style={{ flex: 1 }}>
          <Field label="Tu respuesta" value={texto} onChangeText={setTexto} multiline style={{ minHeight: 44, maxHeight: 120 }} />
        </View>
        <IconButton icon={enviando ? 'hourglass-outline' : 'send'} label="Enviar respuesta" onPress={responder} accent />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.s, padding: spacing.m,
    borderTopWidth: 1, borderTopColor: palette.line, backgroundColor: palette.abyss,
  },
});
