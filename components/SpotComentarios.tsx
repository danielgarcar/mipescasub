import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { addComentario, deleteComentario, useComentarios } from '@/hooks/useSpots';
import { palette, card, spacing, radii } from '@/lib/theme';

type Props = { spotId: string; userId?: string | null; esDueno: boolean };

const hace = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString('es-ES');
};

/** Comentarios de un spot: los ve y escribe quien tenga acceso al spot. */
export function SpotComentarios({ spotId, userId, esDueno }: Props) {
  const { comentarios, loading, error, reload } = useComentarios(spotId);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      await addComentario(spotId, texto);
      setTexto('');
      await reload();
    } catch (e: any) {
      Alert.alert('No se pudo comentar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const borrar = (id: string) => {
    Alert.alert('Borrar comentario', '¿Seguro que quieres borrarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComentario(id);
            await reload();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'No se pudo borrar.');
          }
        },
      },
    ]);
  };

  return (
    <View style={card}>
      <ThemedText variant="h3">Comentarios ({comentarios.length})</ThemedText>

      {loading ? (
        <ActivityIndicator color={palette.buoy} style={{ marginVertical: spacing.m }} />
      ) : error ? (
        <ThemedText variant="small">{error}</ThemedText>
      ) : comentarios.length === 0 ? (
        <ThemedText variant="small">Aún no hay comentarios. ¡Sé el primero!</ThemedText>
      ) : (
        comentarios.map((c) => (
          <View key={c.id} style={styles.item}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{c.autor.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.head}>
                <Text style={styles.autor}>{c.autor}</Text>
                <Text style={styles.fecha}>{hace(c.created_at)}</Text>
              </View>
              <Text style={styles.texto} selectable>{c.contenido}</Text>
            </View>
            {(c.user_id === userId || esDueno) && (
              <Pressable onPress={() => borrar(c.id)} hitSlop={8} accessibilityLabel="Borrar comentario">
                <Ionicons name="trash-outline" size={16} color={palette.foamSoft} />
              </Pressable>
            )}
          </View>
        ))
      )}

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un comentario…"
          placeholderTextColor={palette.foamSoft}
          value={texto}
          onChangeText={setTexto}
          multiline
          maxLength={1000}
        />
        <Pressable style={[styles.send, (!texto.trim() || enviando) && { opacity: 0.5 }]} onPress={enviar} disabled={!texto.trim() || enviando}>
          {enviando ? <ActivityIndicator color={palette.onAccent} /> : <Ionicons name="send" size={18} color={palette.onAccent} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: spacing.s, paddingVertical: 6, alignItems: 'flex-start' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.foam, fontWeight: '800' },
  head: { flexDirection: 'row', gap: spacing.s, alignItems: 'baseline' },
  autor: { color: palette.foam, fontWeight: '700', fontSize: 13 },
  fecha: { color: palette.foamSoft, fontSize: 11 },
  texto: { color: palette.foam, fontSize: 14, marginTop: 1, lineHeight: 19 },
  form: { flexDirection: 'row', gap: spacing.s, alignItems: 'flex-end', marginTop: spacing.s },
  input: {
    flex: 1, backgroundColor: palette.abyss, borderRadius: radii.s, color: palette.foam, borderWidth: 1,
    borderColor: palette.line, paddingHorizontal: spacing.m, paddingVertical: 10, maxHeight: 110,
  },
  send: { backgroundColor: palette.buoy, borderRadius: radii.s, width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
});
