import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import type { RatingSummary } from '@/api/types';
import { useLanguage } from '@/i18n/LanguageProvider';
import { colors } from '@/theme';
import { Text } from './Text';

/** Read-only average: ★ 4.5 (12 ratings). */
export function RatingBadge({ rating, size = 13, showCount = true }: { rating: RatingSummary; size?: number; showCount?: boolean }) {
  const { t } = useLanguage();
  if (!rating.count || rating.average === null) {
    return (
      <Text size={size - 1} color={colors.textSubtle}>
        {t('noRatingsYet')}
      </Text>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }} accessible accessibilityLabel={`${rating.average} / 5, ${t('ratingsCount', { n: rating.count })}`}>
      <Ionicons name="star" size={size} color={colors.gold} />
      <Text size={size} weight="semibold">
        {rating.average.toFixed(1)}
      </Text>
      {showCount && (
        <Text size={size - 1} color={colors.textMuted}>
          ({rating.count})
        </Text>
      )}
    </View>
  );
}

/** Tappable 1–5 stars. */
export function StarInput({ value, onChange, size = 30, label }: { value: number; onChange: (v: number) => void; size?: number; label: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 5, now: value }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${label}: ${n}`}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? colors.gold : colors.textSubtle} />
        </Pressable>
      ))}
    </View>
  );
}
