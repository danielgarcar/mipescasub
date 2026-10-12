import { useMemo, useState } from 'react';
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { useEspecies } from '@/hooks/useSpots';
import { palette, card, spacing, radii } from '@/lib/theme';
import type { Especie } from '@/types';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Catálogo de especies con buscador; cada una enlaza a su ficha en galiciapesca.com. */
export function EspeciesList() {
  const { especies, loading, error } = useEspecies();
  const [q, setQ] = useState('');

  const filtradas = useMemo(() => {
    const t = sinTildes(q.trim());
    if (!t) return especies;
    return especies.filter((e) => sinTildes(`${e.nombre} ${e.nombre_cientifico ?? ''}`).includes(t));
  }, [especies, q]);

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        style={styles.input}
        placeholder="Buscar especie…"
        placeholderTextColor={palette.foamSoft}
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
      />
      {loading ? (
        <ThemedText variant="body" style={styles.center}>Cargando especies…</ThemedText>
      ) : error ? (
        <ThemedText variant="body" style={styles.center}>{error}</ThemedText>
      ) : especies.length === 0 ? (
        <ThemedText variant="body" style={styles.center}>El catálogo de especies aún está vacío.</ThemedText>
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.m, paddingBottom: 100, gap: spacing.s }}
          ListHeaderComponent={
            <ThemedText variant="small">
              {filtradas.length} de {especies.length} especies · Fuente: galiciapesca.com
            </ThemedText>
          }
          renderItem={({ item }) => <EspecieCard e={item} />}
        />
      )}
    </View>
  );
}

function EspecieCard({ e }: { e: Especie }) {
  return (
    <Pressable style={[card, styles.row]} onPress={() => Linking.openURL(e.url_fuente)} accessibilityRole="link">
      {e.imagen_url ? (
        <Image source={{ uri: e.imagen_url }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.placeholder]}>
          <Text style={{ fontSize: 22 }}>🐟</Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText variant="h3" numberOfLines={1}>{e.nombre}</ThemedText>
        {!!e.nombre_cientifico && (
          <ThemedText variant="small" style={{ fontStyle: 'italic' }} numberOfLines={1}>
            {e.nombre_cientifico}
          </ThemedText>
        )}
        {e.talla_minima_cm != null && <ThemedText variant="small">Talla mínima: {e.talla_minima_cm} cm</ThemedText>}
        <Text style={styles.link}>Ver ficha en galiciapesca.com ↗</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: palette.surface, borderRadius: radii.m, color: palette.foam,
    paddingHorizontal: spacing.m, paddingVertical: 10, borderWidth: 1, borderColor: palette.line,
    margin: spacing.m, marginBottom: 0,
  },
  center: { textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.l },
  row: { flexDirection: 'row', gap: spacing.m, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: radii.s, backgroundColor: palette.highlight },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  link: { color: palette.buoy, fontSize: 12, fontWeight: '600', marginTop: 2 },
});
