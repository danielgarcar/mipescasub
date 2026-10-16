import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { compartirSpot, dejarDeCompartir, fetchCompartidos, setSpotPublico } from '@/hooks/useSpots';
import { palette, card, spacing, radii } from '@/lib/theme';
import type { Compartido } from '@/types';

type Props = { spotId: string; publico: boolean; onChange: (publico: boolean) => void };

/** Panel del dueño: spot público o privado y, si es privado, con quién se comparte. */
export function SpotAcceso({ spotId, publico, onChange }: Props) {
  const [guardando, setGuardando] = useState(false);
  const [compartidos, setCompartidos] = useState<Compartido[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const cargar = useCallback(async () => setCompartidos(await fetchCompartidos(spotId)), [spotId]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiar = async (nuevo: boolean) => {
    if (nuevo === publico || guardando) return;
    setGuardando(true);
    setMsg(null);
    try {
      await setSpotPublico(spotId, nuevo);
      onChange(nuevo);
    } catch (e: any) {
      setMsg({ ok: false, texto: e?.message ?? 'No se pudo cambiar la visibilidad.' });
    } finally {
      setGuardando(false);
    }
  };

  const compartir = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const nombre = await compartirSpot(spotId, email);
      setEmail('');
      setMsg({ ok: true, texto: `Compartido con ${nombre}.` });
      await cargar();
    } catch (e: any) {
      setMsg({ ok: false, texto: e?.message ?? 'No se pudo compartir.' });
    } finally {
      setBusy(false);
    }
  };

  const quitar = async (userId: string) => {
    try {
      await dejarDeCompartir(spotId, userId);
      await cargar();
    } catch (e: any) {
      setMsg({ ok: false, texto: e?.message ?? 'No se pudo quitar el acceso.' });
    }
  };

  return (
    <View style={card}>
      <ThemedText variant="h3">Visibilidad</ThemedText>

      <View style={styles.segment}>
        {([[false, 'lock-closed', 'Privado'], [true, 'earth', 'Público']] as const).map(([val, icon, label]) => (
          <Pressable key={label} style={[styles.segBtn, publico === val && styles.segActive]} onPress={() => cambiar(val)}>
            <Ionicons name={icon} size={15} color={publico === val ? palette.deep : palette.foamSoft} />
            <Text style={[styles.segText, publico === val && { color: palette.deep }]}>{label}</Text>
          </Pressable>
        ))}
        {guardando && <ActivityIndicator color={palette.buoy} style={{ marginLeft: 8 }} />}
      </View>
      <ThemedText variant="small">
        {publico
          ? 'Cualquier usuario puede ver este spot y comentar en él.'
          : 'Solo tú y las personas con las que lo compartas pueden verlo y comentar.'}
      </ThemedText>

      {!publico && (
        <View style={{ gap: spacing.s, marginTop: spacing.s }}>
          <ThemedText variant="body" style={{ fontWeight: '700' }}>Compartir con usuarios</ThemedText>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="Email del usuario"
              placeholderTextColor={palette.foamSoft}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={compartir}
            />
            <Pressable style={[styles.addBtn, busy && { opacity: 0.6 }]} onPress={compartir} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="person-add" size={18} color="#fff" />}
            </Pressable>
          </View>
          {msg && <Text style={{ color: msg.ok ? palette.ok : palette.coral, fontSize: 12 }}>{msg.texto}</Text>}

          {compartidos.length === 0 ? (
            <ThemedText variant="small">Todavía no lo has compartido con nadie.</ThemedText>
          ) : (
            compartidos.map((c) => (
              <View key={c.user_id} style={styles.userRow}>
                <Ionicons name="person-circle-outline" size={22} color={palette.foamSoft} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{c.nombre}</Text>
                  {!!c.email && <Text style={styles.userMail}>{c.email}</Text>}
                </View>
                <Pressable onPress={() => quitar(c.user_id)} accessibilityLabel={`Quitar a ${c.nombre}`} hitSlop={8}>
                  <Ionicons name="close-circle" size={22} color={palette.coral} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  segBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: spacing.m,
    borderRadius: radii.pill, borderWidth: 1, borderColor: palette.line,
  },
  segActive: { backgroundColor: palette.buoy, borderColor: palette.buoy },
  segText: { color: palette.foamSoft, fontWeight: '700', fontSize: 13 },
  addRow: { flexDirection: 'row', gap: spacing.s },
  input: {
    flex: 1, backgroundColor: palette.abyss, borderRadius: radii.s, color: palette.foam, borderWidth: 1,
    borderColor: palette.line, paddingHorizontal: spacing.m, paddingVertical: 10,
  },
  addBtn: { backgroundColor: palette.buoy, borderRadius: radii.s, width: 46, alignItems: 'center', justifyContent: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: 4 },
  userName: { color: palette.foam, fontSize: 14, fontWeight: '600' },
  userMail: { color: palette.foamSoft, fontSize: 11 },
});
