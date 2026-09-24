import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';
import { Text } from './Text';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, size = 'md', style, accessibilityHint }: ButtonProps) {
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        isPrimary && styles.primary,
        variant === 'outline' && styles.outline,
        inactive && isPrimary && styles.primaryDisabled,
        pressed && !inactive && { opacity: 0.85 },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading && <ActivityIndicator size="small" color={isPrimary ? '#fff' : colors.primary} style={{ marginRight: 8 }} />}
        <Text size={size === 'sm' ? 12 : 15} weight="semibold" color={isPrimary ? '#fff' : colors.primary}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sm: { paddingHorizontal: 12, paddingVertical: 6 },
  md: { paddingHorizontal: 18, paddingVertical: 12 },
  primary: { backgroundColor: colors.primary },
  primaryDisabled: { backgroundColor: '#8DB8B3' },
  outline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center' },
});
