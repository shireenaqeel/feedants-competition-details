import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import { CATEGORIES, type Category } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Card } from '@/components/ui/Card';
import { RatingBadge } from '@/components/ui/Stars';
import { Text } from '@/components/ui/Text';
import { LanguageToggle } from '@/features/competition/components/ScreenHeader';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { StringKey } from '@/i18n/strings';
import { formatMoney } from '@/lib/format';
import { cardShadow, colors, radius } from '@/theme';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

const CATEGORY_ICONS: Record<Category, McIcon> = {
  dance: 'human-female-dance',
  music: 'music',
  singing: 'microphone-variant',
  art: 'palette',
  photography: 'camera',
  writing: 'feather',
  comedy: 'emoticon-happy-outline',
  other: 'star-four-points-outline',
};

/** Landing for guests (sign up / log in), a personal dashboard once logged in. No competition list. */
export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const stats = useQuery({ queryKey: ['platformStats'], queryFn: endpoints.platformStats, staleTime: 60_000 });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      refreshControl={<RefreshControl refreshing={stats.isRefetching} onRefresh={() => void stats.refetch()} tintColor={colors.primary} />}
    >
      <TopBar />
      {user ? <Dashboard /> : <GuestHero />}
      <PlatformStats data={stats.data} />
      {!user && <HowItWorks />}
      <Categories />
      <HostBanner />
    </ScrollView>
  );
}

function TopBar() {
  return (
    <View style={styles.topBar}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Ionicons name="trophy" size={18} color="#fff" />
        </View>
        <Text size={20} weight="bold">
          Feedants
        </Text>
      </View>
      <LanguageToggle />
    </View>
  );
}

function GuestHero() {
  const router = useRouter();
  const { t } = useLanguage();
  return (
    <View style={styles.hero}>
      {/* Decorative shapes */}
      <View style={[styles.blob, { width: 180, height: 180, top: -60, right: -50 }]} />
      <View style={[styles.blob, { width: 110, height: 110, bottom: -40, left: -30, opacity: 0.08 }]} />
      <View style={styles.floating}>
        {(['music', 'human-female-dance', 'camera'] as McIcon[]).map((icon, i) => (
          <View key={icon} style={[styles.bubble, { marginRight: i * 10 }]}>
            <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
          </View>
        ))}
      </View>

      <View style={styles.pill}>
        <Text size={11} weight="semibold" color="#fff">
          {t('homeTagline')}
        </Text>
      </View>
      <Text size={27} weight="bold" color="#fff" style={{ lineHeight: 36, marginTop: 10, maxWidth: '80%' }}>
        {t('homeTitle')}
      </Text>
      <Text size={13} color="rgba(255,255,255,0.88)" style={{ marginTop: 8, maxWidth: 260 }}>
        {t('homeSubtitle')}
      </Text>
      <View style={styles.heroButtons}>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/login', params: { mode: 'signup' } })} style={[styles.heroBtn, styles.heroBtnSolid]}>
          <Text size={15} weight="semibold" color={colors.primary}>
            {t('signUp')}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/login', params: { mode: 'login' } })} style={[styles.heroBtn, styles.heroBtnOutline]}>
          <Text size={15} weight="semibold" color="#fff">
            {t('logIn')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Dashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const me = useQuery({ queryKey: queryKeys.me(user?.id ?? null), queryFn: endpoints.me, enabled: Boolean(user) });
  if (!user) return null;
  const s = me.data?.stats;

  const actions: { icon: ComponentProps<typeof Ionicons>['name']; label: StringKey; href: Href }[] = [
    { icon: 'search', label: 'quickBrowse', href: '/competitions' },
    { icon: 'ribbon-outline', label: 'quickMine', href: '/profile' },
    { icon: 'add-circle-outline', label: 'quickOrganize', href: '/create' },
    { icon: 'person-circle-outline', label: 'quickEditProfile', href: '/profile/edit' },
  ];

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.hero}>
        <View style={[styles.blob, { width: 160, height: 160, top: -60, right: -40 }]} />
        <View style={styles.greetRow}>
          {user.avatarUrl ? (
            <Image source={user.avatarUrl} style={styles.greetAvatar} />
          ) : (
            <View style={[styles.greetAvatar, styles.greetAvatarEmpty]}>
              <Ionicons name="person" size={26} color={colors.primary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text size={20} weight="bold" color="#fff" numberOfLines={1}>
              {t('greeting', { name: user.name.split(' ')[0] })}
            </Text>
            <Text size={13} color="rgba(255,255,255,0.88)">
              {t('greetingSub')}
            </Text>
          </View>
        </View>
        <View style={styles.myStats}>
          {(
            [
              ['stat_registered', s?.registered],
              ['stat_submitted', s?.submitted],
              ['stat_won', s?.won],
            ] as const
          ).map(([k, v]) => (
            <View key={k} style={styles.myStat}>
              <Text size={18} weight="bold" color="#fff">
                {v ?? '–'}
              </Text>
              <Text size={11} color="rgba(255,255,255,0.85)">
                {t(k)}
              </Text>
            </View>
          ))}
          <View style={styles.myStat}>
            {s && s.sportsmanship.count > 0 ? (
              <View style={styles.whiteBadge}>
                <RatingBadge rating={s.sportsmanship} size={13} showCount={false} />
              </View>
            ) : (
              <Text size={18} weight="bold" color="#fff">
                –
              </Text>
            )}
            <Text size={11} color="rgba(255,255,255,0.85)">
              {t('sportsmanship')}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable key={a.label} accessibilityRole="button" onPress={() => router.push(a.href)} style={styles.action}>
            <View style={styles.actionIcon}>
              <Ionicons name={a.icon} size={22} color={colors.primary} />
            </View>
            <Text size={13} weight="semibold">
              {t(a.label)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PlatformStats({ data }: { data?: { activeCompetitions: number; activePrizePool: number; participants: number } }) {
  const { t } = useLanguage();
  const items: [string, string][] = [
    [data ? String(data.activeCompetitions) : '–', t('liveCompetitions')],
    [data ? formatMoney(data.activePrizePool) : '–', t('inPrizes')],
    [data ? String(data.participants) : '–', t('participantsLabel')],
  ];
  return (
    <View style={styles.statsRow}>
      {items.map(([value, label]) => (
        <Card key={label} style={styles.statCard}>
          <Text size={17} weight="bold" color={colors.primary} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          <Text size={11} color={colors.textMuted} align="center">
            {label}
          </Text>
        </Card>
      ))}
    </View>
  );
}

function HowItWorks() {
  const { t } = useLanguage();
  const steps: { icon: ComponentProps<typeof Ionicons>['name']; title: StringKey; body: StringKey }[] = [
    { icon: 'search', title: 'step1Title', body: 'step1Body' },
    { icon: 'videocam-outline', title: 'step2Title', body: 'step2Body' },
    { icon: 'trophy-outline', title: 'step3Title', body: 'step3Body' },
  ];
  return (
    <View style={{ gap: 10 }}>
      <Text size={17} weight="semibold">
        {t('howItWorks')}
      </Text>
      {steps.map((s, i) => (
        <Card key={s.title} style={styles.step}>
          <View style={styles.stepNumber}>
            <Text size={14} weight="bold" color="#fff">
              {i + 1}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text size={14} weight="semibold">
              {t(s.title)}
            </Text>
            <Text size={12} color={colors.textMuted}>
              {t(s.body)}
            </Text>
          </View>
          <Ionicons name={s.icon} size={22} color={colors.primary} />
        </Card>
      ))}
    </View>
  );
}

function Categories() {
  const router = useRouter();
  const { t } = useLanguage();
  return (
    <View style={{ gap: 10 }}>
      <Text size={17} weight="semibold">
        {t('exploreCategories')}
      </Text>
      <View style={styles.grid}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            onPress={() => router.navigate({ pathname: '/competitions', params: { category: c } })}
            style={styles.category}
          >
            <View style={styles.categoryIcon}>
              <MaterialCommunityIcons name={CATEGORY_ICONS[c]} size={24} color={colors.primary} />
            </View>
            <Text size={12} weight="medium" align="center" numberOfLines={1}>
              {t(`cat_${c}`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function HostBanner() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (user ? router.navigate('/create') : router.push({ pathname: '/login', params: { mode: 'signup' } }))}
      style={styles.host}
    >
      <MaterialCommunityIcons name="bullhorn-outline" size={34} color={colors.primary} style={{ transform: [{ rotate: '-12deg' }] }} />
      <View style={{ flex: 1 }}>
        <Text size={15} weight="semibold">
          {t('hostTitle')}
        </Text>
        <Text size={12} color={colors.textMuted}>
          {t('hostBody')}
        </Text>
      </View>
      <View style={styles.hostBtn}>
        <Text size={12} weight="semibold" color="#fff">
          {t('startOrganizing')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.primary, borderRadius: 22, padding: 22, overflow: 'hidden', ...cardShadow },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: '#fff', opacity: 0.1 },
  floating: { position: 'absolute', right: 14, top: 18, gap: 8, alignItems: 'flex-end' },
  bubble: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  heroButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  heroBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: radius.md },
  heroBtnSolid: { backgroundColor: '#fff' },
  heroBtnOutline: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greetAvatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: '#fff' },
  greetAvatarEmpty: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  myStats: { flexDirection: 'row', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.md, paddingVertical: 10 },
  myStat: { flex: 1, alignItems: 'center', gap: 2 },
  whiteBadge: { backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...cardShadow },
  actionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, gap: 2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  category: { width: '22%', flexGrow: 1, alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  categoryIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  host: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.referralBg, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.primaryBorder },
  hostBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8 },
});
