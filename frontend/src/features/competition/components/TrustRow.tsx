import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { colors, radius } from '@/theme';

interface TrustRowProps {
  prizeVideoUrl: string | null;
  refundPolicyUrl: string | null;
  onPlay: (url: string) => void;
}

export function TrustRow({ prizeVideoUrl, refundPolicyUrl, onPlay }: TrustRowProps) {
  const { t } = useLanguage();
  return (
    <View style={styles.row}>
      <Card style={[styles.half, { flex: 1.1 }]}>
        <Pressable
          accessibilityRole="button"
          disabled={!prizeVideoUrl}
          onPress={() => prizeVideoUrl && onPlay(prizeVideoUrl)}
          style={styles.videoRow}
        >
          <View style={styles.thumb}>
            <View style={styles.play}>
              <Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text size={12.5} weight="semibold">
              {t('howReceivePrize')}
            </Text>
            <Text size={11} color={colors.textMuted}>
              {t('watchVideo')}
            </Text>
          </View>
        </Pressable>
      </Card>
      <Card style={[styles.half, { gap: 10, justifyContent: 'center' }]}>
        <Pressable
          accessibilityRole="link"
          disabled={!refundPolicyUrl}
          onPress={() => refundPolicyUrl && Linking.openURL(refundPolicyUrl)}
          style={styles.policy}
        >
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.text} />
          <Text size={12}>{t('refundPolicy')}</Text>
        </Pressable>
        <View style={styles.policy}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.text} />
          <Text size={11} style={{ flexShrink: 1 }}>
            {t('securePayments')}{' '}
            <Text size={12} weight="bold" color={colors.razorpay} style={{ fontStyle: 'italic' }}>
              Razorpay
            </Text>
          </Text>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, padding: 12 },
  videoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: '#CFEAE4', alignItems: 'center', justifyContent: 'center' },
  play: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  policy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
