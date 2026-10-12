import { useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Pressable, Text, Image } from 'react-native';
import { Alert } from '@/lib/alert';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { addCaptura, uploadPhoto } from '@/hooks/useSpots';
import { ThemedText } from '@/components/ThemedText';
import { palette, spacing, radii, card } from '@/lib/theme';

export default function CapturaNewScreen() {
  const router = useRouter();

  const [especie, setEspecie] = useState('');
  const [peso, setPeso] = useState('');
  const [profundidad, setProfundidad] = useState('');
  const [notas, setNotas] = useState('');
  const [spotId, setSpotId] = useState<string | null>(null);
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      setFotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Concede permiso de cámara para fotografiar la captura.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) {
      setFotoUri(result.assets[0].uri);
    }
  };

  const save = async () => {
    if (!especie.trim() || !peso || !profundidad) {
      Alert.alert('Faltan datos', 'Especie, peso y profundidad son obligatorios.');
      return;
    }
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
        peso_kg: parseFloat(peso),
        profundidad_m: parseFloat(profundidad),
        foto_url,
        notas: notas.trim() || null,
      });
      if (created) {
        Alert.alert('Captura registrada', 'Tu pesca ha sido guardada.');
        router.replace('/(tabs)/pesca');
      }
    } catch (e: any) {
      Alert.alert('Error al guardar', e?.message ?? 'No se pudo registrar la captura.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}>
      <Stack.Screen options={{ title: 'Registrar captura' }} />

      {/* Foto */}
      <View style={card}>
        <ThemedText variant="h3">Foto</ThemedText>
        {fotoUri && <Image source={{ uri: fotoUri }} style={styles.preview} />}
        <View style={styles.photoBtns}>
          <Pressable style={styles.btnMini} onPress={takePhoto}>
            <Text style={styles.btnMiniText}>📷 Cámara</Text>
          </Pressable>
          <Pressable style={styles.btnMini} onPress={pickPhoto}>
            <Text style={styles.btnMiniText}>🖼 Galería</Text>
          </Pressable>
        </View>
      </View>

      {/* Datos */}
      <View style={card}>
        <ThemedText variant="h3">Datos de la captura</ThemedText>
        <TextInput style={styles.input} placeholder="Especie (dorada, lubina, mero...)" placeholderTextColor={palette.foamSoft}
          value={especie} onChangeText={setEspecie} />
        <View style={styles.row2}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Peso (kg)" placeholderTextColor={palette.foamSoft}
            keyboardType="decimal-pad" value={peso} onChangeText={setPeso} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Profundidad (m)" placeholderTextColor={palette.foamSoft}
            keyboardType="decimal-pad" value={profundidad} onChangeText={setProfundidad} />
        </View>
        <TextInput style={styles.input} placeholder="Spot (opcional)" placeholderTextColor={palette.foamSoft}
          value={spotId ?? ''} onChangeText={(v) => setSpotId(v || null)} />
        <TextInput style={[styles.input, styles.inputMulti]} placeholder="Notas (marca del pez, condiciones del mar...)"
          placeholderTextColor={palette.foamSoft} multiline value={notas} onChangeText={setNotas} />
      </View>

      <Pressable style={[styles.btn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Guardando…' : 'Registrar captura'}</Text>
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
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  btnMini: {
    backgroundColor: palette.highlight, borderRadius: radii.s,
    paddingVertical: 8, paddingHorizontal: spacing.m,
  },
  btnMiniText: { color: palette.foam, fontSize: 14 },
  photoBtns: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  preview: { height: 160, borderRadius: radii.m, marginTop: spacing.s },
  btn: { backgroundColor: palette.coral, padding: spacing.m, borderRadius: 8, alignItems: 'center' },
  btnText: { color: palette.foam, fontWeight: '700', fontSize: 16 },
});
