import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '@/lib/alert';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { useLocation } from '@/hooks/useLocation';
import { addSpot, uploadPhoto } from '@/hooks/useSpots';
import { ThemedText } from '@/components/ThemedText';
import { Button, Chip, Field, Segmented } from '@/components/ui';
import { palette, spacing, radii, card } from '@/lib/theme';
import type { SpotFondo } from '@/types';

const FONDOS: { key: SpotFondo; label: string }[] = [
  { key: 'roca', label: 'Roca' },
  { key: 'roca-arena', label: 'Roca + arena' },
  { key: 'arena', label: 'Arena' },
  { key: 'posidonia', label: 'Posidonia' },
  { key: 'mixto', label: 'Mixto' },
  { key: 'casco-hundimiento', label: 'Pecio' },
];

const num = (v: string) => parseFloat(v.replace(',', '.'));

type Errores = { nombre?: string; lat?: string; lng?: string; prof?: string };

export default function SpotNewScreen() {
  const router = useRouter();
  // Si se llega con una pulsación larga en el mapa, la posición ya viene fijada.
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const { coords, locate } = useLocation(false);

  const [nombre, setNombre] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState(params.lat ?? '');
  const [lng, setLng] = useState(params.lng ?? '');
  const [profMax, setProfMax] = useState('');
  const [fondo, setFondo] = useState<SpotFondo>('roca');
  const [fotos, setFotos] = useState<string[]>([]);
  const [publico, setPublico] = useState<'privado' | 'publico'>('privado');
  const [saving, setSaving] = useState(false);
  const [errores, setErrores] = useState<Errores>({});

  // Sin posición previa se rellena con la del dispositivo cuando llega.
  useEffect(() => {
    if (coords && !params.lat) {
      setLat(coords.latitude.toFixed(6));
      setLng(coords.longitude.toFixed(6));
    }
  }, [coords, params.lat]);

  const la = num(lat);
  const ln = num(lng);
  const hayPunto = isFinite(la) && isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180;

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
    });
    if (!result.canceled && result.assets.length > 0) setFotos(result.assets.map((a) => a.uri));
  };

  const validar = (): boolean => {
    const e: Errores = {};
    if (!nombre.trim()) e.nombre = 'Ponle un nombre al spot.';
    if (!lat.trim() || !isFinite(la) || Math.abs(la) > 90) e.lat = 'Latitud entre −90 y 90.';
    if (!lng.trim() || !isFinite(ln) || Math.abs(ln) > 180) e.lng = 'Longitud entre −180 y 180.';
    if (profMax.trim() && (!isFinite(num(profMax)) || num(profMax) <= 0)) e.prof = 'Profundidad en metros.';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const uploadAndCreate = async () => {
    if (!validar()) return;
    setSaving(true);
    try {
      const uploaded: string[] = [];
      for (const uri of fotos) {
        try {
          const url = await uploadPhoto(uri, 'spots');
          if (url) uploaded.push(url);
        } catch (e: any) {
          console.warn('Fallo al subir foto:', e?.message);
        }
      }
      const created = await addSpot({
        nombre: nombre.trim(),
        description: description.trim() || null,
        lat: la,
        lng: ln,
        fondo,
        profundidad_max: profMax.trim() ? num(profMax) : null,
        fotos: uploaded.length > 0 ? uploaded : null,
        publico: publico === 'publico',
      });
      if (created) router.replace('/');
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
        <Stack.Screen options={{ title: 'Nuevo spot' }} />

        <View style={[card, { gap: spacing.s }]}>
          <ThemedText variant="h3">Ubicación</ThemedText>
          {hayPunto && (
            <MapView
              style={styles.miniMap}
              region={{ latitude: la, longitude: ln, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
              onPress={(e: any) => {
                const c = e.nativeEvent.coordinate;
                setLat(c.latitude.toFixed(6));
                setLng(c.longitude.toFixed(6));
              }}
            >
              <Marker coordinate={{ latitude: la, longitude: ln }} pinColor={palette.buoy} />
            </MapView>
          )}
          {hayPunto && <ThemedText variant="small">Toca el mapa para mover el punto.</ThemedText>}
          <View style={styles.row}>
            <Field grow label="Latitud" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" error={errores.lat} />
            <Field grow label="Longitud" value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" error={errores.lng} />
          </View>
          <Button label="Usar mi ubicación" icon="locate" variant="secondary" compact onPress={locate} />
        </View>

        <View style={[card, { gap: spacing.s }]}>
          <ThemedText variant="h3">Información</ThemedText>
          <Field label="Nombre" value={nombre} onChangeText={setNombre} error={errores.nombre} autoCapitalize="sentences" />
          <Field
            label="Descripción"
            hint="Accesos, particularidades del fondo…"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Field
            label="Profundidad máxima (m)"
            hint="Opcional"
            value={profMax}
            onChangeText={setProfMax}
            keyboardType="decimal-pad"
            error={errores.prof}
          />
        </View>

        <View style={[card, { gap: spacing.s }]}>
          <ThemedText variant="h3">Tipo de fondo</ThemedText>
          <View style={styles.chips}>
            {FONDOS.map((f) => (
              <Chip key={f.key} label={f.label} on={fondo === f.key} onPress={() => setFondo(f.key)} />
            ))}
          </View>
        </View>

        <View style={[card, { gap: spacing.s }]}>
          <ThemedText variant="h3">Quién puede verlo</ThemedText>
          <Segmented
            value={publico}
            onChange={setPublico}
            options={[{ key: 'privado', label: 'Privado' }, { key: 'publico', label: 'Público' }]}
          />
          <ThemedText variant="small">
            {publico === 'publico'
              ? 'Cualquier usuario podrá verlo y comentar en él.'
              : 'Solo tú lo verás. Después podrás compartirlo con usuarios concretos desde el propio spot.'}
          </ThemedText>
        </View>

        <View style={[card, { gap: spacing.s }]}>
          <ThemedText variant="h3">Fotos</ThemedText>
          <Button label="Elegir fotos" icon="images-outline" variant="secondary" compact onPress={pickPhoto} />
          <ThemedText variant="small">{fotos.length > 0 ? `${fotos.length} foto(s) seleccionada(s)` : 'Sin fotos todavía'}</ThemedText>
        </View>

        <Button label="Crear spot" onPress={uploadAndCreate} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  row: { flexDirection: 'row', gap: spacing.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  miniMap: { height: 180, borderRadius: radii.m, borderWidth: 1, borderColor: palette.line },
});
