import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { palette, spacing, radii } from '@/lib/theme';

export type PlaceResult = { lat: number; lng: number; name: string };

type Props = { onSelect: (p: PlaceResult) => void };

/**
 * Buscador de lugares con Nominatim (geocodificador de OpenStreetMap).
 * Política de uso: máx. 1 petición/s, así que se busca con debounce y mínimo 3 letras.
 */
export function PlaceSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(PlaceResult & { id: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setMsg(null);
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setMsg(null);
      try {
        const url =
          'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=es&q=' +
          encodeURIComponent(q);
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const json = await res.json();
        if (id !== seq.current) return;
        const list = (Array.isArray(json) ? json : []).map((r: any) => ({
          id: String(r.place_id),
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          name: String(r.display_name),
        }));
        setResults(list);
        if (!list.length) setMsg('Sin resultados');
      } catch {
        if (id === seq.current) setMsg('No se pudo buscar (¿sin conexión?)');
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [query]);

  const pick = (r: PlaceResult) => {
    onSelect(r);
    setQuery(r.name.split(',')[0]);
    setResults([]);
    setMsg(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar lugar, puerto, playa…"
          placeholderTextColor={palette.foamSoft}
          returnKeyType="search"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator color={palette.buoy} />}
        {!!query && !loading && (
          <Pressable onPress={() => setQuery('')} accessibilityLabel="Borrar búsqueda">
            <Text style={styles.clear}>✕</Text>
          </Pressable>
        )}
      </View>
      {(results.length > 0 || msg) && (
        <View style={styles.list}>
          {msg && <Text style={styles.msg}>{msg}</Text>}
          <FlatList
            data={results}
            keyExtractor={(r) => r.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.item} onPress={() => pick(item)}>
                <Text style={styles.itemText} numberOfLines={2}>
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
          <Text style={styles.credit}>© OpenStreetMap · Nominatim</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: spacing.m, left: spacing.m + 44, right: spacing.m, zIndex: 10, maxWidth: 520 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.s,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line,
    borderRadius: radii.m, paddingHorizontal: spacing.m,
  },
  input: { flex: 1, color: palette.foam, paddingVertical: 10, fontSize: 15 },
  clear: { color: palette.foamSoft, fontSize: 16, padding: 4 },
  list: {
    marginTop: 4, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line,
    borderRadius: radii.m, maxHeight: 280, overflow: 'hidden',
  },
  item: { paddingHorizontal: spacing.m, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.line },
  itemText: { color: palette.foam, fontSize: 13 },
  msg: { color: palette.foamSoft, padding: spacing.m, fontSize: 13 },
  credit: { color: palette.foamSoft, fontSize: 10, textAlign: 'right', padding: 4 },
});
