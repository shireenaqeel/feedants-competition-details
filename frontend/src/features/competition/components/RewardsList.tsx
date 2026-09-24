import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { Competition } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatMoney, ordinal } from '@/lib/format';
import { colors, radius } from '@/theme';

function PositionIcon({ position }: { position: number }) {
  if (position === 1) return <MaterialCommunityIcons name="trophy" size={20} color={colors.gold} />;
  if (position === 2) return <MaterialCommunityIcons name="medal" size={20} color={colors.silver} />;
  if (position === 3) return <MaterialCommunityIcons name="medal" size={20} color={colors.bronze} />;
  return <Ionicons name="star-outline" size={18} color={colors.primary} />;
}

export function RewardsList({ rewards }: { rewards: Competition['rewards'] }) {
  const { t, lang } = useLanguage();
  if (!rewards.length) return null;
  return (
    <Card>
      <View style={styles.header}>
        <Text size={15} weight="semibold">
          {t('rewards')}
        </Text>
        <Text size={12} color={colors.textMuted}>
          {t('allPositions')}
        </Text>
      </View>
      <View style={styles.list}>
        {rewards.map((r) => (
          <View key={r.position} style={styles.row} accessible accessibilityLabel={`${t('positionWinner', { pos: ordinal(r.position, lang) })}: ${formatMoney(r.amount)}`}>
            <View style={styles.icon}>
              <PositionIcon position={r.position} />
            </View>
            <Text size={14} weight="medium" style={{ flex: 1 }}>
              {t('positionWinner', { pos: ordinal(r.position, lang) })}
            </Text>
            <Text size={15} weight="bold" color={colors.primary}>
              {formatMoney(r.amount)}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 },
  list: { backgroundColor: colors.background, borderRadius: radius.md, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10 },
  icon: { width: 30 },
});
