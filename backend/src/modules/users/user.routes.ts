import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { clock } from '../../lib/clock.js';
import { Errors } from '../../lib/errors.js';
import { publicBaseUrl } from '../../lib/http.js';
import { LANGUAGES } from '../../lib/i18n.js';
import { mediaUrl } from '../../lib/media.js';
import { objectIdSchema } from '../../lib/objectId.js';
import { ratingSummary } from '../../lib/rating.js';
import { requireAuth, userId } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { CompetitionModel } from '../../models/competition.model.js';
import { CompetitionResultModel } from '../../models/competitionResult.model.js';
import { ReferralModel } from '../../models/referral.model.js';
import { RegistrationModel } from '../../models/registration.model.js';
import { SubmissionModel } from '../../models/submission.model.js';
import { UserModel, type User } from '../../models/user.model.js';
import { serializeSummary } from '../competitions/competition.service.js';
import { participationStats } from '../ratings/peerRating.service.js';
import { serializeRegistration } from '../registrations/registration.service.js';

export const userRouter = Router();

export function serializeUser(u: User & { _id: unknown }, baseUrl: string) {
  return {
    id: String(u._id),
    name: u.name,
    phone: u.phone,
    avatarUrl: mediaUrl(u.avatarUrl, baseUrl),
    bio: u.bio ?? null,
    city: u.city ?? null,
    language: u.language,
    memberSince: u.createdAt,
  };
}

async function statsFor(id: string, publicOnly = false) {
  const [participation, won, organized, user] = await Promise.all([
    participationStats(id),
    CompetitionResultModel.countDocuments({ userId: id }),
    CompetitionModel.countDocuments({ organizerId: id, ...(publicOnly && { status: { $in: ['published', 'cancelled'] } }) }),
    UserModel.findById(id, { sportsmanship: 1, organizerRating: 1 }).lean(),
  ]);
  return {
    ...participation,
    won,
    organized,
    sportsmanship: ratingSummary(user?.sportsmanship),
    organizerRating: ratingSummary(user?.organizerRating),
  };
}

userRouter.get('/me', requireAuth, async (req, res) => {
  const user = await UserModel.findById(userId(req)).lean();
  if (!user) throw Errors.notFound('User');
  res.json({ user: serializeUser(user, publicBaseUrl(req)), stats: await statsFor(userId(req)) });
});

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((v) => (v === '' ? null : v));

const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    bio: optionalText(300),
    city: optionalText(60),
    language: z.enum(LANGUAGES).optional(),
    // A path returned by POST /uploads/images, or null to remove the photo.
    avatarUrl: z
      .string()
      .regex(/^\/uploads\/images\/[\w.-]+$/, 'Upload the photo first')
      .nullable()
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

userRouter.patch('/me', requireAuth, writeLimiter, async (req, res) => {
  const patch = updateMeSchema.parse(req.body);
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) $unset[k] = 1;
    else if (v !== undefined) $set[k] = v;
  }
  const user = await UserModel.findByIdAndUpdate(
    userId(req),
    { ...(Object.keys($set).length && { $set }), ...(Object.keys($unset).length && { $unset }) },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!user) throw Errors.notFound('User');
  res.json({ user: serializeUser(user, publicBaseUrl(req)) });
});

/**
 * Public profile: participation record, sportsmanship (rated by fellow participants), and, for
 * organizers, their rating and every published competition (the app groups them by stage).
 */
userRouter.get('/:id/public', async (req, res) => {
  const { id } = z.object({ id: objectIdSchema }).parse(req.params);
  const { lang } = z.object({ lang: z.enum(LANGUAGES).default('en') }).parse(req.query);
  const user = await UserModel.findById(id, { name: 1, avatarUrl: 1, bio: 1, city: 1, createdAt: 1 }).lean();
  if (!user) throw Errors.notFound('User');
  const baseUrl = publicBaseUrl(req);
  const now = clock.now();

  const [stats, organized, joined] = await Promise.all([
    statsFor(id, true),
    CompetitionModel.find({ organizerId: id, status: { $in: ['published', 'cancelled'] } }).sort({ 'timeline.registrationOpensAt': -1 }).limit(200).lean(),
    RegistrationModel.find({ userId: id, status: 'confirmed' }, { competitionId: 1 }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  const joinedCompetitions = await CompetitionModel.find({ _id: { $in: joined.map((r) => r.competitionId) }, status: { $in: ['published', 'cancelled'] } }).lean();

  res.set('Cache-Control', 'public, max-age=30');
  res.json({
    user: { id: String(user._id), name: user.name, avatarUrl: mediaUrl(user.avatarUrl, baseUrl), bio: user.bio ?? null, city: user.city ?? null, memberSince: user.createdAt },
    stats,
    participated: joinedCompetitions.map((c) => serializeSummary(c, lang, now)),
    organized: organized.map((c) => serializeSummary(c, lang, now)),
  });
});

/** "My competitions": everything the user registered for, newest first. */
userRouter.get('/me/registrations', requireAuth, async (req, res) => {
  const { lang } = z.object({ lang: z.enum(LANGUAGES).default('en') }).parse(req.query);
  const registrations = await RegistrationModel.find({ userId: userId(req), status: { $in: ['pending_payment', 'confirmed', 'refund_required', 'refunded'] } })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  const competitionIds = registrations.map((r) => r.competitionId);
  const [competitions, submissions] = await Promise.all([
    CompetitionModel.find({ _id: { $in: competitionIds } }).lean(),
    SubmissionModel.find({ userId: userId(req), competitionId: { $in: competitionIds }, status: 'submitted' }, { competitionId: 1 }).lean(),
  ]);
  const byId = new Map(competitions.map((c) => [String(c._id), c]));
  const submitted = new Set(submissions.map((s) => String(s.competitionId)));
  const now = clock.now();
  res.set('Cache-Control', 'private, no-cache');
  res.json({
    registrations: registrations.flatMap((r) => {
      const c = byId.get(String(r.competitionId));
      // An unpaid hold that already lapsed is not worth showing.
      if (!c || (r.status === 'pending_payment' && (!r.holdExpiresAt || r.holdExpiresAt <= now))) return [];
      return [{ registration: serializeRegistration(r), competition: serializeSummary(c, lang, now), hasSubmission: submitted.has(String(c._id)) }];
    }),
  });
});

userRouter.get('/me/referral', requireAuth, async (req, res) => {
  const user = await UserModel.findById(userId(req), { referralCode: 1 }).lean();
  if (!user) throw Errors.notFound('User');
  const [stats] = await ReferralModel.aggregate<{ signups: number; earned: number }>([
    { $match: { referrerId: user._id } },
    { $group: { _id: null, signups: { $sum: 1 }, earned: { $sum: '$rewardAmount' } } },
  ]);
  res.json({
    code: user.referralCode,
    link: `${env.appUrl}/r/${user.referralCode}`,
    signups: stats?.signups ?? 0,
    earned: stats?.earned ?? 0,
  });
});
