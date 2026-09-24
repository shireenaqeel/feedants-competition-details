import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Competition, Lifecycle, Seats, ViewerState } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatMoney } from '@/lib/format';
import { colors, radius } from '@/theme';

// Below this many spots the copy switches to "Only N spots left".
const FEW_SPOTS = 20;

interface SummaryCardProps {
  competition: Competition;
  seats: Seats;
  viewerState: ViewerState;
  lifecycle: Lifecycle;
  isSaved: boolean;
  onToggleSave: () => void;
}

export function SummaryCard({ competition: c, seats, viewerState, lifecycle, isSaved, onToggleSave }: SummaryCardProps) {
  const { t } = useLanguage();
  const isRegistered = viewerState === 'registered' || viewerState === 'submitted' || viewerState === 'winner';
  const bookedRatio = seats.total ? (seats.total - seats.left) / seats.total : 0;

  // Once a competition is over, spots left no longer matter: show how many took part.
  const finished = lifecycle.stage === 'past';
  const spotsText = finished
    ? t('participantsCount', { n: seats.booked })
    : seats.left === 0 ? t('spotsFull') : seats.left === 1 ? t('oneSpotLeft') : seats.left <= FEW_SPOTS ? t('onlySpotsLeft', { n: seats.left }) : t('spotsLeft', { n: seats.left });

  return (
    <Card>
      <View style={styles.titleRow}>
        <Text size={20} weight="bold" style={{ flex: 1 }} accessibilityRole="header">
          {c.title}
        </Text>
        {isRegistered && (
          <View style={styles.badge}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <Text size={13} weight="medium" color={colors.primary}>
              {viewerState === 'submitted' ? t('submitted') : t('registered')}
            </Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSaved ? t('unsaveCompetition') : t('saveCompetition')}
          hitSlop={8}
          onPress={onToggleSave}
          style={styles.saveButton}
        >
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={isSaved ? colors.primary : colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.tagsRow}>
        {c.tags.map((tag) => (
          <View key={tag} style={styles.chip}>
            <Text size={12} weight="medium">
              {tag}
            </Text>
          </View>
        ))}
        {c.certificateForWinners && (
          <View style={styles.certificate}>
            <MaterialCommunityIcons name="trophy-outline" size={16} color={colors.primary} />
            <Text size={12} weight="medium" color={colors.primary}>
              {t('winnersGetCertificate')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text size={12} color={colors.textMuted}>
            {t('prizePool')}
          </Text>
          <Text size={26} weight="bold" color={colors.primary} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(c.prizePool)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text size={12} color={colors.textMuted}>
            {t('entryFee')}
          </Text>
          <Text size={22} weight="bold" numberOfLines={1} adjustsFontSizeToFit>
            {c.entryFee > 0 ? formatMoney(c.entryFee) : t('free')}
          </Text>
        </View>
        <View style={[styles.stat, { flex: 1.45 }]}>
          <View style={styles.spotsRow}>
            <Ionicons name="people-outline" size={16} color={seats.left === 0 && !finished ? colors.danger : colors.primary} />
            <Text size={12.5} weight="medium" color={seats.left === 0 && !finished ? colors.danger : colors.primary} style={{ flexShrink: 1 }}>
              {spotsText}
            </Text>
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: seats.total, now: seats.total - seats.left }}
          >
            <View style={[styles.fill, { width: `${Math.min(100, Math.max(bookedRatio * 100, bookedRatio > 0 ? 6 : 0))}%` }]} />
          </View>
          <Text size={12} color={colors.textMuted}>
            {t('booked', { booked: seats.booked, total: seats.total })}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  saveButton: { padding: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  chip: { backgroundColor: colors.chip, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 3 },
  certificate: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
  statsRow: { flexDirection: 'row', marginTop: 16, gap: 10 },
  stat: { flex: 1, gap: 2 },
  spotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.track, marginVertical: 8, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
});
