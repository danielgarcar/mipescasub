import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { terminarRecuperacion, useAuth } from '@/hooks/useAuth';
import { OceanBackground } from '@/components/OceanBackground';
import { palette, spacing } from '@/lib/theme';

type Modo = 'entrar' | 'registro' | 'recuperar' | 'nueva';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLAVE_EMAIL = 'mipescasub.email';

/** Fuerza de la contraseña de 0 a 4 (longitud, mayúsculas/minúsculas, números, símbolos). */
function fuerza(p: string): number {
  let n = 0;
  if (p.length >= 6) n++;
  if (p.length >= 10) n++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) n++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) n++;
  return n;
}
const FUERZA_TXT = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];
const FUERZA_COLOR = ['#ff6b57', '#ff6b57', '#ffc24b', '#7bd88f', '#2ed3a8'];

/** Recuerda el último email usado (solo web; con try/catch porque el almacenamiento puede estar bloqueado). */
const emailGuardado = () => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(CLAVE_EMAIL) ?? '' : '';
  } catch {
    return '';
  }
};
const guardarEmail = (v: string) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CLAVE_EMAIL, v);
  } catch {
    /* sin almacenamiento */
  }
};

const NATIVE = Platform.OS !== 'web'; // useNativeDriver solo en móvil

/** Traduce los errores habituales de Supabase Auth. */
function mensaje(err: { message: string } | null): string {
  const m = err?.message ?? '';
  if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Confirma tu email (revisa tu bandeja) antes de entrar.';
  if (/already registered|already been registered/i.test(m)) return 'Ya existe una cuenta con ese email.';
  if (/password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
  if (/valid email|invalid email/i.test(m)) return 'El email no es válido.';
  if (/network|fetch/i.test(m)) return 'Sin conexión con el servidor.';
  return m || 'Ha ocurrido un error.';
}

/** Crea la fila de `pescasub_perfiles` si todavía no existe (nombre es obligatorio). */
async function asegurarPerfil(userId: string, email: string | null, nombre: string) {
  const { data } = await supabase.from('pescasub_perfiles').select('id').eq('id', userId).maybeSingle();
  if (!data) {
    await supabase.from('pescasub_perfiles').insert({ id: userId, email, nombre: nombre || email || 'Pescador' });
  }
}

/** Aparece deslizándose desde abajo con fundido; `delay` escalona los elementos. */
function Entrada({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: any }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 650, delay, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

/** Logo flotante con ondas que se expanden, como un sonar. */
function Logo() {
  const float = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    ).start();
    Animated.loop(Animated.timing(ring, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE })).start();
  }, [float, ring]);

  const onda = (offset: number) => ({
    opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55 - offset * 0.2, 0] }),
    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1 + offset * 0.2, 2.1 + offset * 0.3] }) }],
  });

  return (
    <Animated.View
      style={[styles.logoWrap, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) }] }]}
    >
      <Animated.View style={[styles.logoRing, onda(0)]} />
      <Animated.View style={[styles.logoRing, onda(1)]} />
      <View style={[styles.badge, glassBadge as any]}>
        <Ionicons name="fish" size={34} color={palette.buoy} />
      </View>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [verPass, setVerPass] = useState(false);
  const { recovery } = useAuth();

  // Email recordado de la última vez (solo web).
  useEffect(() => {
    const e = emailGuardado();
    if (e) setEmail(e);
  }, []);
  // Si se llega desde el enlace del email de recuperar contraseña, toca elegir una nueva.
  useEffect(() => {
    if (recovery) setModo('nueva');
  }, [recovery]);
  const [foco, setFoco] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const press = useRef(new Animated.Value(0)).current;

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setError(null);
    setInfo(null);
  };

  const enviar = async () => {
    setError(null);
    setInfo(null);
    const mail = email.trim();
    if (modo !== 'nueva') {
      if (!mail) return setError('Escribe tu email.');
      if (!EMAIL_RE.test(mail)) return setError('El email no parece válido.');
    }
    if (modo !== 'recuperar' && password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (modo === 'registro' && !nombre.trim()) return setError('Escribe tu nombre.');
    if ((modo === 'registro' || modo === 'nueva') && password !== repetir) return setError('Las contraseñas no coinciden.');

    setBusy(true);
    try {
      if (modo === 'nueva') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return setError(mensaje(error));
        terminarRecuperacion(); // la sesión ya existe: el guard del layout abre la app
        return;
      }
      if (modo !== 'recuperar') guardarEmail(mail);
      if (modo === 'entrar') {
        const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) return setError(mensaje(error));
        if (data.user) {
          await asegurarPerfil(data.user.id, data.user.email ?? null, String(data.user.user_metadata?.nombre ?? ''));
        }
        // El guard del layout lleva a la app al detectar la sesión.
      } else if (modo === 'registro') {
        const { data, error } = await supabase.auth.signUp({
          email: mail,
          password,
          options: { data: { nombre: nombre.trim() } },
        });
        if (error) return setError(mensaje(error));
        if (data.session && data.user) {
          await asegurarPerfil(data.user.id, data.user.email ?? null, nombre.trim());
        } else {
          setInfo('Cuenta creada. Te hemos enviado un email: confírmalo y luego inicia sesión.');
          setModo('entrar');
        }
      } else {
        const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo });
        if (error) return setError(mensaje(error));
        setInfo('Si el email existe, recibirás un enlace para restablecer la contraseña.');
      }
    } catch (e: any) {
      setError(mensaje(e));
    } finally {
      setBusy(false);
    }
  };

  const TEXTOS: Record<Modo, { titulo: string; sub: string; boton: string }> = {
    entrar: { titulo: 'Bienvenido a bordo', sub: 'Inicia sesión para ver tus spots, mareas y capturas.', boton: 'Entrar' },
    registro: { titulo: 'Crea tu cuenta', sub: 'Un minuto y estás dentro.', boton: 'Crear cuenta' },
    recuperar: { titulo: 'Recupera tu acceso', sub: 'Te enviaremos un enlace a tu email.', boton: 'Enviar enlace' },
    nueva: { titulo: 'Elige una contraseña nueva', sub: 'Será la que uses desde ahora para entrar.', boton: 'Guardar y entrar' },
  };
  const { titulo, sub, boton } = TEXTOS[modo];
  const conRepetir = modo === 'registro' || modo === 'nueva';
  const nivel = fuerza(password);
  const campo = (id: string) => [styles.field, glassField as any, foco === id && styles.fieldFocus, foco === id && (glowField as any)];

  const animaPress = (to: number) =>
    Animated.spring(press, { toValue: to, useNativeDriver: NATIVE, speed: 40, bounciness: 6 }).start();

  return (
    <View style={styles.root}>
      <OceanBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Entrada style={styles.hero}>
            <Logo />
            <Text style={styles.brand}>Mi PescaSub</Text>
            <Text style={styles.tag}>Spots, mareas y capturas para pesca submarina</Text>
          </Entrada>

          <Entrada delay={180} style={{ width: '100%', alignItems: 'center' }}>
            <View style={[styles.card, glassCard as any]}>
              {modo === 'entrar' || modo === 'registro' ? (
                <View style={[styles.segment, glassField as any]}>
                  {(['entrar', 'registro'] as const).map((m) => (
                    <Pressable key={m} style={[styles.segBtn, modo === m && styles.segActive]} onPress={() => cambiarModo(m)}>
                      <Text style={[styles.segText, modo === m && styles.segTextActive]}>
                        {m === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                modo === 'recuperar' && (
                  <Pressable onPress={() => cambiarModo('entrar')} style={styles.back}>
                    <Ionicons name="arrow-back" size={16} color={palette.foamSoft} />
                    <Text style={styles.backText}>Volver</Text>
                  </Pressable>
                )
              )}

              <Text style={styles.title}>{titulo}</Text>
              <Text style={styles.sub}>{sub}</Text>

              {modo === 'registro' && (
                <View style={campo('nombre')}>
                  <Ionicons name="person-outline" size={18} color={palette.foamSoft} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre"
                    placeholderTextColor="rgba(190,225,240,0.6)"
                    value={nombre}
                    onChangeText={setNombre}
                    autoComplete="name"
                    onFocus={() => setFoco('nombre')}
                    onBlur={() => setFoco(null)}
                  />
                </View>
              )}
              {modo !== 'nueva' && (
              <View style={campo('email')}>
                <Ionicons name="mail-outline" size={18} color={palette.foamSoft} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="rgba(190,225,240,0.6)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={modo === 'recuperar' ? enviar : undefined}
                  onFocus={() => setFoco('email')}
                  onBlur={() => setFoco(null)}
                />
              </View>
              )}
              {modo !== 'recuperar' && (
                <View style={campo('pass')}>
                  <Ionicons name="lock-closed-outline" size={18} color={palette.foamSoft} />
                  <TextInput
                    style={styles.input}
                    placeholder={modo === 'entrar' ? 'Contraseña' : 'Contraseña (mínimo 6 caracteres)'}
                    placeholderTextColor="rgba(190,225,240,0.6)"
                    secureTextEntry={!verPass}
                    autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={conRepetir ? undefined : enviar}
                    onFocus={() => setFoco('pass')}
                    onBlur={() => setFoco(null)}
                  />
                  <Pressable
                    onPress={() => setVerPass((v) => !v)}
                    accessibilityLabel={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <Ionicons name={verPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={palette.foamSoft} />
                  </Pressable>
                </View>
              )}

              {conRepetir && password.length > 0 && (
                <View style={styles.meter}>
                  <View style={styles.meterBars}>
                    {[1, 2, 3, 4].map((i) => (
                      <View
                        key={i}
                        style={[styles.meterBar, { backgroundColor: i <= nivel ? FUERZA_COLOR[nivel] : 'rgba(255,255,255,0.14)' }]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.meterText, { color: FUERZA_COLOR[nivel] }]}>{FUERZA_TXT[nivel]}</Text>
                </View>
              )}

              {conRepetir && (
                <View style={campo('repetir')}>
                  <Ionicons
                    name={repetir && repetir === password ? 'checkmark-circle' : 'lock-closed-outline'}
                    size={18}
                    color={repetir && repetir === password ? palette.ok : palette.foamSoft}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Repite la contraseña"
                    placeholderTextColor="rgba(190,225,240,0.6)"
                    secureTextEntry={!verPass}
                    autoComplete="new-password"
                    value={repetir}
                    onChangeText={setRepetir}
                    onSubmitEditing={enviar}
                    onFocus={() => setFoco('repetir')}
                    onBlur={() => setFoco(null)}
                  />
                </View>
              )}

              {error && (
                <View style={[styles.msgBox, styles.msgError]}>
                  <Ionicons name="alert-circle" size={16} color={palette.coral} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              )}
              {info && (
                <View style={[styles.msgBox, styles.msgOk]}>
                  <Ionicons name="checkmark-circle" size={16} color={palette.ok} />
                  <Text style={styles.info}>{info}</Text>
                </View>
              )}

              <Animated.View
                style={{ transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }] }}
              >
                <Pressable
                  style={[styles.btn, glowBtn as any, busy && { opacity: 0.75 }]}
                  onPress={enviar}
                  onPressIn={() => animaPress(1)}
                  onPressOut={() => animaPress(0)}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.btnText}>{boton}</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </Pressable>
              </Animated.View>

              {modo === 'entrar' && (
                <Pressable onPress={() => cambiarModo('recuperar')}>
                  <Text style={styles.link}>¿Has olvidado la contraseña?</Text>
                </Pressable>
              )}
            </View>
          </Entrada>

          <Entrada delay={380}>
            <Text style={styles.foot}>Cartas del IHM · Open-Meteo · OpenStreetMap</Text>
          </Entrada>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* Estilos de cristal (solo web: desenfoque y brillos; en móvil queda translúcido). */
const webOnly = (o: object) => Platform.select({ web: o, default: {} });

const glassCard = webOnly({
  backdropFilter: 'blur(22px) saturate(1.5)',
  WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
  backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 45%, rgba(155,232,255,0.07) 100%)',
  boxShadow: '0 24px 70px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 0 0 1px rgba(255,255,255,0.05)',
});
const glassField = webOnly({
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
});
const glowField = webOnly({ boxShadow: '0 0 0 3px rgba(255,194,75,0.18), 0 0 22px rgba(255,194,75,0.18)', transition: 'box-shadow .2s' });
const glowBtn = webOnly({
  backgroundImage: 'linear-gradient(135deg, #ff7a63 0%, #ff5a4a 55%, #ff8a4a 100%)',
  boxShadow: '0 10px 30px rgba(255,107,87,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
  cursor: 'pointer',
});
const glassBadge = webOnly({
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.m, gap: spacing.l },
  hero: { alignItems: 'center', gap: 6 },
  logoWrap: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  logoRing: {
    position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 1.5, borderColor: 'rgba(155,232,255,0.8)',
  },
  badge: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  brand: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: 0.4 },
  tag: { color: 'rgba(214,240,252,0.85)', fontSize: 14, textAlign: 'center' },
  card: {
    width: '100%', maxWidth: 410, backgroundColor: 'rgba(8,44,76,0.42)', borderRadius: 26,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', padding: spacing.l, gap: spacing.s + 2,
  },
  segment: {
    flexDirection: 'row', backgroundColor: 'rgba(2,22,39,0.45)', borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segActive: { backgroundColor: 'rgba(255,255,255,0.16)' },
  segText: { color: 'rgba(200,230,245,0.7)', fontWeight: '600', fontSize: 13 },
  segTextActive: { color: '#fff' },
  meter: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  meterBars: { flex: 1, flexDirection: 'row', gap: 4 },
  meterBar: { flex: 1, height: 4, borderRadius: 2 },
  meterText: { fontSize: 11, fontWeight: '700', width: 70, textAlign: 'right' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backText: { color: palette.foamSoft, fontSize: 13, fontWeight: '600' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 },
  sub: { color: 'rgba(200,230,245,0.8)', fontSize: 13, marginBottom: 4 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.s + 2, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, paddingHorizontal: spacing.m, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  fieldFocus: { borderColor: palette.buoy, backgroundColor: 'rgba(255,255,255,0.12)' },
  input: { flex: 1, color: '#fff', paddingVertical: 14, fontSize: 15, outlineStyle: 'none' } as any,
  btn: {
    backgroundColor: palette.coral, paddingVertical: 15, borderRadius: 14, marginTop: 6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  msgBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1 },
  msgError: { backgroundColor: 'rgba(255,107,87,0.12)', borderColor: 'rgba(255,107,87,0.35)' },
  msgOk: { backgroundColor: 'rgba(46,211,168,0.12)', borderColor: 'rgba(46,211,168,0.35)' },
  error: { color: '#ffb4a8', fontSize: 13, flex: 1 },
  info: { color: '#9ff0d8', fontSize: 13, flex: 1 },
  link: { color: palette.foamSoft, fontSize: 13, textAlign: 'center', marginTop: 6, fontWeight: '600' },
  foot: { color: 'rgba(190,225,240,0.55)', fontSize: 11, textAlign: 'center' },
});
