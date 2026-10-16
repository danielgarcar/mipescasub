import { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '@/lib/alert';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { addCaptura, uploadPhoto, useEspecies, useSpots } from '@/hooks/useSpots';
import { ThemedText } from '@/components/ThemedText';
import { Button, Chip, Field } from '@/components/ui';
import { palette, spacing, radii, card } from '@/lib/theme';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const num = (v: string) => parseFloat(v.replace(',', '.'));

type Errores = { especie?: string; peso?: string; profundidad?: string };

export default function CapturaNewScreen() {
  const router = useRouter();
  const { especies } = useEspecies();
  const { spots } = useSpots();

  const [especie, setEspecie] = useState('');
  const [peso, setPeso] = useState('');
  const [profundidad, setProfundidad] = useState('');
  const [notas, setNotas] = useState('');
  const [spotId, setSpotId] = useState<string | null>(null);
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errores, setErrores] = useState<Errores>({});

  // Sugerencias mientras se escribe; desaparecen al coincidir exactamente con una especie.
  const sugerencias = useMemo(() => {
    const t = sinTildes(especie.trim());
    if (t.length < 2) return [];
    const lista = especies.filter((e) => sinTildes(e.nombre).includes(t));
    if (lista.length === 1 && sinTildes(lista[0].nombre) === t) return [];
    return lista.slice(0, 6);
  }, [especie, especies]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) setFotoUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Concede permiso de cámara para fotografiar la captura.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) setFotoUri(result.assets[0].uri);
  };

  const validar = (): boolean => {
    const e: Errores = {};
    if (!especie.trim()) e.especie = 'Indica la especie.';
    const p = num(peso);
    if (!peso.trim() || !isFinite(p) || p <= 0) e.peso = 'Peso en kg, mayor que 0.';
    const d = num(profundidad);
    if (!profundidad.trim() || !isFinite(d) || d < 0 || d > 150) e.profundidad = 'Profundidad entre 0 y 150 m.';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validar()) return;
    setSaving(true);
    try {
      let foto_url: string | null = null;
      if (fotoUri) {
        try {
          foto_url = await uploadPhoto(fotoUri, 'capturas');
        } catch (e: any) {
          console.warn('Fallo al subir foto:', e?.message);
        }
      }
      const created = await addCaptura({
        spot_id: spotId,
        especie: especie.trim(),
        peso_kg: num(peso),
        profundidad_m: num(profundidad),
        foto_url,
        notas: notas.trim() || null,
      });
      if (created) router.replace('/(tabs)/pesca');
    } catch {
      Alert.alert('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: 'Registrar captura' }} />

        <View style={card}>
          <ThemedText variant="h3">Foto</ThemedText>
          {fotoUri && <Image source={{ uri: fotoUri }} style={styles.preview} accessibilityLabel="Foto de la captura" />}
          <View style={styles.row}>
            <Button label="Cámara" icon="camera-outline" variant="secondary" style={{ flex: 1 }} onPress={takePhoto} />
            <Button label="Galería" icon="image-outline" variant="secondary" style={{ flex: 1 }} onPress={pickPhoto} />
          </View>
        </View>

        <View style={[card, { gap: spacing.s }]}>
          <ThemedText variant="h3">Datos de la captura</ThemedText>
          <Field
            label="Especie"
            value={especie}
            onChangeText={setEspecie}
            error={errores.especie}
            placeholder="dorada, lubina, mero…"
            autoCapitalize="sentences"
          />
          {sugerencias.length > 0 && (
            <View style={styles.chips}>
              {sugerencias.map((e) => (
                <Chip key={e.id} label={e.nombre} on={false} onPress={() => setEspecie(e.nombre)} />
              ))}
            </View>
          )}
          <View style={styles.row}>
            <Field grow label="Peso (kg)" value={peso} onChangeText={setPeso} keyboardType="decimal-pad" error={errores.peso} />
            <Field grow label="Profundidad (m)" value={profundidad} onChangeText={setProfundidad} keyboardType="decimal-pad" error={errores.profundidad} />
          </View>
          <Field label="Notas" hint="Opcional: marca del pez, condiciones del mar…" value={notas} onChangeText={setNotas} multiline />
        </View>

        {spots.length > 0 && (
          <View style={[card, { gap: spacing.s }]}>
            <ThemedText variant="h3">Spot (opcional)</ThemedText>
            <View style={styles.chips}>
              {spots.map((s) => (
                <Chip key={s.id} label={s.nombre} on={spotId === s.id} onPress={() => setSpotId(spotId === s.id ? null : s.id)} />
              ))}
            </View>
          </View>
        )}

        <Button label="Registrar captura" onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  row: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  preview: { height: 180, borderRadius: radii.m, marginTop: spacing.s },
});
