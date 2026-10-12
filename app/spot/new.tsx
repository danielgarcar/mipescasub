import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Pressable, Text, Switch } from 'react-native';
import { Alert } from '@/lib/alert';
import { useRouter, Stack } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { useLocation } from '@/hooks/useLocation';
import { addSpot, uploadPhoto } from '@/hooks/useSpots';
import { ThemedText } from '@/components/ThemedText';
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

export default function SpotNewScreen() {
  const router = useRouter();
  const { coords, locate } = useLocation(false);

  const [nombre, setNombre] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [profMax, setProfMax] = useState('');
  const [fondo, setFondo] = useState<SpotFondo>('roca');
  const [fotos, setFotos] = useState<string[]>([]);
  const [publico, setPublico] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (coords) {
      setLat(coords.latitude.toFixed(6));
      setLng(coords.longitude.toFixed(6));
    }
  }, [coords]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      setFotos(result.assets.map((a) => a.uri));
    }
  };

  const uploadAndCreate = async () => {
    if (!nombre.trim() || !lat || !lng) {
      Alert.alert('Faltan datos', 'Nombre, latitud y longitud son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      // Subir imágenes (opcional) al bucket 'fotos-pesca'
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
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        fondo,
        profundidad_max: profMax ? parseFloat(profMax) : null,
        fotos: uploaded.length > 0 ? uploaded : null,
        publico,
      });
      if (created) {
        Alert.alert('Spot creado', 'Añadido a tu mapa de spots.');
        router.replace('/');
      }
    } catch (e: any) {
      Alert.alert('Error al guardar', e?.message ?? 'No se pudo crear el spot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}>
      <Stack.Screen options={{ title: 'Nuevo spot' }} />

      {/* Geolocalización */}
      <View style={card}>
        <ThemedText variant="h3">Ubicación</ThemedText>
        <View style={styles.row2}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Lat" placeholderTextColor={palette.foamSoft}
            keyboardType="numbers-and-punctuation" value={lat} onChangeText={setLat} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Lng" placeholderTextColor={palette.foamSoft}
            keyboardType="numbers-and-punctuation" value={lng} onChangeText={setLng} />
        </View>
        <Pressable style={styles.btnMini} onPress={locate}>
          <Text style={styles.btnMiniText}>📍 Usar mi ubicación</Text>
        </Pressable>
        {coords && (
          <MapView
            style={styles.miniMap}
            initialRegion={{ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
          >
            <Marker coordinate={{ latitude: coords.latitude, longitude: coords.longitude }} pinColor={palette.buoy} />
          </MapView>
        )}
      </View>

      {/* Info */}
      <View style={card}>
        <ThemedText variant="h3">Información</ThemedText>
        <TextInput style={styles.input} placeholder="Nombre del spot" placeholderTextColor={palette.foamSoft}
          value={nombre} onChangeText={setNombre} />
        <TextInput style={[styles.input, styles.inputMulti]} placeholder="Descripción (accesos, particularidades del fondo...)"
          placeholderTextColor={palette.foamSoft} multiline value={description} onChangeText={setDescription} />
        <TextInput style={styles.input} placeholder="Profundidad máxima (m) — opcional"
          placeholderTextColor={palette.foamSoft} keyboardType="decimal-pad" value={profMax} onChangeText={setProfMax} />
      </View>

      {/* Tipo de fondo */}
      <View style={card}>
        <ThemedText variant="h3">Tipo de fondo</ThemedText>
        <View style={styles.fondoGrid}>
          {FONDOS.map((f) => (
            <Pressable key={f.key} style={[styles.fondoBtn, fondo === f.key && styles.fondoActive]} onPress={() => setFondo(f.key)}>
              <Text style={[styles.fondoText, fondo === f.key && { color: palette.deep, fontWeight: '700' }]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Visibilidad */}
      <View style={card}>
        <ThemedText variant="h3">Quién puede verlo</ThemedText>
        <View style={styles.fondoGrid}>
          {([[false, '🔒 Privado'], [true, '🌐 Público']] as const).map(([val, label]) => (
            <Pressable key={label} style={[styles.fondoBtn, publico === val && styles.fondoActive]} onPress={() => setPublico(val)}>
              <Text style={[styles.fondoText, publico === val && { color: palette.deep, fontWeight: '700' }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <ThemedText variant="small">
          {publico
            ? 'Cualquier usuario podrá verlo y comentar en él.'
            : 'Solo tú lo verás. Después podrás compartirlo con usuarios concretos desde el propio spot.'}
        </ThemedText>
      </View>

      {/* Fotos */}
      <View style={card}>
        <ThemedText variant="h3">Fotos</ThemedText>
        <Pressable style={styles.btnMini} onPress={pickPhoto}>
          <Text style={styles.btnMiniText}>🖼 Elegir fotos</Text>
        </Pressable>
        <ThemedText variant="small">{fotos.length > 0 ? `${fotos.length} foto(s) seleccionada(s)` : 'Sin fotos todavía'}</ThemedText>
      </View>

      <Pressable style={[styles.btn, saving && { opacity: 0.6 }]} onPress={uploadAndCreate} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Guardando…' : 'Crear spot'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  row2: { flexDirection: 'row', gap: spacing.s },
  input: {
    backgroundColor: palette.surface, borderRadius: 8, color: palette.foam,
    paddingHorizontal: spacing.m, paddingVertical: spacing.s,
    borderWidth: 1, borderColor: palette.line,
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
  btnMini: {
    backgroundColor: palette.highlight, borderRadius: radii.s,
    paddingVertical: 8, paddingHorizontal: spacing.m, alignSelf: 'flex-start',
  },
  btnMiniText: { color: palette.foam, fontSize: 14 },
  miniMap: { height: 140, borderRadius: radii.s, marginTop: spacing.s, borderWidth: 1, borderColor: palette.line },
  fondoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  fondoBtn: {
    paddingVertical: 8, paddingHorizontal: spacing.m, borderRadius: radii.pill,
    backgroundColor: palette.abyss, borderWidth: 1, borderColor: palette.line,
  },
  fondoActive: { backgroundColor: palette.buoy, borderColor: palette.buoy },
  fondoText: { color: palette.foam, fontSize: 14 },
  btn: { backgroundColor: palette.coral, padding: spacing.m, borderRadius: 8, alignItems: 'center' },
  btnText: { color: palette.foam, fontWeight: '700', fontSize: 16 },
});
