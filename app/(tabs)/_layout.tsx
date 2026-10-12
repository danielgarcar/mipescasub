import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { palette } from '@/lib/theme';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  'index': 'map',
  'pesca': 'fish',
  'apnea': 'pulse',
  'foro': 'chatbubbles',
  'perfil': 'person',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.abyss },
        headerTintColor: palette.foam,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: palette.buoy,
        tabBarInactiveTintColor: palette.foamSoft,
        tabBarStyle: {
          backgroundColor: palette.abyss,
          borderTopColor: palette.line,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        sceneStyle: { backgroundColor: palette.abyss },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Mapa', tabBarIcon: ({ color, size }) => <Ionicons name={icons['index']} size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="pesca"
        options={{ title: 'Pesca', tabBarIcon: ({ color, size }) => <Ionicons name={icons['pesca']} size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="apnea"
        options={{ title: 'Apnea', tabBarIcon: ({ color, size }) => <Ionicons name={icons['apnea']} size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="foro"
        options={{ title: 'Foro', tabBarIcon: ({ color, size }) => <Ionicons name={icons['foro']} size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <Ionicons name={icons['perfil']} size={size} color={color} /> }}
      />
    </Tabs>
  );
}
