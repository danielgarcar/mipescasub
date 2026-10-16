import Svg, { Path } from 'react-native-svg';

/**
 * Escudo del logotipo de la Xunta de Galicia (solo el emblema, sin el texto), tomado del SVG que
 * publica https://pescreativa.xunta.gal. Es blanco: pensado para fondos de color.
 *
 * Marca de la Xunta de Galicia. Se usa aquí para indicar el ORIGEN de los datos de los límites de
 * pesca submarina; la app no es oficial ni está vinculada a la Xunta.
 */
const EMBLEMA = 'M0,0v32.5h22.8V0H0z M10.6,2.7h0.5V2.2h0.5v0.5h0.5v0.5h-0.5v0.5h-0.5V3.3h-0.5L10.6,2.7L10.6,2.7z M6.5,26H5.4 v1.1H4.3V26H3.3v-1.1h1.1v-1.1h1.1v1.1h1.1V26z M6.5,19.5H5.4v1.1H4.3v-1.1H3.3v-1.1h1.1v-1.1h1.1v1.1h1.1V19.5z M6.5,13H5.4v1.1 H4.3V13H3.3v-1.1h1.1v-1.1h1.1v1.1h1.1V13z M11.9,24.3c0,0.2,0,0.4,0,0.6c0,1.6,0.5,3.1,1.4,4.3H9.5c0.9-1.2,1.4-2.7,1.4-4.3 c0-0.2,0-0.4,0-0.6c-1.8-0.3-3.2-1.8-3.2-3.8h7.6C15.2,22.5,13.8,24.1,11.9,24.3z M13,11.9V13h-1.1v1.1h-1.1V13H9.8v-1.1h1.1v-1.1 h1.1v1.1H13z M11.4,15.2c1.2,0,2.2,1,2.2,2.2c0,1.2-1,2.2-2.2,2.2c-1.2,0-2.2-1-2.2-2.2C9.2,16.1,10.2,15.2,11.4,15.2z M15.2,9.5 H7.6V8.7h7.6V9.5z M15.9,7.3l-0.4,0.6h-1l0.7-1c0.1-0.2,0.2-0.4,0.2-0.6c0-0.3-0.1-0.5-0.2-0.6c-0.2-0.2-0.4-0.3-0.7-0.3 c-0.1,0-0.2,0-0.2,0l0,0c0.1,0.2,0.1,0.4,0.1,0.6c0,0.4,0,0.6-0.2,1l-0.6,1h-1l0.8-1.4c0.1-0.1,0.1-0.4,0.1-0.6 c0-0.3-0.1-0.5-0.3-0.7C13,5,12.8,4.9,12.5,4.9c-0.3,0-0.6,0.1-0.7,0.3v2.6H11V5.2c-0.2-0.2-0.4-0.3-0.7-0.3C10,4.9,9.7,5,9.5,5.2 C9.3,5.4,9.3,5.7,9.3,5.9c0,0.2,0.1,0.4,0.1,0.6l0.8,1.4h-1l-0.6-1c-0.2-0.3-0.2-0.6-0.2-1c0-0.2,0-0.4,0.1-0.6l0,0c0,0-0.1,0-0.2,0 C8,5.3,7.8,5.4,7.6,5.6C7.4,5.8,7.3,6,7.3,6.3c0,0.1,0,0.4,0.2,0.6l0.7,1h-1L6.8,7.3C6.6,7,6.5,6.6,6.5,6.3C6.5,5.7,6.7,5.3,7,5 c0.4-0.4,0.8-0.5,1.3-0.5c0.2,0,0.4,0,0.7,0.1c0,0,0,0,0.1-0.1c0.3-0.3,0.7-0.5,1.2-0.5c0.4,0,0.8,0.1,1.1,0.4 c0.3-0.3,0.7-0.4,1.1-0.4c0.5,0,0.9,0.2,1.2,0.5c0,0,0,0,0.1,0.1c0.2-0.1,0.5-0.1,0.7-0.1c0.5,0,0.9,0.2,1.3,0.5 c0.3,0.3,0.5,0.7,0.5,1.3C16.3,6.6,16.2,7,15.9,7.3z M19.5,26h-1.1v1.1h-1.1V26h-1.1v-1.1h1.1v-1.1h1.1v1.1h1.1V26z M19.5,19.5h-1.1 v1.1h-1.1v-1.1h-1.1v-1.1h1.1v-1.1h1.1v1.1h1.1V19.5z M19.5,13h-1.1v1.1h-1.1V13h-1.1v-1.1h1.1v-1.1h1.1v1.1h1.1V13z';

export function XuntaEmblema({ height = 26, color = '#FFFFFF', opacity = 1 }: { height?: number; color?: string; opacity?: number }) {
  return (
    <Svg width={(height * 22.8) / 32.5} height={height} viewBox="0 0 22.8 32.5" opacity={opacity} accessibilityLabel="Xunta de Galicia">
      <Path d={EMBLEMA} fill={color} />
    </Svg>
  );
}
