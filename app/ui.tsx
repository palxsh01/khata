import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
  type TextInputProps
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { color, paletteFor, radius, space } from './theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export function Hero({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <View style={s.hero}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.heroNumber}>{value}</Text>
      {typeof sub === 'string' ? <Text style={s.label}>{sub}</Text> : sub}
    </View>
  );
}

export function Header({ title, icon, onPress }: { title: string; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void }) {
  return (
    <View style={s.header}>
      <View style={s.pill}><Text style={s.pillText}>{title}</Text></View>
      {icon && <View style={s.headerAction}><RoundButton icon={icon} onPress={onPress} /></View>}
    </View>
  );
}

export function RoundButton({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.round, pressed && s.pressed]}>
      <Ionicons name={icon} size={20} color={color.text} />
    </Pressable>
  );
}

export function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.chip, pressed && s.pressed]}>
      <Text style={s.chipText}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

export function Tile({ id, text }: { id: number; text: string }) {
  const c = paletteFor(id);
  return (
    <View style={[s.tile, { backgroundColor: c + '26', borderColor: c }]}>
      <Text style={[s.tileText, { color: c }]}>{text[0]?.toUpperCase()}</Text>
    </View>
  );
}

export function ListRow(props: {
  first: boolean;
  left: ReactNode;
  title: string;
  tags?: string[];
  sub?: string;
  right: string;
  rightSub?: string;
  rightColor?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      style={({ pressed }) => [s.row, !props.first && s.rowDivider, pressed && (props.onPress || props.onLongPress) && { opacity: 0.6 }]}
    >
      {props.left}
      <View style={s.rowMain}>
        <View style={s.rowTitleLine}>
          <Text style={s.rowTitle} numberOfLines={1}>{props.title}</Text>
          {props.tags?.map((t) => <Text key={t} style={s.tag}>{t}</Text>)}
        </View>
        {props.sub && <Text style={s.rowSub}>{props.sub}</Text>}
      </View>
      <View style={s.rowRight}>
        <Text style={[s.amount, props.rightColor ? { color: props.rightColor } : null]}>{props.right}</Text>
        {props.rightSub && <Text style={s.rowSub}>{props.rightSub}</Text>}
      </View>
    </Pressable>
  );
}

export function Ring({ size, stroke, progress, tint, children }: {
  size: number; stroke: number; progress: number; tint: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(Math.max(progress, 0), 1);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.track} strokeWidth={stroke} fill="none" />
        {p > 0 && (
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={tint} strokeWidth={stroke} fill="none"
            strokeDasharray={`${c * p} ${c}`} strokeLinecap="round"
            rotation={-90} origin={`${size / 2}, ${size / 2}`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

export function Sheet({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={s.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{props.label}</Text>
      <TextInput placeholderTextColor={color.textTertiary} {...props} style={s.input} />
    </View>
  );
}

export function Button({ label, onPress, danger, disabled }: {
  label: string; onPress: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.button, danger && s.buttonDanger, (pressed || disabled) && { opacity: disabled ? 0.4 : 0.8 }]}
    >
      <Text style={[s.buttonText, danger && { color: color.negative }]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={s.empty}>{text}</Text>;
}

// "1,200" / "1200.50" -> number; NaN if junk
export const parseAmount = (t: string) => Number(t.replace(/[,₹\s]/g, ''));

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  // ponytail: Android-only top inset; swap for react-native-safe-area-context if iOS ever ships
  content: { paddingTop: (StatusBar.currentHeight ?? 0) + 24, paddingHorizontal: space.gutter, paddingBottom: 180 },

  header: { height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  headerAction: { position: 'absolute', right: 0 },
  pill: { backgroundColor: color.surfaceRaised, borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 10 },
  pillText: { color: color.text, fontSize: 15, fontWeight: '500' },
  round: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', marginBottom: 28 },
  label: { color: color.textSecondary, fontSize: 14 },
  heroNumber: { color: color.text, fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'], marginVertical: 2 },

  chip: { backgroundColor: color.surfaceRaised, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10 },
  chipText: { color: color.textSecondary, fontSize: 13, fontWeight: '500' },
  pressed: { transform: [{ scale: 0.95 }] },

  card: { backgroundColor: color.surface, borderRadius: radius.card, paddingHorizontal: space.card, marginBottom: space.section },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingVertical: 10, gap: 12 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.divider },
  rowMain: { flex: 1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { color: color.text, fontSize: 16, fontWeight: '500', flexShrink: 1 },
  rowSub: { color: color.textSecondary, fontSize: 13, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  tag: { color: color.textSecondary, backgroundColor: color.surfaceMuted, fontSize: 12, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  amount: { color: color.text, fontSize: 16, fontWeight: '500', fontVariant: ['tabular-nums'] },

  tile: { width: 40, height: 40, borderRadius: radius.tile, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontSize: 16, fontWeight: '600' },

  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: space.gutter, paddingBottom: 40, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: color.textTertiary, marginBottom: 16 },
  sheetTitle: { color: color.text, fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 20 },

  field: { marginBottom: 16 },
  fieldLabel: { color: color.textSecondary, fontSize: 13, marginBottom: 6, marginLeft: 4 },
  input: { backgroundColor: color.surfaceRaised, borderRadius: radius.tile, color: color.text, fontSize: 16, paddingHorizontal: 16, height: 52 },

  button: { backgroundColor: color.fab, borderRadius: radius.full, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonDanger: { backgroundColor: color.surfaceRaised },
  buttonText: { color: color.bg, fontSize: 16, fontWeight: '600' },

  empty: { color: color.textTertiary, textAlign: 'center', marginTop: 24, fontSize: 14 }
});
