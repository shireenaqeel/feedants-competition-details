import { clock } from '../../lib/clock.js';
import { AppError, Errors } from '../../lib/errors.js';
import { CompetitionModel } from '../../models/competition.model.js';
import { RegistrationModel } from '../../models/registration.model.js';
import { SubmissionModel, type Submission } from '../../models/submission.model.js';
import { computeLifecycle, computeViewerState, submitAction } from '../competitions/lifecycle.js';
import { deleteStored, publicUrlFor } from './storage.js';

const REASON_STATUS: Record<string, number> = { LOGIN_REQUIRED: 401, NOT_REGISTERED: 403 };
const REASON_MESSAGE: Record<string, string> = {
  COMPETITION_CANCELLED: 'This competition has been cancelled',
  NOT_REGISTERED: 'Only paid participants can submit',
  SUBMISSION_NOT_STARTED: 'Submissions have not opened yet',
  SUBMISSION_CLOSED: 'Submissions are closed',
};

/** Same rules as the "submit" action in the details payload. Throws if the user may not submit now. */
export async function assertCanSubmit(competitionId: string, userId: string) {
  const [competition, registration, existing] = await Promise.all([
    CompetitionModel.findOne({ _id: competitionId, status: { $ne: 'draft' } }, { status: 1, timeline: 1, seats: 1 }).lean(),
    RegistrationModel.findOne({ competitionId, userId }).lean(),
    SubmissionModel.findOne({ competitionId, userId, status: 'submitted' }, { _id: 1 }).lean(),
  ]);
  if (!competition) throw Errors.notFound('Competition');

  const now = clock.now();
  const lifecycle = computeLifecycle(competition, now);
  const viewer = computeViewerState(
    { authenticated: true, registration, hasSubmission: Boolean(existing), resultPosition: null },
    now,
  );
  const action = submitAction(lifecycle, viewer, competition.timeline, now);
  if (!action.allowed) {
    const reason = action.reason!;
    throw new AppError(REASON_STATUS[reason] ?? 409, reason, REASON_MESSAGE[reason] ?? 'Submission not allowed');
  }
  return { registration: registration! };
}

export async function saveSubmission(
  competitionId: string,
  userId: string,
  file: { storageKey: string; mimeType: string; sizeBytes: number },
  caption: string | undefined,
) {
  try {
    // Re-check after the upload finished: the window may have closed meanwhile.
    const { registration } = await assertCanSubmit(competitionId, userId);
    const previous = await SubmissionModel.findOne({ competitionId, userId }, { media: 1 }).lean();

    const submission = await SubmissionModel.findOneAndUpdate(
      { competitionId, userId },
      {
        $set: {
          registrationId: registration._id,
          media: file,
          caption,
          status: 'submitted',
          submittedAt: clock.now(),
        },
        $inc: { version: 1 },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    ).orFail();

    if (previous?.media?.storageKey && previous.media.storageKey !== file.storageKey) {
      await deleteStored(previous.media.storageKey);
    }
    return submission;
  } catch (err) {
    await deleteStored(file.storageKey);
    throw err;
  }
}

export async function getMySubmission(competitionId: string, userId: string) {
  return SubmissionModel.findOne({ competitionId, userId, status: 'submitted' }).lean();
}

/** URLs are built at read time so they match the host the client used (and survive a CDN move). */
export function serializeSubmission(s: Submission & { _id: unknown }, baseUrl: string) {
  return {
    id: String(s._id),
    mediaUrl: publicUrlFor(s.media.storageKey, baseUrl),
    mimeType: s.media.mimeType,
    sizeBytes: s.media.sizeBytes,
    caption: s.caption ?? null,
    version: s.version,
    submittedAt: s.submittedAt,
  };
}
