import type { QueryFilter, SortOrder } from 'mongoose';
import type { Category } from '../../lib/categories.js';
import { clock } from '../../lib/clock.js';
import { Errors } from '../../lib/errors.js';
import { t, type Lang } from '../../lib/i18n.js';
import { mediaUrl } from '../../lib/media.js';
import { ratingSummary } from '../../lib/rating.js';
import { isObjectId } from '../../lib/objectId.js';
import { CompetitionModel, type Competition } from '../../models/competition.model.js';
import { CompetitionResultModel } from '../../models/competitionResult.model.js';
import { JudgeModel } from '../../models/judge.model.js';
import { RatingModel } from '../../models/rating.model.js';
import { RegistrationModel } from '../../models/registration.model.js';
import { SavedCompetitionModel } from '../../models/savedCompetition.model.js';
import { UserModel } from '../../models/user.model.js';
import { serializeMyRating } from '../ratings/rating.service.js';
import { SubmissionModel } from '../../models/submission.model.js';
import { serializeRegistration } from '../registrations/registration.service.js';
import { serializeSubmission } from '../submissions/submission.service.js';
import { serializeCompetition, serializeSeats } from './competition.serializer.js';
import { computeActions, computeLifecycle, computeViewerState, URGENCY_WINDOW_MS } from './lifecycle.js';

const byIdOrSlug = (idOrSlug: string) => (isObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() });

/** Accepts an ObjectId or a slug. Drafts are visible only to their organizer. */
export async function findVisibleCompetition(idOrSlug: string, userId?: string) {
  const competition = await CompetitionModel.findOne(byIdOrSlug(idOrSlug)).lean();
  const isOwner = Boolean(userId && competition?.organizerId && String(competition.organizerId) === userId);
  if (!competition || (competition.status === 'draft' && !isOwner)) throw Errors.notFound('Competition');
  return competition;
}

export async function getCompetitionDetails(idOrSlug: string, lang: Lang, userId: string | undefined, baseUrl: string) {
  const c = await findVisibleCompetition(idOrSlug, userId);
  const now = clock.now();
  const lifecycle = computeLifecycle(c, now);
  const isOrganizer = Boolean(userId && c.organizerId && String(c.organizerId) === userId);

  const [judges, registration, submission, result, organizer, myRating, saved] = await Promise.all([
    JudgeModel.find({ _id: { $in: c.judgeIds } }).lean(),
    userId && !isOrganizer ? RegistrationModel.findOne({ competitionId: c._id, userId }).lean() : null,
    userId && !isOrganizer ? SubmissionModel.findOne({ competitionId: c._id, userId, status: 'submitted' }).lean() : null,
    userId && lifecycle.phase === 'results_out'
      ? CompetitionResultModel.findOne({ competitionId: c._id, userId }, { position: 1 }).lean()
      : null,
    c.organizerId ? UserModel.findById(c.organizerId, { name: 1, avatarUrl: 1, organizerRating: 1 }).lean() : null,
    userId ? RatingModel.findOne({ competitionId: c._id, userId }).lean() : null,
    userId ? SavedCompetitionModel.exists({ competitionId: c._id, userId }) : null,
  ]);

  const viewerState = computeViewerState(
    {
      authenticated: Boolean(userId),
      isOrganizer,
      registration,
      hasSubmission: Boolean(submission),
      resultPosition: result?.position ?? null,
    },
    now,
  );

  return {
    competition: {
      ...serializeCompetition(c, judges, lang, baseUrl),
      rating: ratingSummary(c.rating),
      organizer: organizer
        ? { id: String(organizer._id), name: organizer.name, avatarUrl: mediaUrl(organizer.avatarUrl, baseUrl), rating: ratingSummary(organizer.organizerRating) }
        : null,
    },
    lifecycle,
    viewer: {
      state: viewerState,
      isOrganizer,
      registration: registration ? serializeRegistration(registration) : null,
      submission: submission ? serializeSubmission(submission, baseUrl) : null,
      resultPosition: result?.position ?? null,
      myRating: myRating ? serializeMyRating(myRating) : null,
      isSaved: Boolean(saved),
    },
    actions: computeActions(lifecycle, viewerState, c.timeline, now, c.status),
    serverTime: now,
  };
}

// ---------------------------------------------------------------------------
// Browse / filter

export const PHASE_FILTERS = ['active', 'ongoing', 'past', 'open', 'closing_soon', 'upcoming', 'submissions', 'judging', 'results', 'cancelled'] as const;
export type PhaseFilter = (typeof PHASE_FILTERS)[number];
export const SORTS = ['closing', 'newest', 'prize'] as const;
export type Sort = (typeof SORTS)[number];

export interface ListFilters {
  phase?: PhaseFilter;
  category?: Category;
  fee?: 'free' | 'paid';
  hasSpots?: boolean;
  /** Only the viewer's saved competitions (requires a logged-in user). */
  saved?: boolean;
  q?: string;
  sort: Sort;
  page: number;
  limit: number;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Phase filters are translated into timeline ranges, so they use the same indexes as the rest. */
function phaseQuery(phase: PhaseFilter, now: Date): QueryFilter<Competition> {
  switch (phase) {
    // Stage buckets: an old competition is never "active".
    case 'active':
      return { status: 'published', 'timeline.resultAt': { $gt: now } };
    case 'ongoing':
      return { status: 'published', 'timeline.registrationOpensAt': { $lte: now }, 'timeline.resultAt': { $gt: now } };
    case 'past':
      return { $or: [{ status: 'cancelled' }, { status: 'published', 'timeline.resultAt': { $lte: now } }] };
    case 'upcoming':
      return { status: 'published', 'timeline.registrationOpensAt': { $gt: now } };
    case 'open':
      return { status: 'published', 'timeline.registrationOpensAt': { $lte: now }, 'timeline.registrationClosesAt': { $gt: now } };
    case 'closing_soon':
      return {
        status: 'published',
        'timeline.registrationOpensAt': { $lte: now },
        'timeline.registrationClosesAt': { $gt: now, $lte: new Date(now.getTime() + URGENCY_WINDOW_MS) },
      };
    case 'submissions':
      return { status: 'published', 'timeline.registrationClosesAt': { $lte: now }, 'timeline.submissionEndsAt': { $gt: now } };
    case 'judging':
      return { status: 'published', 'timeline.submissionEndsAt': { $lte: now }, 'timeline.resultAt': { $gt: now } };
    case 'results':
      return { status: 'published', 'timeline.resultAt': { $lte: now } };
    case 'cancelled':
      return { status: 'cancelled' };
  }
}

const SORT_SPEC: Record<Sort, Record<string, SortOrder>> = {
  closing: { 'timeline.registrationClosesAt': 1, _id: 1 },
  newest: { createdAt: -1, _id: -1 },
  prize: { prizePool: -1, _id: -1 },
};

export async function listCompetitions(lang: Lang, f: ListFilters, userId?: string) {
  const now = clock.now();
  if (f.saved && !userId) throw Errors.unauthenticated();
  const query: QueryFilter<Competition> = f.phase ? phaseQuery(f.phase, now) : { status: { $in: ['published', 'cancelled'] } };
  if (f.category) query.category = f.category;
  if (f.fee === 'free') query.entryFee = 0;
  if (f.fee === 'paid') query.entryFee = { $gt: 0 };
  if (f.hasSpots) query.$expr = { $lt: [{ $add: ['$seats.confirmed', '$seats.held'] }, '$seats.total'] };
  if (f.saved) {
    const saved = await SavedCompetitionModel.find({ userId }, { competitionId: 1 }).limit(1000).lean();
    query._id = { $in: saved.map((s) => s.competitionId) };
  }
  if (f.q) {
    const re = new RegExp(escapeRegex(f.q), 'i');
    query.$and = [...(query.$and ?? []), { $or: [{ 'title.en': re }, { 'title.hi': re }] }];
  }

  // Fetch one extra row to know whether another page exists without a count query.
  const rows = await CompetitionModel.find(query, {
    slug: 1, title: 1, category: 1, status: 1, entryFee: 1, prizePool: 1, currency: 1, seats: 1, timeline: 1, media: 1, rating: 1,
  })
    .sort(SORT_SPEC[f.sort])
    .skip((f.page - 1) * f.limit)
    .limit(f.limit + 1)
    .lean();

  const page = rows.slice(0, f.limit);
  // Mark which of this page the viewer has saved (one indexed query per page).
  const savedIds = userId
    ? new Set(
        (await SavedCompetitionModel.find({ userId, competitionId: { $in: page.map((c) => c._id) } }, { competitionId: 1 }).lean()).map((s) =>
          String(s.competitionId),
        ),
      )
    : null;
  return {
    competitions: page.map((c) => serializeSummary(c, lang, now, savedIds?.has(String(c._id)) ?? false)),
    page: f.page,
    hasMore: rows.length > f.limit,
  };
}

export function serializeSummary(
  c: Pick<Competition, 'slug' | 'title' | 'category' | 'status' | 'entryFee' | 'prizePool' | 'currency' | 'seats' | 'timeline'> & { _id: unknown; rating?: Competition['rating'] },
  lang: Lang,
  now: Date,
  /** Whether the current viewer bookmarked this competition. `false` where the caller hasn't looked it up. */
  isSaved = false,
) {
  return {
    id: String(c._id),
    slug: c.slug,
    status: c.status,
    title: t(c.title, lang),
    category: c.category,
    currency: c.currency,
    entryFee: c.entryFee,
    prizePool: c.prizePool,
    seats: serializeSeats(c.seats),
    timeline: c.timeline,
    lifecycle: computeLifecycle(c, now),
    rating: ratingSummary(c.rating),
    isSaved,
  };
}

/** Lightweight, frequently polled: live spots only. */
export async function getAvailability(idOrSlug: string) {
  const c = await CompetitionModel.findOne({ ...byIdOrSlug(idOrSlug), status: { $ne: 'draft' } }, { seats: 1, status: 1, timeline: 1 }).lean();
  if (!c) throw Errors.notFound('Competition');
  const now = clock.now();
  const { registrationOpen, isFull } = computeLifecycle(c, now);
  return { seats: serializeSeats(c.seats), isFull, registrationOpen, serverTime: now };
}

export async function getPreviousWinners(idOrSlug: string, limit: number, baseUrl: string) {
  const c = await findVisibleCompetition(idOrSlug);
  const winners = await CompetitionResultModel.find({ seriesId: c.seriesId, competitionId: { $ne: c._id } })
    .sort({ position: 1, awardedAt: -1 })
    .limit(limit)
    .lean();
  return winners.map((w) => ({
    id: String(w._id),
    name: w.displayName,
    avatarUrl: mediaUrl(w.avatarUrl, baseUrl),
    position: w.position,
    videoUrl: mediaUrl(w.videoUrl, baseUrl),
    edition: w.edition ?? null,
    awardedAt: w.awardedAt,
  }));
}
