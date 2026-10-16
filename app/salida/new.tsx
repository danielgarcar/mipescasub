import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { useLocation } from '@/hooks/useLocation';
import { useSpots } from '@/hooks/useSpots';
import { buscarUsuario, crearSalida, fmtDiaHora } from '@/hooks/useSalidas';
import { ThemedText } from '@/components/ThemedText';
import { Button, Chip, Field, Segmented, Stepper } from '@/components/ui';
import { card, palette, radii, spacing } from '@/lib/theme';
import type { VisibilidadSalida } from '@/types';

type Lugar = { spotId: string | null; lat: number; lng: number; nombre: string };

const SALIDAS: { key: string; label: string; fecha: () => Date }[] = [
  { key: 'ahora', label: 'Ahora', fecha: () => new Date() },
  { key: '1h', label: 'En 1 h', fecha: () => new Date(Date.now() + 3_600_000) },
  { key: '2h', label: 'En 2 h', fecha: () => new Date(Date.now() + 7_200_000) },
  {
    key: 'manana',
    label: 'Mañana 8:00',
    fecha: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
      return d;
    },
  },
];

const EXPLICA: Record<VisibilidadSalida, string> = {
  privada: 'Solo tú ves esta salida. Útil para llevar tu propio control de la hora de vuelta.',
  usuarios: 'Solo los usuarios que añadas verán tu nombre, la zona aproximada y la hora de vuelta.',
  publica: 'Cualquier usuario verá una zona aproximada y la hora, sin tu nombre.',
};

export default function SalidaNewScreen() {
  const router = useRouter();
  const { spots } = useSpots();
  const { coords, locate } = useLocation(false);

  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [salidaKey, setSalidaKey] = useState('1h');
  const [duracion, setDuracion] = useState(180); // minutos
  const [personas, setPersonas] = useState(1);
  const [visibilidad, setVisibilidad] = useState<VisibilidadSalida>('usuarios');
  const [email, setEmail] = useState('');
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([]);
  const [errEmail, setErrEmail] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [notas, setNotas] = useState('');
  const [errLugar, setErrLugar] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [quiereUbicacion, setQuiereUbicacion] = useState(false);

  // "Mi ubicación": cuando llega la posición se fija como lugar.
  useEffect(() => {
    if (quiereUbicacion && coords) {
      setLugar({ spotId: null, lat: coords.latitude, lng: coords.longitude, nombre: 'Mi ubicación' });
      setErrLugar(null);
      setQuiereUbicacion(false);
    }
  }, [quiereUbicacion, coords]);

  const inicio = useMemo(() => SALIDAS.find((s) => s.key === salidaKey)!.fecha(), [salidaKey]);
  const fin = useMemo(() => new Date(inicio.getTime() + duracion * 60_000), [inicio, duracion]);
  const fmtDur = `${Math.floor(duracion / 60)} h${duracion % 60 ? ` ${duracion % 60} min` : ''}`;

  const anadirUsuario = async () => {
    setErrEmail(null);
    if (!email.trim()) return;
    setBuscando(true);
    try {
      const u = await buscarUsuario(email);
      if (usuarios.some((x) => x.id === u.id)) setErrEmail('Ya lo has añadido.');
      else {
        setUsuarios([...usuarios, u]);
        setEmail('');
      }
    } catch (e: any) {
      setErrEmail(e?.message ?? 'No se pudo buscar.');
    } finally {
      setBuscando(false);
    }
  };

  const crear = async () => {
    if (!lugar) return setErrLugar('Elige dónde vas a pescar.');
    if (visibilidad === 'usuarios' && usuarios.length === 0) {
      return setErrEmail('Añade al menos un usuario, o cambia la visibilidad.');
    }
    setGuardando(true);
    try {
      const id = await crearSalida({
        spot_id: lugar.spotId, lat: lugar.lat, lng: lugar.lng,
        inicio, fin_previsto: fin, visibilidad, personas, notas, usuarios: usuarios.map((u) => u.id),
      });
      router.replace({ pathname: '/salida/[id]', params: { id } });
    } catch {
      Alert.alert('No se pudo crear', 'Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ padding: spacing.m, gap: spacing.m, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: 'Planear salida' }} />

        <View style={[card, { gap: spacing.s }]}>
          <ThemedText variant="h3">¿Dónde?</ThemedText>
          <View style={styles.chips}>
            <Chip
              label="Mi ubicación"
              on={lugar?.nombre === 'Mi ubicación'}
              onPress={() => {
                if (coords) {
                  setLugar({ spotId: null, lat: coords.latitude, lng: coords.longitude, nombre: 'Mi ubicación' });
                  setErrLugar(null);
                } else {
                  setQuiereUbicacion(true);
                  locate();
                }
              }}
            />
            {spots.map((s) => (
              <Chip
                key={s.id}
                label={s.nombre}
                on={lugar?.spotId === s.id}
                onPress={() => { setLugar({ spotId: s.id, lat: s.lat, lng: s.lng, nombre: s.nombre }); setErrLugar(null); }}
              />
            ))}
          </View>
          {errLugar ? <Text style={styles.err}>{errLugar}</Text> : null}
          <ThemedText variant="small">El punto exacto solo lo ves tú. Los demás ven una zona de unos 2 km.</ThemedText>
        </View>

        <View style={[card, { gap: spacing.s }]}>
          <ThemedText variant="h3">¿Cuándo?</ThemedText>
          <View style={styles.chips}>
            {SALIDAS.map((s) => (
              <Chip key={s.key} label={s.label} on={salidaKey === s.key} onPress={() => setSalidaKey(s.key)} />
            ))}
          </View>
          <Stepper
            label="Duración prevista"
            value={fmtDur}
            onMinus={() => setDuracion((d) => Math.max(30, d - 30))}
            onPlus={() => setDuracion((d) => Math.min(720, d + 30))}
            minusLabel="30 minutos menos"
            plusLabel="30 minutos más"
          />
          <ThemedText variant="small">Salida {fmtDiaHora(inicio.toISOString())} · vuelta prevista {fmtDiaHora(fin.toISOString())}</ThemedText>
        </View>

        <View style={[card, { gap: spacing.s }]}>
          <ThemedText variant="h3">¿Con quién?</ThemedText>
          <Stepper
            label="Personas en total"
            value={String(personas)}
            onMinus={() => setPersonas((p) => Math.max(1, p - 1))}
            onPlus={() => setPersonas((p) => Math.min(20, p + 1))}
            minusLabel="Una persona menos"
            plusLabel="Una persona más"
          />
        </View>

        <View style={[card, { gap: spacing.s }]}>
          <ThemedText variant="h3">¿Quién puede verlo?</ThemedText>
          <Segmented
            value={visibilidad}
            onChange={setVisibilidad}
            options={[{ key: 'privada', label: 'Nadie' }, { key: 'usuarios', label: 'Elegidos' }, { key: 'publica', label: 'Todos' }]}
          />
          <ThemedText variant="small">{EXPLICA[visibilidad]}</ThemedText>

          {visibilidad === 'usuarios' && (
            <>
              <View style={styles.fila}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Añadir por email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={errEmail}
                    onSubmitEditing={anadirUsuario}
                  />
                </View>
                <Button label="Añadir" compact variant="secondary" onPress={anadirUsuario} loading={buscando} style={{ marginTop: 21 }} />
              </View>
              {usuarios.map((u) => (
                <View key={u.id} style={styles.usuario}>
                  <Ionicons name="person-circle-outline" size={22} color={palette.foamSoft} />
                  <Text style={styles.usuarioTxt}>{u.nombre}</Text>
                  <Button label="Quitar" compact variant="ghost" onPress={() => setUsuarios(usuarios.filter((x) => x.id !== u.id))} />
                </View>
              ))}
            </>
          )}
          {visibilidad === 'publica' && (
            <View style={styles.aviso}>
              <Ionicons name="information-circle-outline" size={18} color={palette.pinPoint} />
              <ThemedText variant="small" style={{ flex: 1, color: palette.foam }}>
                Cualquier usuario con cuenta verá la zona y la hora. No verá tu nombre ni el punto exacto.
              </ThemedText>
            </View>
          )}
        </View>

        <Field label="Notas" hint="Opcional: punto de encuentro, matrícula del barco…" value={notas} onChangeText={setNotas} multiline maxLength={300} />

        <Button label="Crear salida" onPress={crear} loading={guardando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  fila: { flexDirection: 'row', gap: spacing.s, alignItems: 'flex-start' },
  usuario: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  usuarioTxt: { flex: 1, color: palette.foam, fontSize: 16 },
  err: { color: palette.coral, fontSize: 13 },
  aviso: { flexDirection: 'row', gap: spacing.s, padding: spacing.s, borderRadius: radii.m, borderWidth: 1, borderColor: palette.pinPoint },
});
