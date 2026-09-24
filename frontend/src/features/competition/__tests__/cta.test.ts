import { describe, expect, it } from '@jest/globals';
import type { Action, CompetitionDetails, Phase, Seats, ViewerState } from '@/api/types';
import { interpolate } from '@/i18n/LanguageProvider';
import { strings, type StringKey } from '@/i18n/strings';
import { getPrimaryCta } from '../cta';

const t = (key: StringKey, params?: Record<string, string | number>) => interpolate(strings.en[key], params);
const NOW = new Date('2026-08-09T12:00:00Z').getTime();
const allow: Action = { allowed: true };
const deny = (reason: Action['reason']): Action => ({ allowed: false, reason });
const seats = (left: number, total = 20): Seats => ({ total, booked: total - left, held: 0, left });

function details(
  over: { phase?: Phase; viewer?: ViewerState; register?: Action; submit?: Action; holdExpiresAt?: string; entryFee?: number } = {},
): CompetitionDetails {
  return {
    competition: {
      entryFee: over.entryFee ?? 9900,
      timeline: {
        registrationOpensAt: '2026-08-01T00:00:00Z',
        registrationClosesAt: '2026-08-10T18:20:00Z',
        submissionStartsAt: '2026-08-06T00:00:00Z',
        submissionEndsAt: '2026-08-30T18:25:00Z',
        resultAt: '2026-09-01T18:20:00Z',
      },
    } as CompetitionDetails['competition'],
    lifecycle: { phase: over.phase ?? 'registration_open', stage: 'ongoing', registrationOpen: true, submissionOpen: true, isFull: false, nextMilestone: null, urgency: false },
    viewer: {
      state: over.viewer ?? 'not_registered',
      isOrganizer: over.viewer === 'organizer',
      registration: over.holdExpiresAt ? ({ holdExpiresAt: over.holdExpiresAt } as CompetitionDetails['viewer']['registration']) : null,
      submission: null,
      resultPosition: null,
      myRating: null,
      isSaved: false,
    },
    actions: {
      register: over.register ?? allow,
      pay: deny('NO_PENDING_PAYMENT'),
      submit: over.submit ?? deny('NOT_REGISTERED'),
      viewResults: deny('RESULTS_NOT_OUT'),
      rate: deny('RATING_NOT_OPEN'),
    },
    serverTime: new Date(NOW).toISOString(),
  };
}

const cta = (d: CompetitionDetails, s = seats(19)) => getPrimaryCta(d, s, NOW, t, 'en');

describe('getPrimaryCta', () => {
  it('matches the design: registered + submissions open → Upload Submission / Registered', () => {
    expect(cta(details({ viewer: 'registered', register: deny('ALREADY_REGISTERED'), submit: allow }))).toEqual({
      label: 'Upload Submission',
      sublabel: 'Registered',
      action: 'upload',
      enabled: true,
    });
  });

  it('register with fee and live spots', () => {
    expect(cta(details())).toMatchObject({ label: 'Register Now · ₹ 99', sublabel: '19 spots left', action: 'register', enabled: true });
    expect(cta(details({ entryFee: 0 })).label).toBe('Register Now');
  });

  it('guests are sent to login', () => {
    expect(cta(details({ viewer: 'guest', register: deny('LOGIN_REQUIRED') }))).toMatchObject({ action: 'login', enabled: true });
  });

  it('live polling showing 0 spots overrides a stale "allowed"', () => {
    expect(cta(details(), seats(0))).toMatchObject({ label: 'Spots Full', enabled: false });
  });

  it('pending payment shows the remaining hold', () => {
    const hold = new Date(NOW + 9 * 60_000 + 41_000).toISOString();
    expect(cta(details({ viewer: 'payment_pending', register: deny('PAYMENT_PENDING'), holdExpiresAt: hold }))).toMatchObject({
      label: 'Complete Payment',
      sublabel: 'Spot held for 09:41',
      action: 'pay',
    });
  });

  it('disabled states', () => {
    expect(cta(details({ register: deny('REGISTRATION_CLOSED'), phase: 'submission_open' })).label).toBe('Registration Closed');
    expect(cta(details({ register: deny('REGISTRATION_NOT_OPEN'), phase: 'upcoming' })).label).toBe('Coming soon');
    expect(cta(details({ phase: 'cancelled', register: deny('COMPETITION_CANCELLED') })).label).toBe('Competition Cancelled');
    expect(cta(details({ viewer: 'registered', register: deny('ALREADY_REGISTERED'), submit: deny('SUBMISSION_NOT_STARTED') })).label).toMatch(/^Submissions open in/);
    expect(cta(details({ viewer: 'submitted', phase: 'judging', register: deny('REGISTRATION_CLOSED'), submit: deny('SUBMISSION_CLOSED') }))).toMatchObject({
      label: 'Submissions Closed',
      enabled: false,
    });
  });

  it('organizers manage instead of registering', () => {
    expect(cta(details({ viewer: 'organizer', register: deny('IS_ORGANIZER') }))).toMatchObject({ label: 'Manage competition', action: 'manage', enabled: true });
  });

  it('submitted users can replace their entry while the window is open', () => {
    expect(cta(details({ viewer: 'submitted', register: deny('ALREADY_REGISTERED'), submit: allow }))).toMatchObject({ label: 'Update Submission', sublabel: 'Submitted' });
  });
});
