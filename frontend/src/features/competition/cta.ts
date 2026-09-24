import type { CompetitionDetails, Seats } from '@/api/types';
import type { Lang, StringKey } from '@/i18n/strings';
import { countdownParts, formatDate, formatMoney, formatShortDuration, ordinal } from '@/lib/format';

export type CtaAction = 'register' | 'login' | 'pay' | 'upload' | 'manage' | 'none';

export interface Cta {
  label: string;
  sublabel?: string;
  action: CtaAction;
  enabled: boolean;
}

type T = (key: StringKey, params?: Record<string, string | number>) => string;

const none = (label: string, sublabel?: string): Cta => ({ label, sublabel, action: 'none', enabled: false });

/**
 * Maps the server's lifecycle / viewer / actions to the bottom button. The server decides what
 * is allowed; this only picks the words. `liveSeats` (polled) can only make registration stricter.
 */
export function getPrimaryCta(details: CompetitionDetails, liveSeats: Seats, now: number, t: T, lang: Lang): Cta {
  const { competition: c, lifecycle, viewer, actions } = details;
  const timeUntil = (iso: string) => formatShortDuration(countdownParts(new Date(iso).getTime() - now));

  if (viewer.state === 'organizer') return { label: t('ctaManage'), sublabel: t('ctaYouOrganize'), action: 'manage', enabled: c.status !== 'cancelled' };
  if (lifecycle.phase === 'cancelled') return none(t('ctaCancelled'));

  switch (viewer.state) {
    case 'winner':
      return none(t('ctaResults'), t('ctaWinner', { pos: ordinal(viewer.resultPosition ?? 1, lang) }));
    case 'refund_pending':
      return none(t('ctaRefund'), t('ctaRefundSub'));
    case 'payment_pending': {
      const heldUntil = viewer.registration?.holdExpiresAt;
      return {
        label: t('ctaCompletePayment'),
        sublabel: heldUntil ? t('ctaSpotHeld', { time: timeUntil(heldUntil) }) : undefined,
        action: 'pay',
        enabled: true,
      };
    }
    case 'registered':
    case 'submitted': {
      const sub = viewer.state === 'submitted' ? t('submitted') : t('registered');
      if (actions.submit.allowed) {
        return { label: viewer.state === 'submitted' ? t('ctaUpdate') : t('ctaUpload'), sublabel: sub, action: 'upload', enabled: true };
      }
      if (actions.submit.reason === 'SUBMISSION_NOT_STARTED') {
        return none(t('ctaSubmissionsOpenIn', { time: timeUntil(c.timeline.submissionStartsAt) }), sub);
      }
      if (lifecycle.phase === 'results_out') return none(t('ctaResults'), sub);
      return none(t('ctaSubmissionsClosed'), t('ctaResultsOn', { date: formatDate(c.timeline.resultAt, lang) }));
    }
    default:
      break; // guest / not_registered
  }

  const reason = actions.register.reason;
  const fee = c.entryFee > 0 ? t('ctaRegister', { fee: formatMoney(c.entryFee) }) : t('ctaRegisterFree');
  const spots = t('ctaSpotsLeft', { n: liveSeats.left });

  if (liveSeats.left === 0 && (actions.register.allowed || reason === 'LOGIN_REQUIRED' || reason === 'COMPETITION_FULL')) {
    return none(t('ctaFull'), t('ctaFullSub', { n: liveSeats.total }));
  }
  if (actions.register.allowed) return { label: fee, sublabel: spots, action: 'register', enabled: true };
  if (reason === 'LOGIN_REQUIRED') return { label: fee, sublabel: t('ctaLogin'), action: 'login', enabled: true };
  if (reason === 'REGISTRATION_NOT_OPEN') {
    return none(t('ctaComingSoon'), t('ctaRegistrationOpens', { date: formatDate(c.timeline.registrationOpensAt, lang) }));
  }
  if (lifecycle.phase === 'results_out') return none(t('ctaResults'));
  return none(t('ctaRegistrationClosed'));
}
