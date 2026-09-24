import { ApiError } from '@/api/client';
import type { StringKey } from '@/i18n/strings';

const CODE_TO_KEY: Partial<Record<string, StringKey>> = {
  COMPETITION_FULL: 'ctaFull',
  REGISTRATION_CLOSED: 'ctaRegistrationClosed',
  SUBMISSION_CLOSED: 'ctaSubmissionsClosed',
  COMPETITION_CANCELLED: 'ctaCancelled',
  NETWORK_ERROR: 'offline',
};

/** A user-facing message for an API error, translated where we have a translation. */
export function errorMessage(error: unknown, t: (key: StringKey) => string): string {
  if (error instanceof ApiError) {
    const key = CODE_TO_KEY[error.code];
    return key ? t(key) : error.message;
  }
  return t('somethingWrong');
}
