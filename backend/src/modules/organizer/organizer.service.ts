import { randomBytes } from 'node:crypto';
import mongoose, { type ClientSession, type HydratedDocument } from 'mongoose';
import { clock } from '../../lib/clock.js';
import { AppError, Errors } from '../../lib/errors.js';
import type { Lang } from '../../lib/i18n.js';
import { CompetitionModel, type Competition } from '../../models/competition.model.js';
import { JudgeModel } from '../../models/judge.model.js';
import { RegistrationModel } from '../../models/registration.model.js';
import { SubmissionModel } from '../../models/submission.model.js';
import { serializeSummary } from '../competitions/competition.service.js';
import type { CreateCompetitionInput, UpdateCompetitionInput } from './competition.validation.js';

type CompetitionDoc = HydratedDocument<Competition>;

const sumRewards = (rewards: { amount: number }[]) => rewards.reduce((s, r) => s + r.amount, 0);

function slugFor(titleEn: string): string {
  const base = titleEn
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${base || 'competition'}-${randomBytes(3).toString('hex')}`;
}

function assertRegistrationStillAhead(timeline: { registrationClosesAt: Date }) {
  if (timeline.registrationClosesAt <= clock.now()) {
    throw new AppError(422, 'TIMELINE_IN_PAST', 'Registration must close in the future', [
      { path: 'timeline.registrationClosesAt', message: 'Registration must close in the future' },
    ]);
  }
}

/** Loads a competition and checks that `userId` organizes it. */
async function loadOwned(competitionId: string, userId: string, session?: ClientSession): Promise<CompetitionDoc> {
  const c = await CompetitionModel.findById(competitionId).session(session ?? null);
  if (!c) throw Errors.notFound('Competition');
  if (!c.organizerId || String(c.organizerId) !== userId) throw Errors.forbidden();
  return c;
}

// ---------------------------------------------------------------------------

export async function createCompetition(userId: string, input: CreateCompetitionInput) {
  if (input.publish) assertRegistrationStillAhead(input.timeline);
  const slug = slugFor(input.title.en);
  let created!: CompetitionDoc;

  await mongoose.connection.transaction(async (session) => {
    const [judge] = await JudgeModel.create([{ ...input.judge, createdBy: userId }], { session });
    [created] = await CompetitionModel.create(
      [
        {
          slug,
          seriesId: slug,
          organizerId: userId,
          status: input.publish ? 'published' : 'draft',
          title: input.title,
          category: input.category,
          tags: input.tags,
          isMultiWin: input.isMultiWin,
          certificateForWinners: input.certificateForWinners,
          currency: 'INR',
          entryFee: input.entryFee,
          prizePool: sumRewards(input.rewards), // derived, so it can never disagree with the rewards
          rewards: input.rewards,
          seats: { total: input.seatsTotal, confirmed: 0, held: 0 },
          timeline: input.timeline,
          judgeIds: [judge._id],
          content: input.content,
          disclaimer: input.disclaimer,
          refundPolicyUrl: input.refundPolicyUrl,
          media: { prizeInfoVideoUrl: input.prizeInfoVideoUrl, coverImageUrl: input.coverImageUrl },
          referralRewardPerSignup: input.referralRewardPerSignup,
        },
      ],
      { session },
    );
  });
  return created;
}

export async function updateCompetition(competitionId: string, userId: string, patch: UpdateCompetitionInput) {
  let updated!: CompetitionDoc;

  await mongoose.connection.transaction(async (session) => {
    const c = await loadOwned(competitionId, userId, session);
    if (c.status === 'cancelled') throw new AppError(409, 'COMPETITION_CANCELLED', 'A cancelled competition cannot be edited');

    const taken = c.seats.confirmed + c.seats.held;
    if (patch.entryFee !== undefined && patch.entryFee !== c.entryFee) {
      const hasRegistrations = taken > 0 || (await RegistrationModel.exists({ competitionId: c._id }).session(session));
      if (hasRegistrations) throw new AppError(409, 'ENTRY_FEE_LOCKED', 'The entry fee cannot change after people have registered');
    }
    if (patch.timeline && c.status === 'published') assertRegistrationStillAhead(patch.timeline);

    if (patch.judge) {
      const judgeId = c.judgeIds[0];
      const existing = judgeId ? await JudgeModel.findById(judgeId).session(session) : null;
      if (existing && String(existing.createdBy) === userId) {
        existing.set(patch.judge);
        await existing.save({ session });
      } else {
        const [judge] = await JudgeModel.create([{ ...patch.judge, createdBy: userId }], { session });
        c.judgeIds = [judge._id];
      }
    }

    const simple = ['title', 'category', 'tags', 'isMultiWin', 'certificateForWinners', 'entryFee', 'timeline', 'content', 'disclaimer', 'refundPolicyUrl', 'referralRewardPerSignup'] as const;
    for (const key of simple) if (patch[key] !== undefined) c.set(key, patch[key]);
    if (patch.rewards) {
      c.set('rewards', patch.rewards);
      c.prizePool = sumRewards(patch.rewards);
    }
    if (patch.prizeInfoVideoUrl !== undefined) c.set('media.prizeInfoVideoUrl', patch.prizeInfoVideoUrl);
    if (patch.coverImageUrl !== undefined) c.set('media.coverImageUrl', patch.coverImageUrl);

    await c.save({ session });

    // Seats: a conditional update, so a concurrent registration can never end up above the new total.
    if (patch.seatsTotal !== undefined && patch.seatsTotal !== c.seats.total) {
      const res = await CompetitionModel.updateOne(
        { _id: c._id, $expr: { $lte: [{ $add: ['$seats.confirmed', '$seats.held'] }, patch.seatsTotal] } },
        { $set: { 'seats.total': patch.seatsTotal } },
        { session },
      );
      if (res.modifiedCount !== 1) {
        throw new AppError(409, 'SEATS_BELOW_BOOKED', `${taken} spots are already taken; total spots cannot go below that`);
      }
    }
    updated = await CompetitionModel.findById(c._id).session(session).orFail();
  });
  return updated;
}

export async function publishCompetition(competitionId: string, userId: string) {
  const c = await loadOwned(competitionId, userId);
  if (c.status === 'published') return c;
  if (c.status !== 'draft') throw new AppError(409, 'NOT_A_DRAFT', 'Only drafts can be published');
  assertRegistrationStillAhead(c.timeline);
  const updated = await CompetitionModel.findOneAndUpdate(
    { _id: c._id, status: 'draft' },
    { $set: { status: 'published' } },
    { returnDocument: 'after' },
  );
  return updated ?? (await CompetitionModel.findById(c._id).orFail());
}

/**
 * Cancels a competition. Paid registrations are marked for refund and pending payments are
 * cancelled, in the same transaction, so no one can register or pay in between.
 */
export async function cancelCompetition(competitionId: string, userId: string) {
  let result!: { competition: CompetitionDoc; refunds: number };
  await mongoose.connection.transaction(async (session) => {
    const c = await loadOwned(competitionId, userId, session);
    if (c.status === 'cancelled') {
      result = { competition: c, refunds: 0 };
      return;
    }
    const refunds = await RegistrationModel.updateMany(
      { competitionId: c._id, status: 'confirmed', amount: { $gt: 0 } },
      { $set: { status: 'refund_required' } },
      { session },
    );
    await RegistrationModel.updateMany(
      { competitionId: c._id, status: 'pending_payment' },
      { $set: { status: 'cancelled' }, $unset: { holdExpiresAt: 1 } },
      { session },
    );
    c.status = 'cancelled';
    c.seats.held = 0;
    result = { competition: await c.save({ session }), refunds: refunds.modifiedCount };
  });
  return result;
}

export async function deleteDraft(competitionId: string, userId: string) {
  await mongoose.connection.transaction(async (session) => {
    const c = await loadOwned(competitionId, userId, session);
    if (c.status !== 'draft') throw new AppError(409, 'NOT_A_DRAFT', 'Only drafts can be deleted; cancel a published competition instead');
    await CompetitionModel.deleteOne({ _id: c._id }, { session });
    // Judges created for this draft and used nowhere else go with it.
    for (const judgeId of c.judgeIds) {
      const usedElsewhere = await CompetitionModel.exists({ judgeIds: judgeId }).session(session);
      if (!usedElsewhere) await JudgeModel.deleteOne({ _id: judgeId, createdBy: userId }, { session });
    }
  });
}

/** Organizer dashboard: my competitions (drafts included) with booking and submission counts. */
export async function listMyCompetitions(userId: string, lang: Lang) {
  const now = clock.now();
  const competitions = await CompetitionModel.find({ organizerId: userId }).sort({ createdAt: -1 }).limit(100).lean();
  const ids = competitions.map((c) => c._id);
  const submissions = await SubmissionModel.aggregate<{ _id: unknown; count: number }>([
    { $match: { competitionId: { $in: ids }, status: 'submitted' } },
    { $group: { _id: '$competitionId', count: { $sum: 1 } } },
  ]);
  const submissionCount = new Map(submissions.map((s) => [String(s._id), s.count]));
  return competitions.map((c) => ({
    ...serializeSummary(c, lang, now),
    submissions: submissionCount.get(String(c._id)) ?? 0,
    createdAt: c.createdAt,
  }));
}

/** Raw, both-language values to pre-fill the edit form. */
export async function getEditableCompetition(competitionId: string, userId: string) {
  const c = await loadOwned(competitionId, userId);
  const judge = c.judgeIds[0] ? await JudgeModel.findById(c.judgeIds[0]).lean() : null;
  const hasRegistrations = c.seats.confirmed + c.seats.held > 0 || Boolean(await RegistrationModel.exists({ competitionId: c._id }));
  return {
    id: String(c._id),
    slug: c.slug,
    status: c.status,
    title: c.title,
    category: c.category,
    tags: c.tags,
    isMultiWin: c.isMultiWin,
    certificateForWinners: c.certificateForWinners,
    entryFee: c.entryFee,
    rewards: c.rewards.map((r) => ({ position: r.position, amount: r.amount })),
    seats: { total: c.seats.total, taken: c.seats.confirmed + c.seats.held },
    timeline: c.timeline,
    judge: judge
      ? { name: judge.name, title: judge.title, experienceYears: judge.experienceYears ?? null, avatarUrl: judge.avatarUrl ?? null, introVideoUrl: judge.introVideoUrl ?? null }
      : null,
    content: c.content,
    disclaimer: c.disclaimer ?? null,
    refundPolicyUrl: c.refundPolicyUrl ?? null,
    prizeInfoVideoUrl: c.media?.prizeInfoVideoUrl ?? null,
    coverImageUrl: c.media?.coverImageUrl ?? null,
    referralRewardPerSignup: c.referralRewardPerSignup,
    locks: { entryFee: hasRegistrations },
  };
}
