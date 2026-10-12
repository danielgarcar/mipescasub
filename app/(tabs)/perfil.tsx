import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Pressable, Text } from 'react-native';
import { Alert } from '@/lib/alert';
import { ThemedText } from '@/components/ThemedText';
import { StatCard } from '@/components/StatCard';
import { palette, card, spacing } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Perfil } from '@/types';

export default function PerfilScreen() {
  const { user, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [nombre, setNombre] = useState('');
  const [club, setClub] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('pescasub_perfiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const p = data as unknown as Perfil;
          setPerfil(p);
          setNombre(p.nombre ?? '');
          setClub(p.club ?? '');
        }
      });
  }, [user]);

  const savePerfil = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('pescasub_perfiles')
      .upsert({ id: user.id, email: user.email ?? null, nombre: nombre.trim() || (user.email ?? 'Pescador'), club: club.trim() || null });
    if (error) Alert.alert('Error', error.message);
    else {
      Alert.alert('Guardado', 'Perfil actualizado.');
      setPerfil({ ...perfil, id: user.id, nombre: nombre.trim(), club: club.trim() || null } as Perfil);
      setEditing(false);
    }
  };

  const doLogin = async () => {
    const { error } = await signIn(email.trim(), password);
    if (error) Alert.alert('Error de acceso', error.message);
  };

  const doSignUp = async () => {
    const { error } = await signUp(email.trim(), password);
    if (error) Alert.alert('Error de registro', error.message);
    else Alert.alert('Registro ok', 'Revisa tu email para confirmar la cuenta.');
  };

  if (!user) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}>
        <ThemedText variant="h1">Acceso</ThemedText>
        <ThemedText variant="body">Inicia sesión para sincronizar spots y capturas.</ThemedText>
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor={palette.foamSoft}
          autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor={palette.foamSoft}
          secureTextEntry value={password} onChangeText={setPassword} />
        <Pressable style={styles.btn} onPress={doLogin}>
          <Text style={styles.btnText}>Entrar</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={doSignUp}>
          <Text style={[styles.btnText, { color: palette.foam }]}>Crear cuenta</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}>
      <ThemedText variant="h1">Mi perfil</ThemedText>
      <ThemedText variant="small">{user.email}</ThemedText>

      <View style={styles.statsRow}>
        <StatCard label="Nombre" value={perfil?.nombre || '—'} />
        <StatCard label="Club" value={perfil?.club || '—'} />
      </View>

      {editing ? (
        <>
          <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor={palette.foamSoft}
            value={nombre} onChangeText={setNombre} />
          <TextInput style={styles.input} placeholder="Club" placeholderTextColor={palette.foamSoft}
            value={club} onChangeText={setClub} />
          <Pressable style={styles.btn} onPress={savePerfil}>
            <Text style={styles.btnText}>Guardar</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.btn} onPress={() => setEditing(true)}>
          <Text style={styles.btnText}>Editar perfil</Text>
        </Pressable>
      )}

      <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => signOut()}>
        <Text style={[styles.btnText, { color: palette.coral }]}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  statsRow: { flexDirection: 'row', gap: spacing.s },
  input: {
    backgroundColor: palette.surface, borderRadius: 8,
    color: palette.foam, paddingHorizontal: spacing.m, paddingVertical: spacing.s,
    borderWidth: 1, borderColor: palette.line,
  },
  btn: { backgroundColor: palette.coral, padding: spacing.m, borderRadius: 8, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.coral },
  btnText: { color: palette.foam, fontWeight: '700', fontSize: 15 },
});
