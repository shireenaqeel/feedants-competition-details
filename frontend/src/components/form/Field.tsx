import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius } from '@/theme';
import { Text } from '../ui/Text';

export function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text size={13} weight="semibold">
        {label}
      </Text>
      {hint ? (
        <Text size={11} color={colors.textMuted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text size={12} color={colors.danger} accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: ReactNode;
}

export function TextField({ label, hint, error, prefix, multiline, editable = true, ...rest }: TextFieldProps) {
  return (
    <View style={styles.field}>
      {label ? <FieldLabel label={label} hint={hint} /> : null}
      <View style={[styles.inputRow, multiline && styles.multiline, error && styles.inputError, !editable && styles.disabled]}>
        {prefix}
        <TextInput
          {...rest}
          editable={editable}
          multiline={multiline}
          accessibilityLabel={label ?? rest.placeholder}
          placeholderTextColor={colors.textSubtle}
          style={[styles.input, multiline && { minHeight: 88, textAlignVertical: 'top' }]}
        />
      </View>
      <FieldError message={error} />
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
});

const styles = StyleSheet.create({
  field: { gap: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: colors.surface, minHeight: 46 },
  multiline: { alignItems: 'flex-start', paddingVertical: 4 },
  inputError: { borderColor: colors.danger },
  disabled: { backgroundColor: colors.chip },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text, paddingVertical: 10 },
});
