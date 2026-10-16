# Línea de diseño — "Marea"

> Una herramienta para el pescador, no un espectáculo. Si algo no ayuda a pescar, planificar o entrenar, sobra.

## 1. Principios

1. **Lo sencillo es bueno.** Una acción principal por pantalla. Si hay dos botones igual de llamativos, uno sobra.
2. **El contenido manda.** El mapa, el temporizador y la captura son los protagonistas; el "cromo" (bordes, sombras, adornos) se aparta.
3. **Se usa con guantes, sol y prisa.** Zonas táctiles de 48 px, texto de 16 px mínimo en lo importante, contraste alto, cero textos que haya que leer dos veces.
4. **Naturaleza en el color, no en la decoración.** Verde mar, tinta marina, arena y algas. Sin ilustraciones, sin texturas, sin olas animadas fuera del login.
5. **Movimiento con propósito.** Solo para confirmar una acción o explicar un cambio (≤ 240 ms). Nada que gire, flote o llame la atención por sí mismo.
6. **Tranquilo por defecto, claro cuando importa.** Casi todo es neutro; el color aparece solo para acción, selección y avisos.

## 2. Color (tokens en `lib/theme.ts` → `color`)

Un único acento. El resto, neutros de tinta marina.

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#0B1A21` | Fondo de pantalla |
| `surface` | `#12262E` | Tarjetas y hojas |
| `surfaceHigh` | `#1B3540` | Pulsado / seleccionado suave |
| `line` | `#22404B` | Separadores |
| `text` | `#EEF4F2` | Texto principal |
| `textMuted` | `#94AEB4` | Texto secundario |
| **`accent`** | `#4CCFB8` | **Acción principal, selección, enlaces, estado activo** |
| `onAccent` | `#06211F` | Texto sobre acento (contraste > 8:1) |
| `ok` | `#7CCB7F` | Éxito, "respira", público |
| `warn` | `#F2C265` | Avisos de seguridad, "privado" |
| `danger` | `#FF7A66` | Error y acciones destructivas (cerrar sesión, terminar) |

**Reglas:** el acento nunca se usa de decoración. `danger` nunca es el botón principal. Nunca texto claro sobre acento: siempre `onAccent`.

**Antes → ahora:** de tres acentos compitiendo (coral para acciones, amarillo para estado activo, verde para éxito) a uno solo. El coral baja a "peligro", el amarillo a "aviso".

## 3. Tipografía

Fuente del sistema (SF en iOS, Roboto en Android): rápida, legible y familiar.

| Estilo | Tamaño / peso | Uso |
|---|---|---|
| `h1` | 28 · 700 | Título de pantalla |
| `h2` | 20 · 600 | Secciones |
| `h3` | 17 · 600 | Título de tarjeta |
| `body` | 16 · 400 | Texto (ahora en color principal, no atenuado) |
| `small` | 13 · 400 | Metadatos (atenuado) |
| `mono` | 40–72 · 700 tabular | Cronómetros y cifras |

Etiquetas siempre **visibles** encima del campo (no solo placeholder).

## 4. Forma y espacio

- Radios: 8 (chips internos) · **14 (tarjetas, botones, campos)** · 22 (hojas inferiores) · píldora (selectores).
- Espaciado en múltiplos de 8: 4 · 8 · 16 · 24 · 32. Márgenes de pantalla: 16.
- Tarjetas: un tono sobre el fondo y borde de 1 px apenas visible. Sin sombras en tema oscuro.
- Iconos: **Ionicons** siempre, nunca símbolos Unicode ni emojis como icono funcional.

## 5. Componentes (`components/ui`)

`Button` (primary · secondary · ghost · danger) · `IconButton` · `Fab` · `Segmented` · `Chip` · `Field` · `EmptyState` · `ErrorState` · `Banner`.
Pantallas nuevas = estos componentes. Si hace falta un estilo nuevo, se añade aquí, no en la pantalla.

## 6. Movimiento (`motion` en el tema)

- Pulsación: escala 0,97 y opacidad 0,85 (140 ms).
- Cambios de estado y hojas: 240 ms, curva suave.
- Prohibido: animaciones infinitas fuera del login, parpadeos, rebotes largos.
- Háptica: ligera en confirmaciones; en apnea, en cambios de fase y cuenta atrás.

## 7. Patrones

- **Mapa primero.** Controles mínimos en pantalla; capas dentro de un botón. Un solo panel inferior a la vez. Mantener pulsado = crear spot.
- **Vacío = una frase y un botón.** Nunca solo "No hay datos".
- **Error en lenguaje humano + Reintentar.** Nunca `error.message` crudo.
- **Validación en el campo**, no en alertas. Las alertas solo para confirmar algo destructivo.
- **Seguridad primero en apnea:** aviso la primera vez y recordatorio fijo.

## 8. Accesibilidad (mínimos)

Zona táctil ≥ 48 px · contraste texto ≥ 4,5:1 · todo control con `accessibilityLabel` y `accessibilityRole` · estado seleccionado con `accessibilityState` · el significado nunca depende solo del color (los marcadores del mapa llevan icono).

## 9. Próximas fases

1. **Tema claro** ("Sol"): imprescindible para leer en cubierta con sol directo. Propuesta de tokens: `bg #F3F6F5`, `surface #FFFFFF`, `line #DCE5E7`, `text #0B1F2A`, `textMuted #566C76`, `accent #0E7C86`, `onAccent #FFFFFF`. Requiere pasar de constantes estáticas a un hook `useTheme()`, y adaptar el login (fondo oceánico oscuro) y el estilo del mapa.
2. **Navegación a 4 pestañas**: mover Perfil a un avatar en la cabecera (Mapa · Pesca · Apnea · Comunidad).
3. **Bottom sheet** con arrastre para spot y datos de punto.
4. **Modo sin conexión** para spots y capturas, con sincronización posterior.
5. **Agrupación de marcadores** (clustering) cuando haya muchos spots.
