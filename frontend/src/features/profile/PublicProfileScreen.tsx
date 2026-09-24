import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import type { CompetitionSummary, Stage } from '@/api/types';
import { ChipSelect } from '@/components/form/Controls';
import { Card } from '@/components/ui/Card';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { RatingBadge } from '@/components/ui/Stars';
import { Text } from '@/components/ui/Text';
import { CompetitionListItem } from '@/features/competition/components/CompetitionListItem';
import { errorMessage } from '@/features/competition/errors';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatDate } from '@/lib/format';
import { colors } from '@/theme';

type StageFilter = Stage | 'all';

/** Public profile: participant record + sportsmanship, and (for organizers) their competitions. */
export function PublicProfileScreen({ userId }: { userId: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [stage, setStage] = useState<StageFilter>('all');
  const query = useQuery({ queryKey: queryKeys.publicProfile(userId, lang), queryFn: () => endpoints.publicProfile(userId, lang) });

  if (query.isPending) return <LoadingView />;
  if (query.isError) return <ErrorView title={t('somethingWrong')} message={errorMessage(query.error, t)} actionLabel={t('goBack')} onAction={() => router.back()} />;

  const { user, stats, organized, participated } = query.data;
  const byStage = (list: CompetitionSummary[]) => (stage === 'all' ? list : list.filter((c) => c.lifecycle.stage === stage));
  const stageOptions: StageFilter[] = ['all', 'upcoming', 'ongoing', 'past'];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/competitions'))} style={styles.back} hitSlop={10}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
        <Text size={16} weight="medium">
          {t('goBack')}
        </Text>
      </Pressable>

      <Card style={{ gap: 12 }}>
        <View style={styles.identity}>
          {user.avatarUrl ? (
            <Image source={user.avatarUrl} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Ionicons name="person" size={34} color={colors.primary} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text size={18} weight="semibold">
              {user.name}
            </Text>
            {user.city ? (
              <Text size={12} color={colors.textMuted}>
                {user.city}
              </Text>
            ) : null}
            <Text size={12} color={colors.textMuted}>
              {t('memberSince', { date: formatDate(user.memberSince, lang) })}
            </Text>
          </View>
        </View>
        {user.bio ? <Text size={13}>{user.bio}</Text> : null}
        <View style={styles.ratingRow}>
          <Text size={13} color={colors.textMuted} style={{ flex: 1 }}>
            {t('sportsmanship')}
          </Text>
          <RatingBadge rating={stats.sportsmanship} />
        </View>
        {stats.organized > 0 && (
          <View style={styles.ratingRow}>
            <Text size={13} color={colors.textMuted} style={{ flex: 1 }}>
              {t('organizerRating')}
            </Text>
            <RatingBadge rating={stats.organizerRating} />
          </View>
        )}
      </Card>

      {(stats.registered > 0 || stats.organized === 0) && <ParticipationStats stats={stats} />}

      {organized.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text size={16} weight="semibold">
            {t('competitionsOrganized')} ({organized.length})
          </Text>
          <ChipSelect scroll options={stageOptions.map((s) => ({ value: s, label: s === 'all' ? t('filterAll') : t(`dash_${s}`) }))} value={stage} onChange={setStage} />
          {byStage(organized).length ? byStage(organized).map((c) => <CompetitionListItem key={c.id} item={c} />) : <Text color={colors.textMuted}>{t('nothingHere')}</Text>}
        </View>
      )}

      {participated.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text size={16} weight="semibold">
            {t('competitionsJoined')} ({participated.length})
          </Text>
          {participated.map((c) => (
            <CompetitionListItem key={c.id} item={c} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

export function ParticipationStats({ stats }: { stats: { registered: number; submitted: number; noShows: number; won: number } }) {
  const { t } = useLanguage();
  const items = [
    ['stat_registered', stats.registered],
    ['stat_submitted', stats.submitted],
    ['stat_noShows', stats.noShows],
    ['stat_won', stats.won],
  ] as const;
  return (
    <View style={styles.statsRow}>
      {items.map(([key, value]) => (
        <Card key={key} style={styles.stat}>
          <Text size={20} weight="bold" color={key === 'stat_noShows' && value > 0 ? colors.danger : colors.primary}>
            {value}
          </Text>
          <Text size={11} color={colors.textMuted} align="center">
            {t(key)}
          </Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarEmpty: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, gap: 2 },
});
