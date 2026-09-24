import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import type { CompetitionDetails, FellowParticipant } from '@/api/types';
import { TextField } from '@/components/form/Field';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { RatingBadge, StarInput } from '@/components/ui/Stars';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { notify } from '@/lib/confirm';
import { colors, radius } from '@/theme';
import { errorMessage } from '../errors';

/**
 * Ratings & reviews. Participants can rate the competition + organizer, and their fellow
 * participants' sportsmanship, once submissions close (the server's `actions.rate` decides).
 */
export function RatingsSection({ details }: { details: CompetitionDetails }) {
  const { t } = useLanguage();
  const { competition: c, viewer, actions, lifecycle } = details;
  const [rateOpen, setRateOpen] = useState(false);
  const [peersOpen, setPeersOpen] = useState(false);
  const reviews = useQuery({ queryKey: queryKeys.reviews(c.id), queryFn: () => endpoints.reviews(c.id), enabled: c.rating.count > 0 });

  const canRate = actions.rate.allowed;
  if (!canRate && c.rating.count === 0 && lifecycle.stage !== 'past') return null;

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.header}>
        <Text size={15} weight="semibold" style={{ flex: 1 }}>
          {t('ratingsReviews')}
        </Text>
        <RatingBadge rating={c.rating} size={14} />
      </View>

      {canRate &&
        (viewer.myRating ? (
          <View style={styles.mine}>
            <Text size={13} weight="medium" style={{ flex: 1 }}>
              {t('yourRating')}: {'★'.repeat(viewer.myRating.competitionStars)}
            </Text>
            <Button label={t('editRating')} variant="outline" size="sm" onPress={() => setRateOpen(true)} />
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            <Text size={12} color={colors.textMuted}>
              {t('rateHint')}
            </Text>
            <Button label={t('rateCompetition')} onPress={() => setRateOpen(true)} />
          </View>
        ))}
      {canRate && <Button label={t('rateParticipants')} variant="outline" onPress={() => setPeersOpen(true)} />}

      {reviews.data?.ratings.map((r) => (
        <View key={r.id} style={styles.review}>
          {r.avatarUrl ? <Image source={r.avatarUrl} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: colors.chip }]} />}
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <Text size={13} weight="semibold" style={{ flex: 1 }}>
                {r.userName}
              </Text>
              <Text size={12} color={colors.gold}>
                {'★'.repeat(r.competitionStars)}
              </Text>
            </View>
            {r.comment ? (
              <Text size={12} color={colors.textMuted}>
                {r.comment}
              </Text>
            ) : null}
          </View>
        </View>
      ))}

      {rateOpen && <RateSheet details={details} onClose={() => setRateOpen(false)} />}
      {peersOpen && <PeersSheet competitionId={c.id} onClose={() => setPeersOpen(false)} />}
    </Card>
  );
}

function RateSheet({ details, onClose }: { details: CompetitionDetails; onClose: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const mine = details.viewer.myRating;
  const [competitionStars, setCompetitionStars] = useState(mine?.competitionStars ?? 0);
  const [organizerStars, setOrganizerStars] = useState(mine?.organizerStars ?? 0);
  const [comment, setComment] = useState(mine?.comment ?? '');

  const save = useMutation({
    mutationFn: () => endpoints.rateCompetition(details.competition.id, { competitionStars, organizerStars, comment: comment.trim() || undefined }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.competitionAll(details.competition.slug) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews(details.competition.id) }),
        queryClient.invalidateQueries({ queryKey: ['publicProfile'] }),
      ]);
      onClose();
      notify(t('ratingSaved'));
    },
    onError: (e) => notify(t('somethingWrong'), errorMessage(e, t)),
  });

  return (
    <Sheet visible onClose={onClose}>
      <View style={{ gap: 16 }}>
        <Text size={18} weight="semibold">
          {t('rateCompetition')}
        </Text>
        <View style={{ gap: 6 }}>
          <Text weight="medium">{t('competitionStars')}</Text>
          <StarInput label={t('competitionStars')} value={competitionStars} onChange={setCompetitionStars} />
        </View>
        {details.competition.organizer && (
          <View style={{ gap: 6 }}>
            <Text weight="medium">
              {t('organizerStars')} · {details.competition.organizer.name}
            </Text>
            <StarInput label={t('organizerStars')} value={organizerStars} onChange={setOrganizerStars} />
          </View>
        )}
        <TextField label={t('commentOptional')} value={comment} onChangeText={setComment} multiline maxLength={500} />
        <Button label={t('submitRating')} onPress={() => save.mutate()} loading={save.isPending} disabled={!competitionStars || !organizerStars} />
      </View>
    </Sheet>
  );
}

function PeersSheet({ competitionId, onClose }: { competitionId: string; onClose: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const fellows = useQuery({ queryKey: queryKeys.fellows(competitionId), queryFn: () => endpoints.fellowParticipants(competitionId) });

  const rate = useMutation({
    mutationFn: ({ userId, stars }: { userId: string; stars: number }) => endpoints.rateSportsmanship(competitionId, userId, stars),
    // Optimistic: the stars light up immediately; rolled back if the server refuses.
    onMutate: async ({ userId, stars }) => {
      const key = queryKeys.fellows(competitionId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ participants: FellowParticipant[] }>(key);
      queryClient.setQueryData<{ participants: FellowParticipant[] }>(key, (d) =>
        d ? { participants: d.participants.map((p) => (p.id === userId ? { ...p, myStars: stars } : p)) } : d,
      );
      return { previous };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKeys.fellows(competitionId), ctx.previous);
      notify(t('somethingWrong'), errorMessage(e, t));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['publicProfile'] }),
  });

  return (
    <Sheet visible onClose={onClose}>
      <Text size={18} weight="semibold">
        {t('rateParticipants')}
      </Text>
      <Text size={12} color={colors.textMuted} style={{ marginBottom: 12 }}>
        {t('rateParticipantsHint')}
      </Text>
      {fellows.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {fellows.data?.participants.length ? (
            fellows.data.participants.map((p) => (
              <View key={p.id} style={styles.peer}>
                {p.avatarUrl ? <Image source={p.avatarUrl} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: colors.chip }]} />}
                <Text size={13} weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                  {p.name}
                </Text>
                <StarInput label={`${t('sportsmanship')} ${p.name}`} size={20} value={p.myStars ?? 0} onChange={(stars) => rate.mutate({ userId: p.id, stars })} />
              </View>
            ))
          ) : (
            <Text color={colors.textMuted}>{t('nothingHere')}</Text>
          )}
        </ScrollView>
      )}
      <Button label={t('done')} variant="outline" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 10 },
  review: { flexDirection: 'row', gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  peer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: radius.md, padding: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
});
