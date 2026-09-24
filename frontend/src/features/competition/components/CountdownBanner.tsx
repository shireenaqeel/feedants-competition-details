import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { Lifecycle } from '@/api/types';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { countdownParts, formatCountdown } from '@/lib/format';
import { colors, radius } from '@/theme';

/** Counts down to the next milestone using server-aligned time (`now`). */
export function CountdownBanner({ lifecycle, now }: { lifecycle: Lifecycle; now: number }) {
  const { t } = useLanguage();
  const milestone = lifecycle.nextMilestone;

  if (lifecycle.phase === 'cancelled' || !milestone) {
    return (
      <View style={[styles.bar, lifecycle.phase === 'cancelled' && { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name={lifecycle.phase === 'cancelled' ? 'close-circle-outline' : 'trophy-outline'} size={20} color={lifecycle.phase === 'cancelled' ? colors.danger : colors.primary} />
        <Text size={14} weight="medium" style={{ flex: 1 }}>
          {lifecycle.phase === 'cancelled' ? t('competitionCancelled') : t('resultsAnnounced')}
        </Text>
      </View>
    );
  }

  const parts = countdownParts(new Date(milestone.at).getTime() - now);
  return (
    <View style={styles.bar} accessibilityRole="timer" accessibilityLiveRegion="none">
      <MaterialCommunityIcons name="timer-sand" size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text size={12} weight="medium" numberOfLines={1}>
          {t(`milestone_${milestone.type}`)}
        </Text>
        <Text size={17} weight="bold" color={colors.primary} style={styles.time} numberOfLines={1} adjustsFontSizeToFit>
          {formatCountdown(parts)}
        </Text>
      </View>
      {lifecycle.urgency && (
        <View style={styles.hurry}>
          <Ionicons name="stopwatch-outline" size={20} color={colors.primary} />
          <Text size={12} weight="semibold" color={colors.primary} numberOfLines={1}>
            {t('hurryUp')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.primaryBorder },
  time: { fontVariant: ['tabular-nums'] },
  hurry: { alignItems: 'center', gap: 2, paddingLeft: 4 },
});
