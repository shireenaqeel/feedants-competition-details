import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import { Button } from '@/components/ui/Button';
import { ErrorView, LoadingView } from '@/components/ui/StateView';
import { Text } from '@/components/ui/Text';
import { API_URL } from '@/config/api';
import { errorMessage } from '@/features/competition/errors';
import { useLanguage } from '@/i18n/LanguageProvider';
import { notify } from '@/lib/confirm';
import { colors, radius } from '@/theme';
import { BasicsStep, ContentStep, JudgeStep, PrizesStep, ReviewStep, ScheduleStep, type StepProps } from './FormSteps';
import { defaultForm, errorKey, fromEditable, STEPS, stepForPath, toPayload, validateStep, type CompetitionFormState, type FormErrors, type Step } from './formModel';

const STEP_VIEWS: Record<Step, (p: StepProps) => React.ReactNode> = {
  basics: BasicsStep,
  schedule: ScheduleStep,
  prizes: PrizesStep,
  judge: JudgeStep,
  content: ContentStep,
  review: ReviewStep,
};

// Stored media paths ("/uploads/…") are shown through the API host.
const preview = (path: string | null) => (path ? (path.startsWith('/') ? `${API_URL}${path}` : path) : null);

export function CompetitionFormScreen({ competitionId }: { competitionId?: string }) {
  const { t } = useLanguage();
  const isEdit = Boolean(competitionId);
  const editable = useQuery({
    queryKey: queryKeys.editable(competitionId ?? 'new'),
    queryFn: () => endpoints.editableCompetition(competitionId!),
    enabled: isEdit,
    staleTime: 0,
    gcTime: 0,
  });

  if (isEdit && editable.isPending) return <LoadingView />;
  if (isEdit && !editable.data) {
    return <ErrorView title={t('somethingWrong')} message={errorMessage(editable.error, t)} actionLabel={t('retry')} onAction={() => void editable.refetch()} />;
  }
  const initial = editable.data ? fromEditable(editable.data.competition, preview(editable.data.competition.judge?.avatarUrl ?? null)) : defaultForm(new Date());
  return (
    <FormWizard
      competitionId={competitionId}
      initial={initial}
      status={editable.data?.competition.status ?? 'draft'}
      locks={editable.data ? { entryFee: editable.data.competition.locks.entryFee, seatsTaken: editable.data.competition.seats.taken } : undefined}
    />
  );
}

interface WizardProps {
  competitionId?: string;
  initial: CompetitionFormState;
  status: string;
  locks?: { entryFee: boolean; seatsTaken: number };
}

function FormWizard({ competitionId, initial, status, locks }: WizardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [state, setState] = useState(initial);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState<null | 'draft' | 'publish'>(null);
  const scroll = useRef<ScrollView>(null);

  const step = STEPS[stepIndex];
  const StepView = STEP_VIEWS[step];
  const isEdit = Boolean(competitionId);

  useEffect(() => scroll.current?.scrollTo({ y: 0, animated: false }), [stepIndex]);

  const update = (patch: Partial<CompetitionFormState>) => {
    setState((s) => ({ ...s, ...patch }));
    // Clear errors of edited fields as the user fixes them.
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) for (const k of Object.keys(next)) if (k === key || k.startsWith(`${key}.`)) delete next[k];
      return next;
    });
  };

  const goNext = () => {
    const stepErrors = validateStep(step, state, t, locks?.seatsTaken ?? 1);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const save = async (publish: boolean) => {
    // Re-check every step before sending.
    for (let i = 0; i < STEPS.length; i++) {
      const stepErrors = validateStep(STEPS[i], state, t, locks?.seatsTaken ?? 1);
      if (Object.keys(stepErrors).length) {
        setErrors(stepErrors);
        setStepIndex(i);
        return;
      }
    }
    setSaving(publish ? 'publish' : 'draft');
    try {
      const payload = toPayload(state);
      if (competitionId) {
        const { entryFee, ...rest } = payload;
        await endpoints.updateCompetition(competitionId, locks?.entryFee ? rest : { ...rest, entryFee });
        if (publish && status === 'draft') await endpoints.publishCompetition(competitionId);
      } else {
        await endpoints.createCompetition({ ...payload, publish });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['myCompetitions'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.competitionsAll }),
        queryClient.invalidateQueries({ queryKey: ['competition'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
      router.back();
      if (publish) notify(t('publishedToast'));
    } catch (e) {
      if (e instanceof ApiError && e.details.length) {
        const mapped: FormErrors = {};
        for (const d of e.details) mapped[errorKey(d.path)] ??= d.message;
        setErrors(mapped);
        setStepIndex(STEPS.indexOf(stepForPath(e.details[0].path)));
        notify(t('fixErrors'));
      } else {
        notify(t('somethingWrong'), errorMessage(e, t));
      }
    } finally {
      setSaving(null);
    }
  };

  const isLast = step === 'review';
  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('cancel')} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text size={17} weight="semibold">
            {isEdit ? t('formEditTitle') : t('formNewTitle')}
          </Text>
          <Text size={12} color={colors.textMuted}>
            {t('stepOf', { n: stepIndex + 1, total: STEPS.length })} · {t(`step_${step}`)}
          </Text>
        </View>
      </View>
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={t(`step_${s}`)}
            // Jumping back is always allowed; forward only through "Next" (validates).
            onPress={() => i < stepIndex && setStepIndex(i)}
            style={[styles.segment, i <= stepIndex && styles.segmentDone]}
          />
        ))}
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <StepView state={state} update={update} errors={errors} locks={locks} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {stepIndex > 0 && <Button label={t('back')} variant="outline" onPress={() => setStepIndex((i) => i - 1)} style={{ flex: 1 }} />}
        {!isLast && <Button label={t('next')} onPress={goNext} style={{ flex: 2 }} />}
        {isLast && (
          <>
            {(!isEdit || status === 'draft') && (
              <Button label={isEdit ? t('saveChanges') : t('saveDraft')} variant="outline" loading={saving === 'draft'} disabled={Boolean(saving)} onPress={() => save(false)} style={{ flex: 1.3 }} />
            )}
            {isEdit && status !== 'draft' ? (
              <Button label={t('saveChanges')} loading={saving === 'draft'} disabled={Boolean(saving)} onPress={() => save(false)} style={{ flex: 1.3 }} />
            ) : (
              <Button label={t('saveAndPublish')} loading={saving === 'publish'} disabled={Boolean(saving)} onPress={() => save(true)} style={{ flex: 1.3 }} />
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: 16 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.track },
  segmentDone: { backgroundColor: colors.primary },
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.sm },
});
