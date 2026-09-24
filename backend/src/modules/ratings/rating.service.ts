import mongoose from 'mongoose';
import { z } from 'zod';
import { clock } from '../../lib/clock.js';
import { AppError, Errors } from '../../lib/errors.js';
import { mediaUrl } from '../../lib/media.js';
import { ratingSummary } from '../../lib/rating.js';
import { CompetitionModel } from '../../models/competition.model.js';
import { RatingModel, type Rating } from '../../models/rating.model.js';
import { RegistrationModel } from '../../models/registration.model.js';
import { UserModel } from '../../models/user.model.js';
import { computeLifecycle, computeViewerState, rateAction } from '../competitions/lifecycle.js';

export const rateSchema = z.object({
  competitionStars: z.number().int().min(1).max(5),
  organizerStars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().transform((v) => v || undefined),
});

const REASON: Record<string, [number, string]> = {
  IS_ORGANIZER: [409, 'Organizers cannot rate their own competition'],
  COMPETITION_CANCELLED: [409, 'This competition was cancelled'],
  NOT_PARTICIPANT: [403, 'Only participants can rate this competition'],
  RATING_NOT_OPEN: [409, 'Ratings open once the competition ends (results announced)'],
};

/**
 * Creates or updates the user's rating. Running totals on the competition and the organizer
 * are adjusted by the difference, in the same transaction, so averages never drift.
 */
export async function rateCompetition(competitionId: string, userId: string, input: z.infer<typeof rateSchema>) {
  let saved!: Rating & { _id: unknown };
  await mongoose.connection.transaction(async (session) => {
    const c = await CompetitionModel.findById(competitionId, { status: 1, organizerId: 1, timeline: 1, seats: 1 }).session(session).lean();
    if (!c || c.status === 'draft') throw Errors.notFound('Competition');
    const now = clock.now();
    const isOrganizer = Boolean(c.organizerId && String(c.organizerId) === userId);
    const registration = isOrganizer ? null : await RegistrationModel.findOne({ competitionId, userId }).session(session).lean();
    const viewer = computeViewerState({ authenticated: true, isOrganizer, registration, hasSubmission: false, resultPosition: null }, now);
    const action = rateAction(computeLifecycle(c, now), viewer, c.timeline, now);
    if (!action.allowed) {
      const [status, message] = REASON[action.reason!] ?? [409, 'Rating not allowed'];
      throw new AppError(status, action.reason!, message);
    }

    const previous = await RatingModel.findOne({ competitionId, userId }).session(session).lean();
    saved = (await RatingModel.findOneAndUpdate(
      { competitionId, userId },
      {
        $set: { competitionStars: input.competitionStars, organizerStars: input.organizerStars, organizerId: c.organizerId, ...(input.comment && { comment: input.comment }) },
        ...(!input.comment && { $unset: { comment: 1 } }),
      },
      { upsert: true, returnDocument: 'after', session, runValidators: true },
    ).lean())!;

    const newRating = previous ? 0 : 1;
    await CompetitionModel.updateOne(
      { _id: c._id },
      { $inc: { 'rating.count': newRating, 'rating.sum': input.competitionStars - (previous?.competitionStars ?? 0) } },
      { session },
    );
    if (c.organizerId) {
      await UserModel.updateOne(
        { _id: c.organizerId },
        { $inc: { 'organizerRating.count': newRating, 'organizerRating.sum': input.organizerStars - (previous?.organizerStars ?? 0) } },
        { session },
      );
    }
  });
  return saved;
}

export function serializeMyRating(r: Pick<Rating, 'competitionStars' | 'organizerStars' | 'comment' | 'updatedAt'>) {
  return { competitionStars: r.competitionStars, organizerStars: r.organizerStars, comment: r.comment ?? null, updatedAt: r.updatedAt };
}

/** Summary + latest reviews for the details screen. */
export async function listRatings(competitionId: string, limit: number, baseUrl: string) {
  const c = await CompetitionModel.findOne({ _id: competitionId, status: { $ne: 'draft' } }, { rating: 1 }).lean();
  if (!c) throw Errors.notFound('Competition');
  const ratings = await RatingModel.find({ competitionId }).sort({ createdAt: -1 }).limit(limit).lean();
  const users = await UserModel.find({ _id: { $in: ratings.map((r) => r.userId) } }, { name: 1, avatarUrl: 1 }).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return {
    summary: ratingSummary(c.rating),
    ratings: ratings.map((r) => {
      const u = byId.get(String(r.userId));
      return {
        id: String(r._id),
        userName: u?.name ?? 'Participant',
        avatarUrl: mediaUrl(u?.avatarUrl, baseUrl),
        competitionStars: r.competitionStars,
        organizerStars: r.organizerStars,
        comment: r.comment ?? null,
        createdAt: r.createdAt,
      };
    }),
  };
}
