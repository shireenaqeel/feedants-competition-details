import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import type { MyRegistration } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { API_URL } from '@/config/api';
import { LanguageToggle } from '@/features/competition/components/ScreenHeader';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatDate } from '@/lib/format';
import { RatingBadge } from '@/components/ui/Stars';
import { ParticipationStats } from './PublicProfileScreen';
import { colors, radius } from '@/theme';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { user, logout } = useAuth();

  const me = useQuery({ queryKey: queryKeys.me(user?.id ?? null), queryFn: endpoints.me, enabled: Boolean(user) });
  const regs = useQuery({ queryKey: queryKeys.myRegistrations(user?.id ?? null, lang), queryFn: () => endpoints.myRegistrations(lang), enabled: Boolean(user) });
  const health = useQuery({ queryKey: ['health'], queryFn: () => api<{ status: string; db: string }>('/health'), refetchInterval: 30_000 });

  const profile = me.data?.user ?? user;
  const stats = me.data?.stats;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl
          refreshing={me.isRefetching || regs.isRefetching}
          onRefresh={() => {
            void me.refetch();
            void regs.refetch();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <Text size={22} weight="bold">
        {t('tabProfile')}
      </Text>

      {!profile ? (
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
          <Ionicons name="person-circle-outline" size={56} color={colors.textSubtle} />
          <Text align="center" color={colors.textMuted}>
            {t('loginPrompt')}
          </Text>
          <View style={styles.authButtons}>
            <Button label={t('signUp')} onPress={() => router.push({ pathname: '/login', params: { mode: 'signup' } })} style={{ flex: 1 }} />
            <Button label={t('logIn')} variant="outline" onPress={() => router.push({ pathname: '/login', params: { mode: 'login' } })} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <>
          <Card style={{ gap: 14 }}>
            <View style={styles.identity}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('changePhoto')} onPress={() => router.push('/profile/edit')}>
                {profile.avatarUrl ? (
                  <Image source={profile.avatarUrl} style={styles.avatar} contentFit="cover" transition={150} />
                ) : (
                  <View style={[styles.avatar, styles.avatarEmpty]}>
                    <Ionicons name="person" size={34} color={colors.primary} />
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              </Pressable>
              <View style={{ flex: 1, gap: 2 }}>
                <Text size={18} weight="semibold">
                  {profile.name}
                </Text>
                {profile.city ? (
                  <View style={styles.inline}>
                    <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                    <Text size={12} color={colors.textMuted}>
                      {profile.city}
                    </Text>
                  </View>
                ) : null}
                <Text size={12} color={colors.textMuted}>
                  +91 {profile.phone} · {t('memberSince', { date: formatDate(profile.memberSince, lang) })}
                </Text>
              </View>
            </View>
            {profile.bio ? <Text size={13}>{profile.bio}</Text> : null}
            <Button label={t('editProfile')} variant="outline" size="sm" onPress={() => router.push('/profile/edit')} />
          </Card>

          {stats && <ParticipationStats stats={stats} />}
          {stats && (
            <Card style={{ gap: 10 }}>
              <View style={styles.linkRow}>
                <Text size={13} color={colors.textMuted} style={{ flex: 1 }}>
                  {t('sportsmanship')}
                </Text>
                <RatingBadge rating={stats.sportsmanship} />
              </View>
              {stats.organized > 0 && (
                <View style={styles.linkRow}>
                  <Text size={13} color={colors.textMuted} style={{ flex: 1 }}>
                    {t('organizerRating')} · {stats.organized} {t('stat_organized').toLowerCase()}
                  </Text>
                  <RatingBadge rating={stats.organizerRating} />
                </View>
              )}
              <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/users/[id]', params: { id: profile.id } })}>
                <Text size={13} weight="semibold" color={colors.primary}>
                  {t('viewPublicProfile')} →
                </Text>
              </Pressable>
            </Card>
          )}

          <Card style={{ gap: 10 }}>
            <Text size={15} weight="semibold">
              {t('myCompetitions')}
            </Text>
            {regs.data?.registrations.length ? (
              regs.data.registrations.map((r) => <MyCompetitionRow key={r.registration.id} item={r} />)
            ) : (
              <View style={{ gap: 8 }}>
                <Text size={13} color={colors.textMuted}>
                  {regs.isPending ? t('loading') : t('noRegistrations')}
                </Text>
                {!regs.isPending && <Button label={t('browseCompetitions')} size="sm" variant="outline" onPress={() => router.navigate('/competitions')} />}
              </View>
            )}
          </Card>

          <Pressable accessibilityRole="button" onPress={() => router.navigate('/create')}>
            <Card style={styles.linkRow}>
              <Ionicons name="trophy-outline" size={22} color={colors.primary} />
              <Text weight="medium" style={{ flex: 1 }}>
                {t('organizerDashboard')}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </Card>
          </Pressable>
        </>
      )}

      <Card style={{ gap: 12 }}>
        <Text size={15} weight="semibold">
          {t('settings')}
        </Text>
        <View style={styles.linkRow}>
          <Text weight="medium" style={{ flex: 1 }}>
            {t('language')}
          </Text>
          <LanguageToggle />
        </View>
        <View style={{ gap: 2 }}>
          <Text size={12} color={colors.textMuted}>
            {t('server')}: {API_URL}
          </Text>
          <Text size={12} color={health.isSuccess ? colors.primary : colors.danger}>
            {health.isSuccess ? `API ${health.data.status} · DB ${health.data.db}` : health.isPending ? t('loading') : t('offline')}
          </Text>
        </View>
        {profile && <Button label={t('logout')} variant="outline" onPress={() => void logout()} />}
      </Card>
    </ScrollView>
  );
}

function MyCompetitionRow({ item }: { item: MyRegistration }) {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const status = item.registration.status === 'confirmed' && item.hasSubmission ? 'submitted' : item.registration.status;
  const color = status === 'pending_payment' ? colors.gold : status.startsWith('refund') ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/competitions/[slug]', params: { slug: item.competition.slug } })}
      style={styles.regRow}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text size={14} weight="medium" numberOfLines={1}>
          {item.competition.title}
        </Text>
        <Text size={11} color={colors.textMuted}>
          {t(`phase_${item.competition.lifecycle.phase}`)} · {t('resultDate')} {formatDate(item.competition.timeline.resultAt, lang)}
        </Text>
      </View>
      <View style={[styles.pill, { borderColor: color }]}>
        <Text size={11} weight="semibold" color={color}>
          {t(`regStatus_${status}` as 'regStatus_confirmed')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  authButtons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarEmpty: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cameraBadge: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  regRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 },
});
