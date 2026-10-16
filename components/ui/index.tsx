/**
 * Kit de UI base: todo el estilo de botones, campos, FAB, segmentados y estados vacíos vive aquí
 * para que las pantallas no repitan estilos y la línea de diseño se cambie en un solo sitio.
 */
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, palette, radii, spacing, TOUCH } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/* ───────── Button ───────── */

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Ocupa solo lo que mide su contenido (por defecto ocupa todo el ancho). */
  compact?: boolean;
};

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, style, compact }: ButtonProps) {
  const off = disabled || loading;
  const fg = variant === 'primary' ? palette.onAccent : variant === 'danger' ? palette.coral : palette.foam;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        btn.base,
        compact && { alignSelf: 'flex-start' },
        variant === 'primary' && { backgroundColor: palette.buoy, borderColor: palette.buoy },
        variant === 'secondary' && { backgroundColor: palette.highlight, borderColor: palette.line },
        variant === 'ghost' && { backgroundColor: 'transparent', borderColor: palette.line },
        variant === 'danger' && { backgroundColor: 'transparent', borderColor: palette.coral },
        off && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: motion.press }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[btn.text, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const btn = StyleSheet.create({
  base: {
    minHeight: TOUCH, paddingHorizontal: spacing.m, borderRadius: radii.m, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s,
  },
  text: { fontSize: 16, fontWeight: '700' },
});

/* ───────── IconButton / Fab ───────── */

export function IconButton({
  icon, label, onPress, size = TOUCH, active, accent, style,
}: {
  icon: IconName; label: string; onPress: () => void; size?: number; active?: boolean; accent?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const bg = accent || active ? palette.buoy : palette.surface;
  const fg = accent || active ? palette.onAccent : palette.foam;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: accent || active ? palette.buoy : palette.line },
        pressed && { opacity: 0.85, transform: [{ scale: motion.press }] },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={fg} />
    </Pressable>
  );
}

/** Botón flotante de acción principal, por encima de la barra de pestañas. */
export function Fab({ icon = 'add', label, onPress }: { icon?: IconName; label: string; onPress: () => void }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <IconButton
      icon={icon}
      label={label}
      onPress={onPress}
      size={56}
      accent
      style={{ position: 'absolute', right: spacing.m, bottom: spacing.m + Math.min(bottom, 8) }}
    />
  );
}

/* ───────── Segmented ───────── */

export function Segmented<T extends string>({
  value, options, onChange, style,
}: {
  value: T; options: { key: T; label: string }[]; onChange: (k: T) => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[seg.row, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={[seg.item, on && seg.itemOn]}
          >
            <Text style={[seg.text, on && seg.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: radii.m, borderWidth: 1, borderColor: palette.line, padding: 3 },
  item: { flex: 1, minHeight: 42, borderRadius: radii.m - 3, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.s },
  itemOn: { backgroundColor: palette.buoy },
  text: { color: palette.foamSoft, fontSize: 15, fontWeight: '600' },
  textOn: { color: palette.onAccent, fontWeight: '700' },
});

/* ───────── Chip (selección en cuadrículas) ───────── */

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[chip.base, on && chip.on]}
    >
      <Text style={[chip.text, on && chip.textOn]}>{label}</Text>
    </Pressable>
  );
}

const chip = StyleSheet.create({
  base: {
    minHeight: 44, paddingHorizontal: spacing.m, borderRadius: radii.pill, borderWidth: 1, borderColor: palette.line,
    backgroundColor: palette.abyss, alignItems: 'center', justifyContent: 'center',
  },
  on: { backgroundColor: palette.buoy, borderColor: palette.buoy },
  text: { color: palette.foam, fontSize: 14 },
  textOn: { color: palette.onAccent, fontWeight: '700' },
});

/* ───────── Field (etiqueta visible + error en línea) ───────── */

type FieldProps = TextInputProps & { label: string; error?: string | null; hint?: string; right?: ReactNode; /** true cuando el campo comparte fila con otro */ grow?: boolean };

export function Field({ label, error, hint, style, right, grow, ...props }: FieldProps) {
  return (
    <View style={[{ gap: 4 }, grow && { flex: 1 }]}>
      <Text style={field.label}>{label}</Text>
      <View style={[field.box, !!error && { borderColor: palette.coral }]}>
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor={palette.foamSoft}
          style={[field.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, style]}
        />
        {right}
      </View>
      {error ? <Text style={field.error}>{error}</Text> : hint ? <Text style={field.hint}>{hint}</Text> : null}
    </View>
  );
}

const field = StyleSheet.create({
  label: { color: palette.foamSoft, fontSize: 13, fontWeight: '600' },
  box: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: radii.m,
    borderWidth: 1, borderColor: palette.line, paddingHorizontal: spacing.m,
  },
  input: { flex: 1, color: palette.foam, fontSize: 16, minHeight: TOUCH - 2, paddingVertical: spacing.s },
  error: { color: palette.coral, fontSize: 12 },
  hint: { color: palette.foamSoft, fontSize: 12 },
});

/* ───────── EmptyState / ErrorState ───────── */

export function EmptyState({
  icon = 'water-outline', title, text, actionLabel, onAction,
}: {
  icon?: IconName; title: string; text?: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={empty.wrap}>
      <Ionicons name={icon} size={44} color={palette.foamSoft} />
      <Text style={empty.title}>{title}</Text>
      {!!text && <Text style={empty.text}>{text}</Text>}
      {actionLabel && onAction && <Button label={actionLabel} onPress={onAction} compact />}
    </View>
  );
}

/** Mensaje humano + reintento, en lugar de volcar `error.message` crudo. */
export function ErrorState({ onRetry, text = 'No se pudo cargar. Revisa tu conexión e inténtalo de nuevo.' }: { onRetry: () => void; text?: string }) {
  return <EmptyState icon="cloud-offline-outline" title="Sin conexión" text={text} actionLabel="Reintentar" onAction={onRetry} />;
}

const empty = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.s, padding: spacing.xl, marginTop: spacing.l },
  title: { color: palette.foam, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  text: { color: palette.foamSoft, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: spacing.s },
});

/* ───────── Toast sencillo no bloqueante ───────── */

export function Banner({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' | 'ok' }) {
  const c = tone === 'error' ? palette.coral : tone === 'ok' ? palette.ok : palette.buoy;
  return (
    <View style={[ban.box, { borderColor: c }]} accessibilityLiveRegion="polite">
      <Text style={[ban.text, { color: c }]}>{text}</Text>
    </View>
  );
}

const ban = StyleSheet.create({
  box: { backgroundColor: palette.abyss, borderWidth: 1, borderRadius: radii.m, padding: spacing.s },
  text: { fontSize: 13 },
});

/* ───────── Stepper (− valor +) ───────── */

export function Stepper({
  label, value, onMinus, onPlus, disabled, minusLabel, plusLabel,
}: {
  label: string; value: string; onMinus: () => void; onPlus: () => void; disabled?: boolean; minusLabel: string; plusLabel: string;
}) {
  return (
    <View style={stp.row}>
      <Text style={stp.label}>{label}</Text>
      <View style={stp.steps}>
        <IconButton icon="remove" label={minusLabel} onPress={disabled ? () => {} : onMinus} size={44} />
        <Text style={stp.value}>{value}</Text>
        <IconButton icon="add" label={plusLabel} onPress={disabled ? () => {} : onPlus} size={44} />
      </View>
    </View>
  );
}

const stp = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.s },
  steps: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  label: { color: palette.foam, fontSize: 16, flex: 1 },
  value: { color: palette.foam, fontSize: 20, fontWeight: '600', minWidth: 56, textAlign: 'center' },
});

/* ───────── Badge ───────── */

export function Badge({ text, tone = 'info', icon }: { text: string; tone?: 'ok' | 'info' | 'warn' | 'danger'; icon?: IconName }) {
  const c = tone === 'ok' ? palette.ok : tone === 'warn' ? palette.pinPoint : tone === 'danger' ? palette.coral : palette.foamSoft;
  return (
    <View style={[bdg.box, { borderColor: c }]}>
      {icon && <Ionicons name={icon} size={12} color={c} />}
      <Text style={[bdg.text, { color: c }]}>{text}</Text>
    </View>
  );
}

const bdg = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radii.s,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '700' },
});
