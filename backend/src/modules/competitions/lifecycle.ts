// Pure functions: the single source of truth for competition phase, viewer state and allowed actions.
// Used both to render the details payload and to re-check rules inside every write endpoint.

export type Phase = 'cancelled' | 'upcoming' | 'registration_open' | 'submission_open' | 'judging' | 'results_out';

export type MilestoneType =
  | 'registration_opens'
  | 'registration_closes'
  | 'submission_starts'
  | 'submission_ends'
  | 'results';

export interface TimelineInput {
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  submissionStartsAt: Date;
  submissionEndsAt: Date;
  resultAt: Date;
}

export interface SeatsInput {
  total: number;
  confirmed: number;
  held: number;
}

export interface LifecycleInput {
  status: string;
  timeline: TimelineInput;
  seats: SeatsInput;
}

/** Coarse bucket for badges and filters: never shows an old competition as active. */
export type Stage = 'upcoming' | 'ongoing' | 'past';

export interface Lifecycle {
  phase: Phase;
  stage: Stage;
  registrationOpen: boolean;
  submissionOpen: boolean;
  isFull: boolean;
  nextMilestone: { type: MilestoneType; at: Date } | null;
  urgency: boolean;
}

/** "Hurry up!" thresholds. */
export const URGENCY_WINDOW_MS = 48 * 60 * 60 * 1000;
export const URGENCY_SPOTS_RATIO = 0.25;

export function spotsLeft(seats: SeatsInput): number {
  return Math.max(0, seats.total - seats.confirmed - seats.held);
}

export function computeLifecycle(c: LifecycleInput, now: Date): Lifecycle {
  const tl = c.timeline;
  const t = now.getTime();
  const cancelled = c.status === 'cancelled';

  const registrationOpen = !cancelled && tl.registrationOpensAt.getTime() <= t && t < tl.registrationClosesAt.getTime();
  const submissionOpen = !cancelled && tl.submissionStartsAt.getTime() <= t && t < tl.submissionEndsAt.getTime();

  let phase: Phase;
  if (cancelled) phase = 'cancelled';
  else if (t < tl.registrationOpensAt.getTime()) phase = 'upcoming';
  else if (registrationOpen) phase = 'registration_open';
  else if (t < tl.submissionEndsAt.getTime()) phase = 'submission_open';
  else if (t < tl.resultAt.getTime()) phase = 'judging';
  else phase = 'results_out';

  const milestones: { type: MilestoneType; at: Date }[] = [
    { type: 'registration_opens', at: tl.registrationOpensAt },
    { type: 'registration_closes', at: tl.registrationClosesAt },
    { type: 'submission_starts', at: tl.submissionStartsAt },
    { type: 'submission_ends', at: tl.submissionEndsAt },
    { type: 'results', at: tl.resultAt },
  ];
  const nextMilestone = cancelled
    ? null
    : (milestones.filter((m) => m.at.getTime() > t).sort((a, b) => a.at.getTime() - b.at.getTime())[0] ?? null);

  const left = spotsLeft(c.seats);
  const isFull = left === 0;
  const closingSoon = tl.registrationClosesAt.getTime() - t < URGENCY_WINDOW_MS;
  const fewSpots = left / c.seats.total < URGENCY_SPOTS_RATIO;
  const urgency = registrationOpen && !isFull && (closingSoon || fewSpots);

  const stage: Stage =
    cancelled || t >= tl.resultAt.getTime() ? 'past' : t < tl.registrationOpensAt.getTime() ? 'upcoming' : 'ongoing';

  return { phase, stage, registrationOpen, submissionOpen, isFull, nextMilestone, urgency };
}

// ---------------------------------------------------------------------------
// Viewer state

export type ViewerState =
  | 'guest'
  | 'organizer'
  | 'not_registered'
  | 'payment_pending'
  | 'registered'
  | 'submitted'
  | 'refund_pending'
  | 'winner';

export interface ViewerInput {
  authenticated: boolean;
  isOrganizer?: boolean;
  registration: { status: string; holdExpiresAt?: Date | null } | null;
  hasSubmission: boolean;
  resultPosition: number | null;
}

export function computeViewerState(v: ViewerInput, now: Date): ViewerState {
  if (!v.authenticated) return 'guest';
  if (v.isOrganizer) return 'organizer';
  if (v.resultPosition !== null) return 'winner';
  const reg = v.registration;
  if (!reg) return 'not_registered';
  switch (reg.status) {
    case 'pending_payment':
      // An expired hold that the sweeper has not processed yet counts as "not registered".
      return reg.holdExpiresAt && reg.holdExpiresAt.getTime() > now.getTime() ? 'payment_pending' : 'not_registered';
    case 'confirmed':
      return v.hasSubmission ? 'submitted' : 'registered';
    case 'refund_required':
      return 'refund_pending';
    default:
      return 'not_registered';
  }
}

// ---------------------------------------------------------------------------
// Allowed actions. The client maps these to CTA labels; the server re-checks them on every write.

export type ActionReason =
  | 'LOGIN_REQUIRED'
  | 'IS_ORGANIZER'
  | 'NOT_PUBLISHED'
  | 'COMPETITION_CANCELLED'
  | 'REGISTRATION_NOT_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'COMPETITION_FULL'
  | 'ALREADY_REGISTERED'
  | 'PAYMENT_PENDING'
  | 'NO_PENDING_PAYMENT'
  | 'NOT_REGISTERED'
  | 'SUBMISSION_NOT_STARTED'
  | 'SUBMISSION_CLOSED'
  | 'RESULTS_NOT_OUT'
  | 'NOT_PARTICIPANT'
  | 'RATING_NOT_OPEN';

export interface Action {
  allowed: boolean;
  reason?: ActionReason;
}

export interface Actions {
  register: Action;
  pay: Action;
  submit: Action;
  viewResults: Action;
  rate: Action;
}

const allow: Action = { allowed: true };
const deny = (reason: ActionReason): Action => ({ allowed: false, reason });

export function registerAction(lc: Lifecycle, viewer: ViewerState, status = 'published'): Action {
  if (lc.phase === 'cancelled') return deny('COMPETITION_CANCELLED');
  if (viewer === 'organizer') return deny('IS_ORGANIZER');
  if (status === 'draft') return deny('NOT_PUBLISHED');
  if (viewer === 'payment_pending') return deny('PAYMENT_PENDING');
  if (['registered', 'submitted', 'winner', 'refund_pending'].includes(viewer)) return deny('ALREADY_REGISTERED');
  if (lc.phase === 'upcoming') return deny('REGISTRATION_NOT_OPEN');
  if (!lc.registrationOpen) return deny('REGISTRATION_CLOSED');
  if (lc.isFull) return deny('COMPETITION_FULL');
  if (viewer === 'guest') return deny('LOGIN_REQUIRED');
  return allow;
}

export function submitAction(lc: Lifecycle, viewer: ViewerState, tl: TimelineInput, now: Date): Action {
  if (lc.phase === 'cancelled') return deny('COMPETITION_CANCELLED');
  if (viewer === 'guest') return deny('LOGIN_REQUIRED');
  if (viewer === 'organizer') return deny('IS_ORGANIZER');
  if (viewer !== 'registered' && viewer !== 'submitted') return deny('NOT_REGISTERED');
  if (now.getTime() < tl.submissionStartsAt.getTime()) return deny('SUBMISSION_NOT_STARTED');
  if (!lc.submissionOpen) return deny('SUBMISSION_CLOSED');
  return allow;
}

/** Participants rate the competition and its organizer once it has ended (results announced). */
export function rateAction(lc: Lifecycle, viewer: ViewerState, tl: TimelineInput, now: Date): Action {
  if (viewer === 'guest') return deny('LOGIN_REQUIRED');
  if (viewer === 'organizer') return deny('IS_ORGANIZER');
  if (lc.phase === 'cancelled') return deny('COMPETITION_CANCELLED');
  if (viewer !== 'registered' && viewer !== 'submitted' && viewer !== 'winner') return deny('NOT_PARTICIPANT');
  if (now.getTime() < tl.resultAt.getTime()) return deny('RATING_NOT_OPEN');
  return allow;
}

export function computeActions(lc: Lifecycle, viewer: ViewerState, tl: TimelineInput, now: Date, status = 'published'): Actions {
  return {
    register: registerAction(lc, viewer, status),
    pay: viewer === 'payment_pending' ? allow : deny('NO_PENDING_PAYMENT'),
    submit: submitAction(lc, viewer, tl, now),
    viewResults: lc.phase === 'results_out' ? allow : deny('RESULTS_NOT_OUT'),
    rate: rateAction(lc, viewer, tl, now),
  };
}
