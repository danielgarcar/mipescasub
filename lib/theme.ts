/**
 * Tema visual "nautical dark" para Mi PescaSub.
 */

export const palette = {
  deep: '#04223C',      // azul profundo (fondo primario)
  abyss: '#021627',     // oscuro secundario
  surface: '#0A3355',   // superficie / tarjetas
  highlight: '#0E547A', // hover / énfasis suave
  caqui: '#0E4764',     // caqui náutico (acento secundario)
  foam: '#EAF6FF',      // texto principal (espuma)
  foamSoft: '#9DC3DB',  // texto secundario
  coral: '#FF6B57',     // acento cálido (coral): CTA / peligro
  buoy: '#FFC24B',      // baliza amarilla: warning / destacar
  ok: '#2ED3A8',        // verde mar: éxito
  line: '#1C4463',      // líneas / bordes
  safeArea: '#021627',
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
} as const;

export const radii = {
  s: 6,
  m: 10,
  l: 16,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, color: palette.foam, letterSpacing: 0.3 },
  h2: { fontSize: 18, fontWeight: '600' as const, color: palette.foam },
  h3: { fontSize: 15, fontWeight: '600' as const, color: palette.foam },
  body: { fontSize: 14, color: palette.foamSoft, lineHeight: 20 },
  small: { fontSize: 12, color: palette.foamSoft },
  mono: { fontSize: 40, fontWeight: '700' as const, color: palette.foam, fontVariant: ['tabular-nums'] as const },
};

/** Estilos de tarjeta reutilizables */
export const card = {
  backgroundColor: palette.surface,
  borderRadius: radii.m,
  padding: spacing.m,
  borderWidth: 1,
  borderColor: palette.line,
};

export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 6,
  elevation: 3,
};
