import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { colors, radius } from '@/theme';
import { Text } from '../ui/Text';
import { FieldLabel } from './Field';

export function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <FieldLabel label={label} hint={hint} />
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.track }} thumbColor="#fff" accessibilityLabel={label} />
    </View>
  );
}

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

/** Single-select chips. `scroll` lays them out in one horizontal row. */
export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: ChipOption<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  scroll?: boolean;
}) {
  const chips = options.map((o) => {
    const active = o.value === value;
    return (
      <Pressable
        key={o.value}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        onPress={() => onChange(o.value)}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text size={13} weight={active ? 'semibold' : 'medium'} color={active ? '#fff' : colors.text}>
          {o.label}
        </Text>
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityRole="radiogroup">
        {chips}
      </ScrollView>
    );
  }
  return (
    <View style={[styles.chipRow, { flexWrap: 'wrap' }]} accessibilityRole="radiogroup">
      {chips}
    </View>
  );
}

export function AddButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.add, disabled && { opacity: 0.4 }]}>
      <Text size={13} weight="semibold" color={colors.primary}>
        + {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  add: { alignSelf: 'flex-start', paddingVertical: 6 },
});
