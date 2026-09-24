import type { Category, CompetitionInput, EditableCompetition, LocalizedText, Timeline } from '@/api/types';
import type { LocalizedValue } from '@/components/form/LocalizedField';
import type { StringKey } from '@/i18n/strings';

// Form state keeps user-typed strings (amounts in rupees) and converts to the API shape
// (paise, trimmed, optional Hindi) only when saving.

export interface CompetitionFormState {
  title: LocalizedValue;
  category: Category;
  tags: LocalizedValue[];
  isMultiWin: boolean;
  certificateForWinners: boolean;
  timeline: Record<keyof Timeline, Date>;
  seatsTotal: string;
  entryFee: string;
  rewards: string[]; // amount in ₹ per position (index 0 = 1st)
  referralReward: string;
  judge: { name: string; title: LocalizedValue; experienceYears: string; avatarPath: string | null; avatarPreview: string | null; introVideoUrl: string };
  about: LocalizedValue;
  judgingParameters: { title: LocalizedValue; weight: string }[];
  rules: LocalizedValue[];
  disclaimer: LocalizedValue;
  refundPolicyUrl: string;
  prizeInfoVideoUrl: string;
}

export const STEPS = ['basics', 'schedule', 'prizes', 'judge', 'content', 'review'] as const;
export type Step = (typeof STEPS)[number];
export type FormErrors = Record<string, string>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const emptyL = (): LocalizedValue => ({ en: '', hi: '' });
const toL = (v: LocalizedText | null | undefined): LocalizedValue => ({ en: v?.en ?? '', hi: v?.hi ?? '' });

/** Rounded to the next hour so default times look intentional. */
export function defaultForm(now: Date): CompetitionFormState {
  const base = Math.ceil(now.getTime() / HOUR) * HOUR;
  return {
    title: emptyL(),
    category: 'dance',
    tags: [],
    isMultiWin: true,
    certificateForWinners: true,
    timeline: {
      registrationOpensAt: new Date(base),
      registrationClosesAt: new Date(base + 7 * DAY),
      submissionStartsAt: new Date(base + 2 * DAY),
      submissionEndsAt: new Date(base + 14 * DAY),
      resultAt: new Date(base + 16 * DAY),
    },
    seatsTotal: '20',
    entryFee: '99',
    rewards: ['500', '300', '200'],
    referralReward: '10',
    judge: { name: '', title: emptyL(), experienceYears: '', avatarPath: null, avatarPreview: null, introVideoUrl: '' },
    about: emptyL(),
    judgingParameters: [],
    rules: [],
    disclaimer: { en: 'Only contributions from paid participants will be considered for judging.', hi: 'केवल भुगतान करने वाले प्रतिभागियों की प्रविष्टियों पर ही निर्णय हेतु विचार किया जाएगा।' },
    refundPolicyUrl: '',
    prizeInfoVideoUrl: '',
  };
}

const rupees = (paise: number) => String(paise / 100);

export function fromEditable(c: EditableCompetition, judgeAvatarPreview: string | null): CompetitionFormState {
  const d = (iso: string) => new Date(iso);
  return {
    title: toL(c.title),
    category: c.category,
    tags: c.tags.map(toL),
    isMultiWin: c.isMultiWin,
    certificateForWinners: c.certificateForWinners,
    timeline: {
      registrationOpensAt: d(c.timeline.registrationOpensAt),
      registrationClosesAt: d(c.timeline.registrationClosesAt),
      submissionStartsAt: d(c.timeline.submissionStartsAt),
      submissionEndsAt: d(c.timeline.submissionEndsAt),
      resultAt: d(c.timeline.resultAt),
    },
    seatsTotal: String(c.seats.total),
    entryFee: rupees(c.entryFee),
    rewards: [...c.rewards].sort((a, b) => a.position - b.position).map((r) => rupees(r.amount)),
    referralReward: rupees(c.referralRewardPerSignup),
    judge: {
      name: c.judge?.name ?? '',
      title: toL(c.judge?.title),
      experienceYears: c.judge?.experienceYears != null ? String(c.judge.experienceYears) : '',
      avatarPath: c.judge?.avatarUrl ?? null,
      avatarPreview: judgeAvatarPreview,
      introVideoUrl: c.judge?.introVideoUrl ?? '',
    },
    about: toL(c.content.about),
    judgingParameters: c.content.judgingParameters.map((p) => ({ title: toL(p.title), weight: p.weight != null ? String(p.weight) : '' })),
    rules: c.content.rulesEligibility.map(toL),
    disclaimer: toL(c.disclaimer),
    refundPolicyUrl: c.refundPolicyUrl ?? '',
    prizeInfoVideoUrl: c.prizeInfoVideoUrl ?? '',
  };
}

// ---------------------------------------------------------------------------

/** "99" / "99.5" → 9950 paise; anything else → NaN. */
export function toPaise(value: string): number {
  const v = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return NaN;
  return Math.round(Number(v) * 100);
}

const toInt = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN);

const loc = (v: LocalizedValue): LocalizedText => ({ en: v.en.trim(), ...(v.hi.trim() && { hi: v.hi.trim() }) });
const nonEmpty = (v: LocalizedValue) => v.en.trim() !== '';
const opt = (s: string) => (s.trim() ? s.trim() : undefined);

export const prizePoolPaise = (s: CompetitionFormState) => s.rewards.reduce((sum, r) => sum + (toPaise(r) || 0), 0);

export function toPayload(s: CompetitionFormState): CompetitionInput {
  const years = toInt(s.judge.experienceYears);
  return {
    title: loc(s.title),
    category: s.category,
    tags: s.tags.filter(nonEmpty).map(loc),
    isMultiWin: s.isMultiWin,
    certificateForWinners: s.certificateForWinners,
    entryFee: toPaise(s.entryFee),
    rewards: s.rewards.map((r, i) => ({ position: i + 1, amount: toPaise(r) })),
    seatsTotal: toInt(s.seatsTotal),
    timeline: {
      registrationOpensAt: s.timeline.registrationOpensAt.toISOString(),
      registrationClosesAt: s.timeline.registrationClosesAt.toISOString(),
      submissionStartsAt: s.timeline.submissionStartsAt.toISOString(),
      submissionEndsAt: s.timeline.submissionEndsAt.toISOString(),
      resultAt: s.timeline.resultAt.toISOString(),
    },
    judge: {
      name: s.judge.name.trim(),
      title: loc(s.judge.title),
      ...(Number.isFinite(years) && { experienceYears: years }),
      ...(s.judge.avatarPath && { avatarUrl: s.judge.avatarPath }),
      ...(opt(s.judge.introVideoUrl) && { introVideoUrl: opt(s.judge.introVideoUrl) }),
    },
    content: {
      about: loc(s.about),
      judgingParameters: s.judgingParameters
        .filter((p) => nonEmpty(p.title))
        .map((p) => ({ title: loc(p.title), ...(p.weight.trim() && { weight: toInt(p.weight) }) })),
      rulesEligibility: s.rules.filter(nonEmpty).map(loc),
    },
    ...(nonEmpty(s.disclaimer) && { disclaimer: loc(s.disclaimer) }),
    ...(opt(s.refundPolicyUrl) && { refundPolicyUrl: opt(s.refundPolicyUrl) }),
    ...(opt(s.prizeInfoVideoUrl) && { prizeInfoVideoUrl: opt(s.prizeInfoVideoUrl) }),
    referralRewardPerSignup: toPaise(s.referralReward || '0'),
  };
}

// ---------------------------------------------------------------------------
// Client-side checks per step, for fast feedback. The server validates everything again.

type T = (key: StringKey, params?: Record<string, string | number>) => string;
const isLink = (v: string) => !v.trim() || /^https?:\/\/\S+$/i.test(v.trim());

export function validateStep(step: Step, s: CompetitionFormState, t: T, minSeats = 1): FormErrors {
  const e: FormErrors = {};
  if (step === 'basics') {
    if (!s.title.en.trim()) e['title'] = t('required');
  }
  if (step === 'schedule') {
    const tl = s.timeline;
    if (!(tl.registrationOpensAt < tl.registrationClosesAt)) e['timeline.registrationClosesAt'] = t('errRegCloses');
    if (!(tl.submissionStartsAt < tl.submissionEndsAt)) e['timeline.submissionEndsAt'] = t('errSubEnds');
    else if (!(tl.registrationClosesAt <= tl.submissionEndsAt)) e['timeline.submissionEndsAt'] = t('errSubOpenUntilReg');
    if (!(tl.submissionEndsAt <= tl.resultAt)) e['timeline.resultAt'] = t('errResults');
  }
  if (step === 'prizes') {
    const seats = toInt(s.seatsTotal);
    if (!Number.isFinite(seats)) e['seatsTotal'] = t('invalidNumber');
    else if (seats < Math.max(1, minSeats)) e['seatsTotal'] = minSeats > 1 ? t('seatsTakenHint', { n: minSeats }) : t('atLeastOne');
    if (!Number.isFinite(toPaise(s.entryFee))) e['entryFee'] = t('invalidNumber');
    if (!s.rewards.length) e['rewards'] = t('required');
    s.rewards.forEach((r, i) => {
      if (!Number.isFinite(toPaise(r))) e[`rewards.${i}`] = t('invalidNumber');
    });
    if (!Number.isFinite(toPaise(s.referralReward || '0'))) e['referralRewardPerSignup'] = t('invalidNumber');
  }
  if (step === 'judge') {
    if (!s.judge.name.trim()) e['judge.name'] = t('required');
    if (!s.judge.title.en.trim()) e['judge.title'] = t('required');
    if (s.judge.experienceYears.trim() && !Number.isFinite(toInt(s.judge.experienceYears))) e['judge.experienceYears'] = t('invalidNumber');
    if (!isLink(s.judge.introVideoUrl)) e['judge.introVideoUrl'] = 'https://…';
  }
  if (step === 'content') {
    if (!s.about.en.trim()) e['content.about'] = t('required');
    const weights = s.judgingParameters.filter((p) => nonEmpty(p.title) && p.weight.trim());
    if (weights.length && weights.reduce((sum, p) => sum + (toInt(p.weight) || 0), 0) !== 100) e['content.judgingParameters'] = t('weightsHint');
    if (!isLink(s.refundPolicyUrl)) e['refundPolicyUrl'] = 'https://…';
    if (!isLink(s.prizeInfoVideoUrl)) e['prizeInfoVideoUrl'] = 'https://…';
  }
  return e;
}

/** Which step a server error path belongs to, so the form can jump there. */
export function stepForPath(path: string): Step {
  if (path.startsWith('timeline')) return 'schedule';
  if (/^(seatsTotal|entryFee|rewards|referralRewardPerSignup)/.test(path)) return 'prizes';
  if (path.startsWith('judge')) return 'judge';
  if (/^(content|disclaimer|refundPolicyUrl|prizeInfoVideoUrl)/.test(path)) return 'content';
  return 'basics';
}

/** Server issues use paths like "title.en" or "rewards"; the form keys errors by the field. */
export function errorKey(path: string): string {
  if (path.startsWith('title')) return 'title';
  if (path.startsWith('judge.title')) return 'judge.title';
  if (path.startsWith('content.about')) return 'content.about';
  if (path.startsWith('content.judgingParameters')) return 'content.judgingParameters';
  if (/^rewards\.\d+/.test(path)) return path.split('.').slice(0, 2).join('.');
  return path;
}
