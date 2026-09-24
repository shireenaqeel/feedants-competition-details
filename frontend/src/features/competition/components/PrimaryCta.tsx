import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius } from '@/theme';
import type { Cta } from '../cta';

interface PrimaryCtaProps {
  cta: Cta;
  busy?: boolean;
  progress?: number | null;
  progressLabel?: string;
  onPress: () => void;
}

/** Sticky bottom button. Shows upload progress in place when an upload is running. */
export function PrimaryCta({ cta, busy, progress, progressLabel, onPress }: PrimaryCtaProps) {
  const uploading = progress !== null && progress !== undefined;
  const disabled = !cta.enabled || busy || uploading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: busy || uploading }}
      accessibilityLabel={[cta.label, cta.sublabel].filter(Boolean).join(', ')}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, !cta.enabled && styles.inactive, pressed && { opacity: 0.9 }]}
    >
      {uploading && <View style={[styles.progress, { width: `${Math.round(progress * 100)}%` }]} />}
      <View style={styles.content}>
        {busy && !uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text size={16} weight="semibold" color="#fff" align="center">
              {uploading ? progressLabel : cta.label}
            </Text>
            {cta.sublabel && !uploading ? (
              <Text size={12} color="rgba(255,255,255,0.85)" align="center" style={{ marginTop: -2 }}>
                {cta.sublabel}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.primary, borderRadius: radius.md, minHeight: 56, justifyContent: 'center', overflow: 'hidden' },
  inactive: { backgroundColor: '#7FA9A5' },
  progress: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primaryDark },
  content: { paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
});
