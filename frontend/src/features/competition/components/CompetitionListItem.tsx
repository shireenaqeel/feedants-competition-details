import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CompetitionSummary } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { RatingBadge } from '@/components/ui/Stars';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatDate, formatMoney } from '@/lib/format';
import { colors, radius } from '@/theme';

export function CompetitionListItem({ item }: { item: CompetitionSummary }) {
  const { t, lang } = useLanguage();
  const { phase, isFull, stage } = item.lifecycle;
  const phaseColor = phase === 'registration_open' ? colors.primary : phase === 'cancelled' ? colors.danger : colors.textMuted;
  const stageColor = stage === 'ongoing' ? colors.primary : stage === 'upcoming' ? colors.gold : colors.textSubtle;

  return (
    <Link href={{ pathname: '/competitions/[slug]', params: { slug: item.slug } }} asChild>
      <Pressable accessibilityRole="link">
        <Card style={{ gap: 8 }}>
          <View style={styles.row}>
            <Text size={16} weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
              {item.title}
            </Text>
            {item.isSaved && <Ionicons name="bookmark" size={16} color={colors.primary} />}
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </View>
          <View style={styles.row}>
            <View style={[styles.pill, { backgroundColor: stageColor, borderColor: stageColor }]}>
              <Text size={11} weight="semibold" color="#fff">
                {t(`stage_${stage}`)}
              </Text>
            </View>
            {(stage === 'ongoing' || phase === 'cancelled') && (
              <View style={[styles.pill, { borderColor: phaseColor }]}>
                <Text size={11} weight="medium" color={phaseColor}>
                  {t(`phase_${phase}`)}
                </Text>
              </View>
            )}
            <Text size={11} color={colors.textMuted}>
              {t(`cat_${item.category}`)}
            </Text>
            {phase === 'registration_open' || phase === 'upcoming' ? (
              <Text size={11} color={colors.textMuted}>
                ·{' '}
                {phase === 'upcoming'
                  ? t('opensOn', { date: formatDate(item.timeline.registrationOpensAt, lang) })
                  : t('closesOn', { date: formatDate(item.timeline.registrationClosesAt, lang) })}
              </Text>
            ) : null}
            {isFull && phase === 'registration_open' && (
              <View style={[styles.pill, { borderColor: colors.danger }]}>
                <Text size={11} weight="medium" color={colors.danger}>
                  {t('full')}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.row}>
            <Text size={12} color={colors.textMuted}>
              {t('prizePool')}{' '}
              <Text size={12} weight="semibold" color={colors.primary}>
                {formatMoney(item.prizePool)}
              </Text>
            </Text>
            <Text size={12} color={colors.textMuted}>
              {t('entryFee')}{' '}
              <Text size={12} weight="semibold">
                {item.entryFee ? formatMoney(item.entryFee) : t('free')}
              </Text>
            </Text>
            <Text size={12} color={colors.textMuted}>
              {t('booked', { booked: item.seats.booked, total: item.seats.total })}
            </Text>
            {item.rating.count > 0 && <RatingBadge rating={item.rating} size={12} />}
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 },
});
