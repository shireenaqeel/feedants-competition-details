import { Ionicons } from '@expo/vector-icons';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import { CATEGORIES, PHASE_FILTERS, type Category, type CompetitionFilters, type PhaseFilter, type SortOption } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { ChipSelect, SwitchRow } from '@/components/form/Controls';
import { FieldLabel } from '@/components/form/Field';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { colors, fonts, radius } from '@/theme';
import { CompetitionListItem } from './components/CompetitionListItem';
import { LanguageToggle } from './components/ScreenHeader';

type SheetFilters = Pick<CompetitionFilters, 'category' | 'fee' | 'hasSpots' | 'sort'>;
const DEFAULT_SHEET: SheetFilters = { sort: 'closing' };

// "Saved" sits alongside the phase chips (Active / Ongoing / … / All) as a single-select filter,
// even though on the wire it's a separate `saved` query param rather than a `phase` value.
type PhaseOrSaved = PhaseFilter | 'all' | 'saved';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Competition browser: search, stage chips and a filter sheet. Filtering happens on the server. */
export function CompetitionListScreen({ initialCategory }: { initialCategory?: Category }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState('');
  // Default "Active" (upcoming + ongoing): stale competitions only appear under Past / All.
  const [phase, setPhase] = useState<PhaseOrSaved>('active');
  const [sheet, setSheet] = useState<SheetFilters>({ ...DEFAULT_SHEET, category: initialCategory });
  const [sheetOpen, setSheetOpen] = useState(false);
  const q = useDebounced(search.trim(), 300);

  const selectPhase = (next: PhaseOrSaved) => {
    // Saved competitions are personal: a guest tapping the chip is sent to log in instead of
    // seeing an empty (or erroring) list.
    if (next === 'saved' && !user) {
      router.push('/login');
      return;
    }
    setPhase(next);
  };

  // Logging out while "Saved" is selected (e.g. from another tab) falls back to Active for this
  // render rather than firing a query the server would reject; `phase` itself is left alone, so
  // logging back in restores the Saved filter.
  const effectivePhase = phase === 'saved' && !user ? 'active' : phase;

  const filters = useMemo<CompetitionFilters>(
    () => ({
      ...sheet,
      phase: effectivePhase === 'all' || effectivePhase === 'saved' ? undefined : effectivePhase,
      saved: effectivePhase === 'saved' || undefined,
      q: q || undefined,
    }),
    [sheet, effectivePhase, q],
  );

  const query = useInfiniteQuery({
    queryKey: queryKeys.competitions(lang, filters),
    queryFn: ({ pageParam }) => endpoints.competitions(lang, filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData, // keep the list on screen while filters change
  });

  const items = query.data?.pages.flatMap((p) => p.competitions) ?? [];
  const activeSheetCount = [sheet.category, sheet.fee, sheet.hasSpots, sheet.sort !== 'closing' ? sheet.sort : undefined].filter(Boolean).length;
  const resetAll = () => {
    setSearch('');
    setPhase('active');
    setSheet(DEFAULT_SHEET);
  };

  if (query.isPending) return <LoadingView label={t('loading')} />;
  if (query.isError && !items.length) {
    return <ErrorView title={t('somethingWrong')} message={t('offline')} actionLabel={t('retry')} onAction={() => void query.refetch()} />;
  }

  const header = (
    <View style={{ gap: 12 }}>
      <View style={styles.header}>
        <Text size={22} weight="bold">
          {t('allCompetitions')}
        </Text>
        <LanguageToggle />
      </View>
      <>
          <View style={styles.searchRow}>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.textSubtle} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('searchPlaceholder')}
                placeholderTextColor={colors.textSubtle}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel={t('searchPlaceholder')}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel={t('reset')}>
                  <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
                </Pressable>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('filters')} onPress={() => setSheetOpen(true)} style={[styles.filterBtn, activeSheetCount > 0 && styles.filterBtnActive]}>
              <Ionicons name="options-outline" size={20} color={activeSheetCount ? '#fff' : colors.text} />
              {activeSheetCount > 0 && (
                <Text size={12} weight="semibold" color="#fff">
                  {activeSheetCount}
                </Text>
              )}
            </Pressable>
          </View>
          <ChipSelect<PhaseOrSaved>
            scroll
            options={[
              ...PHASE_FILTERS.map((p) => ({ value: p, label: t(`phaseFilter_${p}`) })),
              { value: 'all', label: t('filterAll') },
              { value: 'saved', label: t('phaseFilter_saved') },
            ]}
            value={effectivePhase}
            onChange={selectPhase}
          />
        </>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={header}
        renderItem={({ item }) => <CompetitionListItem item={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color={colors.textSubtle} />
            <Text size={15} weight="semibold" align="center">
              {t('noResults')}
            </Text>
            <Text size={13} color={colors.textMuted} align="center">
              {t('noResultsHint')}
            </Text>
            <Button label={t('reset')} variant="outline" size="sm" onPress={resetAll} />
          </View>
        }
      />
      <FilterSheet key={sheetOpen ? 'open' : 'closed'} visible={sheetOpen} value={sheet} onApply={setSheet} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

function FilterSheet({ visible, value, onApply, onClose }: { visible: boolean; value: SheetFilters; onApply: (v: SheetFilters) => void; onClose: () => void }) {
  const { t } = useLanguage();
  // Remounted each time it opens (see `key` below), so the draft starts from the applied filters.
  const [draft, setDraft] = useState(value);

  const sorts: SortOption[] = ['closing', 'newest', 'prize'];
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <Text size={18} weight="semibold">
          {t('filters')}
        </Text>
        <View style={{ gap: 8 }}>
          <FieldLabel label={t('category')} />
          <ChipSelect<Category | 'all'>
            options={[{ value: 'all', label: t('filterAll') }, ...CATEGORIES.map((c) => ({ value: c, label: t(`cat_${c}`) }))]}
            value={draft.category ?? 'all'}
            onChange={(c) => setDraft({ ...draft, category: c === 'all' ? undefined : c })}
          />
        </View>
        <View style={{ gap: 8 }}>
          <FieldLabel label={t('feeFilter')} />
          <ChipSelect<'any' | 'free' | 'paid'>
            options={[
              { value: 'any', label: t('feeAny') },
              { value: 'free', label: t('feeFree') },
              { value: 'paid', label: t('feePaid') },
            ]}
            value={draft.fee ?? 'any'}
            onChange={(f) => setDraft({ ...draft, fee: f === 'any' ? undefined : f })}
          />
        </View>
        <SwitchRow label={t('onlyWithSpots')} value={Boolean(draft.hasSpots)} onChange={(hasSpots) => setDraft({ ...draft, hasSpots: hasSpots || undefined })} />
        <View style={{ gap: 8 }}>
          <FieldLabel label={t('sortBy')} />
          <ChipSelect options={sorts.map((s) => ({ value: s, label: t(`sort_${s}`) }))} value={draft.sort ?? 'closing'} onChange={(sort) => setDraft({ ...draft, sort })} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label={t('reset')} variant="outline" onPress={() => setDraft(DEFAULT_SHEET)} style={{ flex: 1 }} />
          <Button
            label={t('showResults')}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            style={{ flex: 2 }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchRow: { flexDirection: 'row', gap: 10 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 44 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text, paddingVertical: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 24 },
});
