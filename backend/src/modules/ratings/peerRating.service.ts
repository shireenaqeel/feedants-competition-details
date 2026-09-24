import mongoose from 'mongoose';
import { clock } from '../../lib/clock.js';
import { AppError, Errors } from '../../lib/errors.js';
import { mediaUrl } from '../../lib/media.js';
import { ratingSummary } from '../../lib/rating.js';
import { CompetitionModel } from '../../models/competition.model.js';
import { PeerRatingModel } from '../../models/peerRating.model.js';
import { RegistrationModel } from '../../models/registration.model.js';
import { SubmissionModel } from '../../models/submission.model.js';
import { UserModel } from '../../models/user.model.js';

/** Peer ratings are only between confirmed participants, once the competition has ended (results announced). */
async function assertCanRatePeers(competitionId: string, raterId: string) {
  const c = await CompetitionModel.findOne({ _id: competitionId, status: { $ne: 'draft' } }, { status: 1, timeline: 1 }).lean();
  if (!c) throw Errors.notFound('Competition');
  if (c.status === 'cancelled') throw new AppError(409, 'COMPETITION_CANCELLED', 'This competition was cancelled');
  if (clock.now() < c.timeline.resultAt) throw new AppError(409, 'RATING_NOT_OPEN', 'Ratings open once the competition ends (results announced)');
  const isParticipant = await RegistrationModel.exists({ competitionId, userId: raterId, status: 'confirmed' });
  if (!isParticipant) throw new AppError(403, 'NOT_PARTICIPANT', 'Only participants can rate each other');
}

/** Fellow participants, with the stars I already gave each of them. */
export async function listFellowParticipants(competitionId: string, raterId: string, baseUrl: string) {
  await assertCanRatePeers(competitionId, raterId);
  const regs = await RegistrationModel.find({ competitionId, status: 'confirmed', userId: { $ne: raterId } }, { userId: 1 }).limit(500).lean();
  const ids = regs.map((r) => r.userId);
  const [users, given] = await Promise.all([
    UserModel.find({ _id: { $in: ids } }, { name: 1, avatarUrl: 1, sportsmanship: 1 }).lean(),
    PeerRatingModel.find({ competitionId, raterId }, { rateeId: 1, stars: 1 }).lean(),
  ]);
  const myStars = new Map(given.map((g) => [String(g.rateeId), g.stars]));
  return users
    .map((u) => ({
      id: String(u._id),
      name: u.name,
      avatarUrl: mediaUrl(u.avatarUrl, baseUrl),
      sportsmanship: ratingSummary(u.sportsmanship),
      myStars: myStars.get(String(u._id)) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function ratePeer(competitionId: string, raterId: string, rateeId: string, stars: number) {
  if (raterId === rateeId) throw new AppError(409, 'CANNOT_RATE_SELF', 'You cannot rate yourself');
  await assertCanRatePeers(competitionId, raterId);
  const rateeTookPart = await RegistrationModel.exists({ competitionId, userId: rateeId, status: 'confirmed' });
  if (!rateeTookPart) throw new AppError(404, 'PARTICIPANT_NOT_FOUND', 'This person did not take part in the competition');

  await mongoose.connection.transaction(async (session) => {
    const previous = await PeerRatingModel.findOne({ competitionId, raterId, rateeId }).session(session).lean();
    await PeerRatingModel.updateOne({ competitionId, raterId, rateeId }, { $set: { stars } }, { upsert: true, session, runValidators: true });
    await UserModel.updateOne(
      { _id: rateeId },
      { $inc: { 'sportsmanship.count': previous ? 0 : 1, 'sportsmanship.sum': stars - (previous?.stars ?? 0) } },
      { session },
    );
  });
}

/** Participation record used on profiles. A no-show = confirmed, window closed, nothing submitted. */
export async function participationStats(userId: string) {
  const now = clock.now();
  const regs = await RegistrationModel.find({ userId, status: 'confirmed' }, { competitionId: 1 }).lean();
  const competitionIds = regs.map((r) => r.competitionId);
  const [closed, submittedIds] = await Promise.all([
    CompetitionModel.find({ _id: { $in: competitionIds }, status: 'published', 'timeline.submissionEndsAt': { $lte: now } }, { _id: 1 }).lean(),
    SubmissionModel.find({ userId, status: 'submitted' }, { competitionId: 1 }).lean(),
  ]);
  const submitted = new Set(submittedIds.map((s) => String(s.competitionId)));
  return {
    registered: regs.length,
    submitted: submitted.size,
    noShows: closed.filter((c) => !submitted.has(String(c._id))).length,
  };
}
