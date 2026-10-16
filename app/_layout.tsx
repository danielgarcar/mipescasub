import { ThemeProvider, DarkTheme } from 'expo-router';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { StatusBar } from 'expo-status-bar';
import { palette } from '@/lib/theme';

/**
 * Alternativa si no quieres instalar @react-navigation/native explícito:
 * quita el ThemeProvider y usa solo el Stack — expo-router lo trae de facto.
 */
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: palette.abyss,
    card: palette.surface,
    text: palette.foam,
    border: palette.line,
    primary: palette.buoy,
  },
};

export default function RootLayout() {
  const { session, loading, recovery } = useAuth();
  // Con el enlace de recuperar contraseña hay sesión, pero hasta elegir la nueva se queda en el login.
  const autenticado = !!session && !recovery;

  // Mientras se comprueba si hay sesión guardada no se muestra ninguna pantalla.
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.abyss, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.buoy} />
      </View>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.abyss },
          headerTintColor: palette.foam,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: palette.abyss },
        }}
      >
        {/* Sin sesión solo se ve el login; con sesión, la app. */}
        <Stack.Protected guard={!autenticado}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={autenticado}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="spot/[id]" />
          <Stack.Screen name="spot/new" />
          <Stack.Screen name="captura/new" />
          <Stack.Screen name="foro/[id]" />
          <Stack.Screen name="salida/new" />
          <Stack.Screen name="salida/[id]" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
