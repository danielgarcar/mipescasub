import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Alert } from '@/lib/alert';
import { ThemedText } from '@/components/ThemedText';
import { StatCard } from '@/components/StatCard';
import { Button, Field } from '@/components/ui';
import { palette, spacing } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Perfil } from '@/types';

/** El acceso (login/registro) vive en app/login.tsx: aquí solo se llega con sesión. */
export default function PerfilScreen() {
  const { user, signOut } = useAuth();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [nombre, setNombre] = useState('');
  const [club, setClub] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errNombre, setErrNombre] = useState<string | null>(null);

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

  const cancelar = () => {
    setNombre(perfil?.nombre ?? '');
    setClub(perfil?.club ?? '');
    setErrNombre(null);
    setEditing(false);
  };

  const savePerfil = async () => {
    if (!user) return;
    if (!nombre.trim()) return setErrNombre('Escribe tu nombre.');
    setErrNombre(null);
    setSaving(true);
    const { error } = await supabase
      .from('pescasub_perfiles')
      .upsert({ id: user.id, email: user.email ?? null, nombre: nombre.trim(), club: club.trim() || null });
    setSaving(false);
    if (error) Alert.alert('No se pudo guardar', 'Inténtalo de nuevo en unos segundos.');
    else {
      setPerfil({ ...perfil, id: user.id, nombre: nombre.trim(), club: club.trim() || null } as Perfil);
      setEditing(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing.m, gap: spacing.m }}>
      <View>
        <ThemedText variant="h1">{perfil?.nombre || 'Mi perfil'}</ThemedText>
        <ThemedText variant="small">{user?.email}</ThemedText>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Nombre" value={perfil?.nombre || '—'} />
        <StatCard label="Club" value={perfil?.club || '—'} />
      </View>

      {editing ? (
        <>
          <Field label="Nombre" value={nombre} onChangeText={setNombre} error={errNombre} autoCapitalize="words" />
          <Field label="Club" value={club} onChangeText={setClub} hint="Opcional" autoCapitalize="words" />
          <Button label="Guardar" onPress={savePerfil} loading={saving} />
          <Button label="Cancelar" variant="ghost" onPress={cancelar} />
        </>
      ) : (
        <Button label="Editar perfil" icon="create-outline" variant="secondary" onPress={() => setEditing(true)} />
      )}

      <Button label="Cerrar sesión" variant="danger" icon="log-out-outline" onPress={() => signOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  statsRow: { flexDirection: 'row', gap: spacing.s },
});
