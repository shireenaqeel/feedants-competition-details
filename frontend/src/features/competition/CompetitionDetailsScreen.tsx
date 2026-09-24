import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { Text } from '@/components/ui/Text';
import { VideoModal } from '@/components/ui/VideoModal';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useServerNow } from '@/lib/serverClock';
import { colors } from '@/theme';
import { AdSlot } from './components/AdSlot';
import { CountdownBanner } from './components/CountdownBanner';
import { Disclaimer } from './components/Disclaimer';
import { ImportantDates } from './components/ImportantDates';
import { InfoTabs } from './components/InfoTabs';
import { JudgeCard } from './components/JudgeCard';
import { OrganizerRow } from './components/OrganizerRow';
import { PaymentSheet } from './components/PaymentSheet';
import { PreviousWinners } from './components/PreviousWinners';
import { PrimaryCta } from './components/PrimaryCta';
import { RatingsSection } from './components/RatingsSection';
import { ReferralCard } from './components/ReferralCard';
import { RewardsList } from './components/RewardsList';
import { ScreenHeader } from './components/ScreenHeader';
import { SummaryCard } from './components/SummaryCard';
import { TestimonialsRow } from './components/Testimonials';
import { TrustRow } from './components/TrustRow';
import { getPrimaryCta } from './cta';
import { useAvailability, useCompetitionDetails, usePreviousWinners, useReferral, useTestimonials } from './hooks/useCompetition';
import { useMilestoneRefetch } from './hooks/useMilestoneRefetch';
import { useRegistrationFlow } from './hooks/useRegistrationFlow';
import { useSaveCompetition } from './hooks/useSaveCompetition';
import { useSubmissionUpload } from './hooks/useSubmissionUpload';

export function CompetitionDetailsScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useLanguage();
  const now = useServerNow();

  const details = useCompetitionDetails(slug);
  const availability = useAvailability(slug);
  const winners = usePreviousWinners(slug);
  const testimonials = useTestimonials();
  const referral = useReferral();

  const data = details.data;
  const flow = useRegistrationFlow(slug, data?.competition.id);
  const upload = useSubmissionUpload(slug, data?.competition.id);
  const { toggleSave } = useSaveCompetition(slug, data?.competition.id);
  const [video, setVideo] = useState<{ url: string; title?: string } | null>(null);

  const refetchAll = useCallback(() => {
    void details.refetch();
    void availability.refetch();
  }, [details, availability]);
  useMilestoneRefetch(data, now, refetchAll);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([details.refetch(), availability.refetch(), winners.refetch(), testimonials.refetch()]);
    setRefreshing(false);
  }, [details, availability, winners, testimonials]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/competitions'));

  // Use whichever seat count is newer: the polled availability or the details payload.
  const seats = useMemo(() => {
    if (!data) return undefined;
    const live = availability.data;
    return live && availability.dataUpdatedAt > details.dataUpdatedAt ? live.seats : data.competition.seats;
  }, [data, availability.data, availability.dataUpdatedAt, details.dataUpdatedAt]);

  if (details.isPending) return <LoadingView label={t('loading')} />;
  if (!data || !seats) {
    const notFound = details.error instanceof ApiError && details.error.status === 404;
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
        <View style={styles.pad}>
          <ScreenHeader onBack={goBack} />
        </View>
        <ErrorView
          title={notFound ? t('notFound') : t('somethingWrong')}
          message={notFound ? undefined : t('offline')}
          actionLabel={notFound ? t('goBack') : t('retry')}
          onAction={notFound ? goBack : () => void details.refetch()}
        />
      </View>
    );
  }

  const { competition: c, lifecycle, viewer } = data;
  const cta = getPrimaryCta(data, seats, now, t, lang);
  const onCta = () => {
    switch (cta.action) {
      case 'register':
      case 'pay':
        return flow.register(); // idempotent: resumes an existing hold
      case 'login':
        return router.push('/login');
      case 'upload':
        return void upload.pickAndUpload();
      case 'manage':
        return router.push({ pathname: '/organize/[id]', params: { id: c.id } });
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <ScreenHeader onBack={goBack} />
        {c.status === 'draft' && (
          <View style={styles.draft}>
            <Ionicons name="eye-off-outline" size={18} color={colors.text} />
            <Text size={13} weight="medium" style={{ flex: 1 }}>
              {t('draftBanner')}
            </Text>
          </View>
        )}
        <SummaryCard
          competition={c}
          seats={seats}
          viewerState={viewer.state}
          lifecycle={lifecycle}
          isSaved={viewer.isSaved}
          onToggleSave={() => toggleSave(viewer.isSaved)}
        />
        {c.judges.map((j) => (
          <JudgeCard key={j.id} judge={j} onPlayIntro={(url) => setVideo({ url, title: j.name })} />
        ))}
        {c.organizer && <OrganizerRow organizer={c.organizer} />}
        <CountdownBanner lifecycle={lifecycle} now={now} />
        {lifecycle.stage === 'past' && <RatingsSection details={data} />}
        <ImportantDates timeline={c.timeline} />
        <PreviousWinners winners={winners.data?.winners ?? []} onPlay={(w) => w.videoUrl && setVideo({ url: w.videoUrl, title: w.name })} />
        <InfoTabs key={lang} content={c.content} />
        <RewardsList rewards={c.rewards} />
        {lifecycle.stage !== 'past' && <RatingsSection details={data} />}
        {c.disclaimer ? <Disclaimer text={c.disclaimer} /> : null}
        <TrustRow
          prizeVideoUrl={c.media.prizeInfoVideoUrl}
          refundPolicyUrl={c.refundPolicyUrl}
          onPlay={(url) => setVideo({ url, title: t('howReceivePrize') })}
        />
        <ReferralCard referral={referral.data} rewardPerSignup={c.referralRewardPerSignup} competitionTitle={c.title} onLogin={() => router.push('/login')} />
        <TestimonialsRow testimonials={testimonials.data?.testimonials ?? []} />
        <AdSlot />
      </ScrollView>

      <View style={styles.ctaBar}>
        <PrimaryCta
          cta={cta}
          busy={flow.busy}
          progress={upload.progress}
          progressLabel={t('uploading', { pct: Math.round((upload.progress ?? 0) * 100) })}
          onPress={onCta}
        />
      </View>

      <PaymentSheet
        pending={flow.pending}
        competitionTitle={c.title}
        now={now}
        paying={flow.paying}
        onPay={flow.pay}
        onCancel={flow.cancel}
        onClose={flow.closeCheckout}
      />
      <VideoModal url={video?.url ?? null} title={video?.title} onClose={() => setVideo(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pad: { paddingHorizontal: 16 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  draft: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warningSoft, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#F3D9A4' },
  ctaBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: colors.background },
});
