import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import type { OrganizerCompetition } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { ChipSelect } from '@/components/form/Controls';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { Text } from '@/components/ui/Text';
import { errorMessage } from '@/features/competition/errors';
import { useLanguage } from '@/i18n/LanguageProvider';
import { confirm, notify } from '@/lib/confirm';
import { formatDate, formatMoney } from '@/lib/format';
import { colors, radius } from '@/theme';

type Segment = 'all' | 'drafts' | 'upcoming' | 'ongoing' | 'past';

function segmentOf(c: OrganizerCompetition): Exclude<Segment, 'all'> {
  return c.status === 'draft' ? 'drafts' : c.lifecycle.stage;
}

export function OrganizerDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [segment, setSegment] = useState<Segment>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.myCompetitions(user?.id ?? null, lang),
    queryFn: () => endpoints.myCompetitions(lang),
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="trophy-outline" size={48} color={colors.textSubtle} />
        <Text size={16} weight="semibold" align="center" style={{ marginTop: 12 }}>
          {t('loginToOrganize')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' }}>
          <Button label={t('signUp')} onPress={() => router.push({ pathname: '/login', params: { mode: 'signup' } })} style={{ flex: 1 }} />
          <Button label={t('logIn')} variant="outline" onPress={() => router.push({ pathname: '/login', params: { mode: 'login' } })} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }
  if (query.isPending) return <LoadingView />;
  if (query.isError) return <ErrorView title={t('somethingWrong')} message={errorMessage(query.error, t)} actionLabel={t('retry')} onAction={() => void query.refetch()} />;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['myCompetitions'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.competitionsAll }),
      queryClient.invalidateQueries({ queryKey: ['competition'] }),
    ]);

  const run = async (c: OrganizerCompetition, action: 'publish' | 'cancel' | 'delete') => {
    const copy = {
      publish: [t('confirmPublishTitle'), t('confirmPublishBody'), t('publish'), false],
      cancel: [t('confirmCancelTitle'), t('confirmCancelBody'), t('cancelCompetition'), true],
      delete: [t('confirmDeleteTitle'), t('confirmDeleteBody'), t('deleteDraft'), true],
    } as const;
    const [title, body, label, destructive] = copy[action];
    if (!(await confirm(title, body, label, t('back'), destructive))) return;
    setBusyId(c.id);
    try {
      if (action === 'publish') {
        await endpoints.publishCompetition(c.id);
        notify(t('publishedToast'));
      } else if (action === 'cancel') {
        const { refunds } = await endpoints.cancelCompetition(c.id);
        notify(t('cancelledToast', { n: refunds }));
      } else {
        await endpoints.deleteCompetition(c.id);
      }
      await refresh();
    } catch (e) {
      notify(t('somethingWrong'), errorMessage(e, t));
    } finally {
      setBusyId(null);
    }
  };

  const items = query.data.competitions.filter((c) => segment === 'all' || segmentOf(c) === segment);
  const segments: Segment[] = ['all', 'drafts', 'upcoming', 'ongoing', 'past'];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text size={22} weight="bold">
                  {t('organize')}
                </Text>
                <Text size={12} color={colors.textMuted}>
                  {t('organizeSubtitle')}
                </Text>
              </View>
              <Button label={`+ ${t('newCompetition')}`} size="sm" onPress={() => router.push('/organize/new')} />
            </View>
            <ChipSelect scroll options={segments.map((s) => ({ value: s, label: t(`dash_${s}`) }))} value={segment} onChange={setSegment} />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text size={15} weight="semibold" align="center">
              {t('noOrganized')}
            </Text>
            <Text size={13} color={colors.textMuted} align="center">
              {t('noOrganizedHint')}
            </Text>
          </View>
        }
        renderItem={({ item }) => <OrganizerCard item={item} busy={busyId === item.id} onAction={(a) => run(item, a)} />}
      />
    </View>
  );
}

function OrganizerCard({ item, busy, onAction }: { item: OrganizerCompetition; busy: boolean; onAction: (a: 'publish' | 'cancel' | 'delete') => void }) {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const isDraft = item.status === 'draft';
  const { stage, phase } = item.lifecycle;
  const statusLabel = isDraft
    ? t('status_draft')
    : item.status === 'cancelled'
      ? t('phase_cancelled')
      : stage === 'ongoing'
        ? `${t('stage_ongoing')} · ${t(`phase_${phase}`)}`
        : t(`stage_${stage}`);
  const statusColor = isDraft ? colors.gold : item.status === 'cancelled' ? colors.danger : item.lifecycle.registrationOpen ? colors.primary : colors.textMuted;
  const canEdit = item.status !== 'cancelled';
  const canCancel = item.status === 'published' && item.lifecycle.phase !== 'results_out';

  return (
    <Card style={{ gap: 10, opacity: busy ? 0.6 : 1 }}>
      <View style={styles.titleRow}>
        <Text size={16} weight="semibold" style={{ flex: 1 }} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={[styles.pill, { borderColor: statusColor }]}>
          <Text size={11} weight="semibold" color={statusColor}>
            {statusLabel}
          </Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <Stat icon="people-outline" label={t('booked', { booked: item.seats.booked, total: item.seats.total })} />
        <Stat icon="cloud-upload-outline" label={t('submissionsCount', { n: item.submissions })} />
        <Stat icon="cash-outline" label={formatMoney(item.prizePool)} />
      </View>
      <Text size={12} color={colors.textMuted}>
        {item.lifecycle.phase === 'upcoming' ? t('opensOn', { date: formatDate(item.timeline.registrationOpensAt, lang) }) : t('closesOn', { date: formatDate(item.timeline.registrationClosesAt, lang) })}
      </Text>
      <View style={styles.actions}>
        <Action label={t('view')} onPress={() => router.push({ pathname: '/competitions/[slug]', params: { slug: item.slug } })} />
        {canEdit && <Action label={t('edit')} onPress={() => router.push({ pathname: '/organize/[id]', params: { id: item.id } })} />}
        {isDraft && <Action label={t('publish')} primary onPress={() => onAction('publish')} disabled={busy} />}
        {isDraft && <Action label={t('deleteDraft')} danger onPress={() => onAction('delete')} disabled={busy} />}
        {canCancel && <Action label={t('cancelCompetition')} danger onPress={() => onAction('cancel')} disabled={busy} />}
      </View>
    </Card>
  );
}

function Stat({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={15} color={colors.textMuted} />
      <Text size={12} color={colors.text}>
        {label}
      </Text>
    </View>
  );
}

function Action({ label, onPress, primary, danger, disabled }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[styles.action, primary && { backgroundColor: colors.primary, borderColor: colors.primary }, danger && { borderColor: colors.dangerSoft }]}
    >
      <Text size={12} weight="semibold" color={primary ? '#fff' : danger ? colors.danger : colors.primary}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { gap: 6, padding: 32, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primaryBorder },
});
