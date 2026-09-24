import { describe, expect, it } from 'vitest';
import {
  computeActions,
  computeLifecycle,
  computeViewerState,
  type LifecycleInput,
} from '../src/modules/competitions/lifecycle.js';

const d = (s: string) => new Date(`2026-08-${s}Z`);

// Mirrors the design: submissions start (6 Aug) before registration closes (10 Aug).
const comp = (over: Partial<LifecycleInput> = {}): LifecycleInput => ({
  status: 'published',
  seats: { total: 20, confirmed: 1, held: 0 },
  timeline: {
    registrationOpensAt: d('01T00:00:00'),
    registrationClosesAt: d('10T18:20:00'),
    submissionStartsAt: d('06T22:30:00'),
    submissionEndsAt: d('30T18:25:00'),
    resultAt: d('31T18:20:00'),
  },
  ...over,
});

describe('computeLifecycle', () => {
  it.each([
    ['2026-07-31T23:59:59Z', 'upcoming', false, false],
    ['2026-08-01T00:00:00Z', 'registration_open', true, false],
    ['2026-08-07T00:00:00Z', 'registration_open', true, true], // overlap
    ['2026-08-10T18:20:00Z', 'submission_open', false, true], // closing instant is exclusive
    ['2026-08-30T18:25:00Z', 'judging', false, false],
    ['2026-08-31T18:20:00Z', 'results_out', false, false],
  ])('at %s → %s', (at, phase, registrationOpen, submissionOpen) => {
    const lc = computeLifecycle(comp(), new Date(at));
    expect(lc).toMatchObject({ phase, registrationOpen, submissionOpen });
  });

  it('stage never calls a finished or cancelled competition active', () => {
    expect(computeLifecycle(comp(), d('01T00:00:00')).stage).toBe('ongoing');
    expect(computeLifecycle(comp(), new Date('2026-07-01T00:00:00Z')).stage).toBe('upcoming');
    expect(computeLifecycle(comp(), d('31T18:20:00')).stage).toBe('past');
    expect(computeLifecycle(comp({ status: 'cancelled' }), d('03T00:00:00')).stage).toBe('past');
  });

  it('cancelled overrides every window', () => {
    const lc = computeLifecycle(comp({ status: 'cancelled' }), d('07T00:00:00'));
    expect(lc).toMatchObject({ phase: 'cancelled', registrationOpen: false, submissionOpen: false, nextMilestone: null });
  });

  it('next milestone is the earliest future date, even when dates overlap', () => {
    expect(computeLifecycle(comp(), d('05T00:00:00')).nextMilestone?.type).toBe('submission_starts');
    expect(computeLifecycle(comp(), d('08T00:00:00')).nextMilestone?.type).toBe('registration_closes');
    expect(computeLifecycle(comp(), d('31T18:20:00')).nextMilestone).toBeNull();
  });

  it('urgency: close to the deadline, or few spots left, and only while registration is open', () => {
    expect(computeLifecycle(comp(), d('03T00:00:00')).urgency).toBe(false);
    expect(computeLifecycle(comp(), d('09T00:00:00')).urgency).toBe(true); // < 48h left
    expect(computeLifecycle(comp({ seats: { total: 20, confirmed: 16, held: 0 } }), d('03T00:00:00')).urgency).toBe(true);
    expect(computeLifecycle(comp({ seats: { total: 20, confirmed: 20, held: 0 } }), d('09T00:00:00')).urgency).toBe(false); // full
    expect(computeLifecycle(comp(), d('11T00:00:00')).urgency).toBe(false);
  });

  it('held seats count as taken', () => {
    const lc = computeLifecycle(comp({ seats: { total: 2, confirmed: 1, held: 1 } }), d('03T00:00:00'));
    expect(lc.isFull).toBe(true);
  });
});

describe('computeViewerState', () => {
  const now = d('07T00:00:00');
  const base = { authenticated: true, registration: null, hasSubmission: false, resultPosition: null };

  it('maps registrations to viewer states', () => {
    expect(computeViewerState({ ...base, authenticated: false }, now)).toBe('guest');
    expect(computeViewerState(base, now)).toBe('not_registered');
    expect(computeViewerState({ ...base, registration: { status: 'pending_payment', holdExpiresAt: d('07T00:05:00') } }, now)).toBe('payment_pending');
    expect(computeViewerState({ ...base, registration: { status: 'pending_payment', holdExpiresAt: d('06T23:55:00') } }, now)).toBe('not_registered');
    expect(computeViewerState({ ...base, registration: { status: 'confirmed' } }, now)).toBe('registered');
    expect(computeViewerState({ ...base, registration: { status: 'confirmed' }, hasSubmission: true }, now)).toBe('submitted');
    expect(computeViewerState({ ...base, registration: { status: 'expired' } }, now)).toBe('not_registered');
    expect(computeViewerState({ ...base, registration: { status: 'confirmed' }, resultPosition: 2 }, now)).toBe('winner');
  });
});

describe('computeActions', () => {
  const tl = comp().timeline;
  const actionsAt = (at: string, viewer: Parameters<typeof computeActions>[1], over: Partial<LifecycleInput> = {}) => {
    const now = new Date(at);
    return computeActions(computeLifecycle(comp(over), now), viewer, tl, now);
  };

  it('the design state: registered, submissions open → can upload', () => {
    const a = actionsAt('2026-08-09T00:00:00Z', 'registered');
    expect(a.submit).toEqual({ allowed: true });
    expect(a.register).toEqual({ allowed: false, reason: 'ALREADY_REGISTERED' });
  });

  it('register reasons', () => {
    expect(actionsAt('2026-08-03T00:00:00Z', 'not_registered').register).toEqual({ allowed: true });
    expect(actionsAt('2026-08-03T00:00:00Z', 'guest').register.reason).toBe('LOGIN_REQUIRED');
    expect(actionsAt('2026-07-30T00:00:00Z', 'not_registered').register.reason).toBe('REGISTRATION_NOT_OPEN');
    expect(actionsAt('2026-08-11T00:00:00Z', 'not_registered').register.reason).toBe('REGISTRATION_CLOSED');
    expect(actionsAt('2026-08-03T00:00:00Z', 'not_registered', { seats: { total: 1, confirmed: 1, held: 0 } }).register.reason).toBe('COMPETITION_FULL');
    expect(actionsAt('2026-08-03T00:00:00Z', 'payment_pending').register.reason).toBe('PAYMENT_PENDING');
    expect(actionsAt('2026-08-03T00:00:00Z', 'not_registered', { status: 'cancelled' }).register.reason).toBe('COMPETITION_CANCELLED');
  });

  it('submit reasons', () => {
    expect(actionsAt('2026-08-03T00:00:00Z', 'registered').submit.reason).toBe('SUBMISSION_NOT_STARTED');
    expect(actionsAt('2026-08-09T00:00:00Z', 'not_registered').submit.reason).toBe('NOT_REGISTERED');
    expect(actionsAt('2026-08-09T00:00:00Z', 'payment_pending').submit.reason).toBe('NOT_REGISTERED');
    expect(actionsAt('2026-08-30T19:00:00Z', 'submitted').submit.reason).toBe('SUBMISSION_CLOSED');
    expect(actionsAt('2026-08-20T00:00:00Z', 'submitted').submit).toEqual({ allowed: true }); // may replace
  });
});
