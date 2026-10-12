/**
 * `Alert` compatible con web: `Alert.alert` de react-native-web no hace nada, así que en web se
 * usa window.alert / window.confirm. En móvil es el Alert nativo.
 */
import { Alert as RNAlert, Platform } from 'react-native';

type Boton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

export const Alert = {
  alert(titulo: string, mensaje?: string, botones?: Boton[]) {
    if (Platform.OS !== 'web') return RNAlert.alert(titulo, mensaje, botones);
    const texto = mensaje ? `${titulo}\n\n${mensaje}` : titulo;
    const accion = botones?.find((b) => b.style !== 'cancel' && b.onPress);
    if (botones && botones.length > 1 && accion) {
      if (window.confirm(texto)) accion.onPress?.();
    } else {
      window.alert(texto);
      botones?.[0]?.onPress?.();
    }
  },
};
