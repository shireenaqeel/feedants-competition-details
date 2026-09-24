import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text color={colors.textMuted} style={{ marginTop: 12 }}>{label}</Text> : null}
    </View>
  );
}

export function ErrorView({ title, message, actionLabel, onAction }: { title: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={44} color={colors.textSubtle} />
      <Text size={16} weight="semibold" align="center" style={{ marginTop: 12 }}>
        {title}
      </Text>
      {message ? (
        <Text color={colors.textMuted} align="center" style={{ marginTop: 4 }}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={{ marginTop: 16 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.background },
});
