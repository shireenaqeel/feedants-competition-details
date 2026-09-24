import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { CATEGORIES } from '@/api/types';
import { AddButton, ChipSelect, SwitchRow } from '@/components/form/Controls';
import { DateTimeField } from '@/components/form/DateTimeField';
import { FieldError, FieldLabel, TextField } from '@/components/form/Field';
import { ImageField } from '@/components/form/ImageField';
import { LocalizedField, type LocalizedValue } from '@/components/form/LocalizedField';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatDate, formatMoney, formatTime, ordinal } from '@/lib/format';
import { colors, radius } from '@/theme';
import { prizePoolPaise, type CompetitionFormState, type FormErrors } from './formModel';

export interface StepProps {
  state: CompetitionFormState;
  update: (patch: Partial<CompetitionFormState>) => void;
  errors: FormErrors;
  locks?: { entryFee: boolean; seatsTaken: number };
}

const emptyL = (): LocalizedValue => ({ en: '', hi: '' });

function RemoveButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={{ padding: 4 }}>
      <Ionicons name="close-circle" size={22} color={colors.textSubtle} />
    </Pressable>
  );
}

/** Editable list of English/Hindi items (tags, rules). */
function LocalizedList({ items, onChange, addLabel, max }: { items: LocalizedValue[]; onChange: (v: LocalizedValue[]) => void; addLabel: string; max: number }) {
  const { t } = useLanguage();
  return (
    <View style={{ gap: 10 }}>
      {items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          <View style={{ flex: 1, gap: 6 }}>
            <TextField placeholder={t('english')} value={item.en} onChangeText={(en) => onChange(items.map((x, j) => (j === i ? { ...x, en } : x)))} />
            <TextField placeholder={t('hindiOptional')} value={item.hi} onChangeText={(hi) => onChange(items.map((x, j) => (j === i ? { ...x, hi } : x)))} />
          </View>
          <RemoveButton label={t('remove')} onPress={() => onChange(items.filter((_, j) => j !== i))} />
        </View>
      ))}
      <AddButton label={addLabel} disabled={items.length >= max} onPress={() => onChange([...items, emptyL()])} />
    </View>
  );
}

export function BasicsStep({ state, update, errors }: StepProps) {
  const { t } = useLanguage();
  return (
    <>
      <LocalizedField label={t('fieldTitle')} value={state.title} onChange={(title) => update({ title })} error={errors['title']} maxLength={120} />
      <View style={{ gap: 8 }}>
        <FieldLabel label={t('fieldCategory')} />
        <ChipSelect options={CATEGORIES.map((c) => ({ value: c, label: t(`cat_${c}`) }))} value={state.category} onChange={(category) => update({ category })} />
      </View>
      <View style={{ gap: 8 }}>
        <FieldLabel label={t('fieldTags')} />
        <LocalizedList items={state.tags} onChange={(tags) => update({ tags })} addLabel={t('addTag')} max={6} />
      </View>
      <SwitchRow label={t('fieldMultiWin')} hint={t('fieldMultiWinHint')} value={state.isMultiWin} onChange={(isMultiWin) => update({ isMultiWin })} />
      <SwitchRow label={t('fieldCertificate')} value={state.certificateForWinners} onChange={(certificateForWinners) => update({ certificateForWinners })} />
    </>
  );
}

export function ScheduleStep({ state, update, errors }: StepProps) {
  const { t } = useLanguage();
  const set = (key: keyof CompetitionFormState['timeline']) => (d: Date) => update({ timeline: { ...state.timeline, [key]: d } });
  return (
    <>
      <Text size={12} color={colors.textMuted}>
        {t('scheduleHint')}
      </Text>
      <DateTimeField label={t('fieldRegOpens')} value={state.timeline.registrationOpensAt} onChange={set('registrationOpensAt')} error={errors['timeline.registrationOpensAt']} />
      <DateTimeField label={t('fieldRegCloses')} value={state.timeline.registrationClosesAt} onChange={set('registrationClosesAt')} error={errors['timeline.registrationClosesAt']} />
      <DateTimeField label={t('fieldSubStarts')} value={state.timeline.submissionStartsAt} onChange={set('submissionStartsAt')} error={errors['timeline.submissionStartsAt']} />
      <DateTimeField label={t('fieldSubEnds')} value={state.timeline.submissionEndsAt} onChange={set('submissionEndsAt')} error={errors['timeline.submissionEndsAt']} />
      <DateTimeField label={t('fieldResults')} value={state.timeline.resultAt} onChange={set('resultAt')} error={errors['timeline.resultAt']} />
    </>
  );
}

export function PrizesStep({ state, update, errors, locks }: StepProps) {
  const { t, lang } = useLanguage();
  return (
    <>
      <TextField
        label={t('fieldSeats')}
        hint={locks?.seatsTaken ? t('seatsTakenHint', { n: locks.seatsTaken }) : undefined}
        keyboardType="number-pad"
        value={state.seatsTotal}
        onChangeText={(seatsTotal) => update({ seatsTotal })}
        error={errors['seatsTotal']}
        maxLength={6}
      />
      <TextField
        label={t('fieldEntryFee')}
        hint={locks?.entryFee ? t('entryFeeLocked') : t('entryFeeHint')}
        keyboardType="decimal-pad"
        value={state.entryFee}
        onChangeText={(entryFee) => update({ entryFee })}
        editable={!locks?.entryFee}
        error={errors['entryFee']}
        prefix={<Text color={colors.textMuted}>₹</Text>}
      />
      <View style={{ gap: 8 }}>
        <FieldLabel label={t('fieldRewards')} />
        {state.rewards.map((amount, i) => (
          <View key={i} style={styles.rewardRow}>
            <Text size={13} weight="medium" style={{ width: 90 }}>
              {t('positionWinner', { pos: ordinal(i + 1, lang) })}
            </Text>
            <View style={{ flex: 1 }}>
              <TextField
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(v) => update({ rewards: state.rewards.map((r, j) => (j === i ? v : r)) })}
                error={errors[`rewards.${i}`]}
                prefix={<Text color={colors.textMuted}>₹</Text>}
              />
            </View>
            {i === state.rewards.length - 1 && state.rewards.length > 1 ? (
              <RemoveButton label={t('remove')} onPress={() => update({ rewards: state.rewards.slice(0, -1) })} />
            ) : (
              <View style={{ width: 30 }} />
            )}
          </View>
        ))}
        <FieldError message={errors['rewards']} />
        <AddButton label={t('addReward')} disabled={state.rewards.length >= 20} onPress={() => update({ rewards: [...state.rewards, ''] })} />
        <View style={styles.pool}>
          <Text weight="medium">{t('prizePoolTotal')}</Text>
          <Text size={18} weight="bold" color={colors.primary}>
            {formatMoney(prizePoolPaise(state))}
          </Text>
        </View>
      </View>
      <TextField
        label={t('fieldReferral')}
        keyboardType="decimal-pad"
        value={state.referralReward}
        onChangeText={(referralReward) => update({ referralReward })}
        error={errors['referralRewardPerSignup']}
        prefix={<Text color={colors.textMuted}>₹</Text>}
      />
    </>
  );
}

export function JudgeStep({ state, update, errors }: StepProps) {
  const { t } = useLanguage();
  const judge = state.judge;
  const set = (patch: Partial<CompetitionFormState['judge']>) => update({ judge: { ...judge, ...patch } });
  return (
    <>
      <ImageField
        label={t('fieldJudgePhoto')}
        previewUrl={judge.avatarPreview}
        onChange={(img) => set({ avatarPath: img?.path ?? null, avatarPreview: img?.url ?? null })}
      />
      <TextField label={t('fieldJudgeName')} value={judge.name} onChangeText={(name) => set({ name })} error={errors['judge.name']} maxLength={80} />
      <LocalizedField label={t('fieldJudgeTitle')} value={judge.title} onChange={(title) => set({ title })} error={errors['judge.title']} maxLength={120} />
      <TextField
        label={t('fieldJudgeYears')}
        keyboardType="number-pad"
        value={judge.experienceYears}
        onChangeText={(experienceYears) => set({ experienceYears })}
        error={errors['judge.experienceYears']}
        maxLength={2}
      />
      <TextField
        label={t('fieldIntroVideo')}
        hint={t('videoLinkHint')}
        placeholder="https://youtube.com/watch?v=…"
        autoCapitalize="none"
        keyboardType="url"
        value={judge.introVideoUrl}
        onChangeText={(introVideoUrl) => set({ introVideoUrl })}
        error={errors['judge.introVideoUrl']}
      />
    </>
  );
}

export function ContentStep({ state, update, errors }: StepProps) {
  const { t } = useLanguage();
  return (
    <>
      <LocalizedField label={t('fieldAbout')} value={state.about} onChange={(about) => update({ about })} error={errors['content.about']} multiline maxLength={4000} />
      <View style={{ gap: 8 }}>
        <FieldLabel label={t('fieldJudging')} hint={t('weightsHint')} />
        {state.judgingParameters.map((p, i) => (
          <View key={i} style={styles.listItem}>
            <View style={{ flex: 1, gap: 6 }}>
              <TextField
                placeholder={t('english')}
                value={p.title.en}
                onChangeText={(en) => update({ judgingParameters: state.judgingParameters.map((x, j) => (j === i ? { ...x, title: { ...x.title, en } } : x)) })}
              />
              <TextField
                placeholder={t('hindiOptional')}
                value={p.title.hi}
                onChangeText={(hi) => update({ judgingParameters: state.judgingParameters.map((x, j) => (j === i ? { ...x, title: { ...x.title, hi } } : x)) })}
              />
              <TextField
                placeholder={t('weightPct')}
                keyboardType="number-pad"
                maxLength={3}
                value={p.weight}
                onChangeText={(weight) => update({ judgingParameters: state.judgingParameters.map((x, j) => (j === i ? { ...x, weight } : x)) })}
              />
            </View>
            <RemoveButton label={t('remove')} onPress={() => update({ judgingParameters: state.judgingParameters.filter((_, j) => j !== i) })} />
          </View>
        ))}
        <FieldError message={errors['content.judgingParameters']} />
        <AddButton
          label={t('addParameter')}
          disabled={state.judgingParameters.length >= 10}
          onPress={() => update({ judgingParameters: [...state.judgingParameters, { title: emptyL(), weight: '' }] })}
        />
      </View>
      <View style={{ gap: 8 }}>
        <FieldLabel label={t('fieldRules')} />
        <LocalizedList items={state.rules} onChange={(rules) => update({ rules })} addLabel={t('addRule')} max={20} />
      </View>
      <LocalizedField label={t('fieldDisclaimer')} value={state.disclaimer} onChange={(disclaimer) => update({ disclaimer })} multiline maxLength={500} />
      <TextField label={t('fieldRefundUrl')} placeholder="https://…" autoCapitalize="none" keyboardType="url" value={state.refundPolicyUrl} onChangeText={(refundPolicyUrl) => update({ refundPolicyUrl })} error={errors['refundPolicyUrl']} />
      <TextField label={t('fieldPrizeVideo')} hint={t('videoLinkHint')} placeholder="https://youtube.com/watch?v=…" autoCapitalize="none" keyboardType="url" value={state.prizeInfoVideoUrl} onChangeText={(prizeInfoVideoUrl) => update({ prizeInfoVideoUrl })} error={errors['prizeInfoVideoUrl']} />
    </>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text size={12} color={colors.textMuted} style={{ width: 120 }}>
        {label}
      </Text>
      <Text size={13} weight="medium" style={{ flex: 1 }}>
        {value || '-'}
      </Text>
    </View>
  );
}

export function ReviewStep({ state }: StepProps) {
  const { t, lang } = useLanguage();
  const when = (d: Date) => `${formatDate(d, lang)} ${formatTime(d)}`;
  return (
    <>
      <Text size={12} color={colors.textMuted}>
        {t('reviewHint')}
      </Text>
      <View style={styles.reviewBox}>
        <ReviewRow label={t('fieldTitle')} value={[state.title.en, state.title.hi].filter(Boolean).join(' / ')} />
        <ReviewRow label={t('fieldCategory')} value={t(`cat_${state.category}`)} />
        <ReviewRow label={t('fieldRegOpens')} value={when(state.timeline.registrationOpensAt)} />
        <ReviewRow label={t('fieldRegCloses')} value={when(state.timeline.registrationClosesAt)} />
        <ReviewRow label={t('fieldSubStarts')} value={when(state.timeline.submissionStartsAt)} />
        <ReviewRow label={t('fieldSubEnds')} value={when(state.timeline.submissionEndsAt)} />
        <ReviewRow label={t('fieldResults')} value={when(state.timeline.resultAt)} />
        <ReviewRow label={t('fieldSeats')} value={state.seatsTotal} />
        <ReviewRow label={t('entryFee')} value={`₹ ${state.entryFee}`} />
        <ReviewRow label={t('prizePoolTotal')} value={`${formatMoney(prizePoolPaise(state))} (${state.rewards.length})`} />
        <ReviewRow label={t('judge')} value={state.judge.name} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.background },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pool: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12 },
  reviewBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, gap: 8, backgroundColor: colors.surface },
  reviewRow: { flexDirection: 'row', gap: 8 },
});
