/**
 * Línea de diseño "Marea" de Mi PescaSub. Guía completa en DESIGN.md.
 *
 * Reglas rápidas:
 *  - UN solo acento (`accent`, verde mar). El resto es neutro.
 *  - `danger` solo para lo destructivo o erróneo; `warn` solo para avisos de seguridad.
 *  - Los nombres antiguos de `palette` siguen existiendo como alias; en código nuevo usa `color`.
 */

/** Colores semánticos (tema oscuro; el tema claro está previsto en DESIGN.md, fase 2). */
export const color = {
  bg: '#0B1A21',         // fondo de pantalla: tinta marina muy oscura
  surface: '#12262E',    // tarjetas y hojas
  surfaceHigh: '#1B3540',// elemento pulsado / seleccionado suave
  line: '#22404B',       // separadores y bordes finos
  text: '#EEF4F2',       // texto principal (espuma)
  textMuted: '#94AEB4',  // texto secundario
  accent: '#4CCFB8',     // acento único: verde mar (acción principal, selección, enlaces)
  onAccent: '#06211F',   // texto sobre `accent` y sobre `warn` (contraste > 8:1)
  ok: '#7CCB7F',         // éxito / público
  warn: '#F2C265',       // aviso (seguridad apnea)
  danger: '#FF7A66',     // error / destructivo / privado
  spot: '#2FD36B',       // marcador de spot (diana verde)
  limit: '#E5484D',     // límites de pesca submarina prohibida (rojo franco, distinto del salmón `danger`)
} as const;

/** Alias heredados: mantienen compilando el código anterior. Preferir `color`. */
export const palette = {
  deep: '#0E222B',
  abyss: color.bg,
  surface: color.surface,
  highlight: color.surfaceHigh,
  caqui: color.surfaceHigh,
  foam: color.text,
  foamSoft: color.textMuted,
  coral: color.danger,
  buoy: color.accent,
  ok: color.ok,
  line: color.line,
  safeArea: color.bg,
  onAccent: color.onAccent,
  /** Marcadores de mapa que no son spots. */
  pinPoint: color.warn,
  pinPlace: '#7AA7FF',
  pinShared: '#7AA7FF',
  limit: color.limit,
  spot: color.spot,
};

/** Tamaño mínimo de zona táctil (guantes, manos mojadas). */
export const TOUCH = 48;

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
} as const;

export const radii = {
  s: 8,
  m: 14,
  l: 22,
  pill: 999,
} as const;

/**
 * Escala tipográfica (fuente del sistema: SF en iOS, Roboto en Android).
 * Texto principal en `text`; `small` y `caption` en `textMuted`.
 */
export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: color.text, letterSpacing: 0.2 },
  h2: { fontSize: 20, fontWeight: '600' as const, color: color.text },
  h3: { fontSize: 17, fontWeight: '600' as const, color: color.text },
  body: { fontSize: 16, color: color.text, lineHeight: 22 },
  small: { fontSize: 13, color: color.textMuted, lineHeight: 18 },
  mono: { fontSize: 40, fontWeight: '700' as const, color: color.text, fontVariant: ['tabular-nums'] as 'tabular-nums'[] },
};

/** Tarjeta: superficie un tono por encima del fondo y borde apenas visible. */
export const card = {
  backgroundColor: color.surface,
  borderRadius: radii.m,
  padding: spacing.m,
  borderWidth: 1,
  borderColor: color.line,
  gap: 4,
};

/** Movimiento: corto y con propósito (nada decorativo). */
export const motion = {
  fast: 140,   // feedback de pulsación
  base: 240,   // transiciones de estado
  press: 0.97, // escala al pulsar
} as const;

export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 6,
  elevation: 3,
};
