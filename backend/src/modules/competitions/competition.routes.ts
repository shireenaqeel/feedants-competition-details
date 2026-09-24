import { Router } from 'express';
import { z } from 'zod';
import { publicBaseUrl } from '../../lib/http.js';
import { LANGUAGES } from '../../lib/i18n.js';
import { objectIdSchema } from '../../lib/objectId.js';
import { optionalAuth, requireAuth, userId } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { registerForCompetition, serializeRegistration } from '../registrations/registration.service.js';
import { submissionRouter } from '../submissions/submission.routes.js';
import { CATEGORIES } from '../../lib/categories.js';
import { Errors } from '../../lib/errors.js';
import { CompetitionModel } from '../../models/competition.model.js';
import { SavedCompetitionModel } from '../../models/savedCompetition.model.js';
import { competitionAdminRouter } from '../organizer/organizer.routes.js';
import { peerRatingRouter } from '../ratings/peerRating.routes.js';
import { ratingRouter } from '../ratings/rating.routes.js';
import { getAvailability, getCompetitionDetails, getPreviousWinners, listCompetitions, PHASE_FILTERS, SORTS } from './competition.service.js';

export const competitionRouter = Router();

const idParam = z.object({ id: z.string().trim().min(1).max(100) }); // id or slug
const objectIdParam = z.object({ id: objectIdSchema });
const langQuery = z.object({ lang: z.enum(LANGUAGES).default('en') });
const limitQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

const listQuery = z.object({
  lang: z.enum(LANGUAGES).default('en'),
  phase: z.enum(PHASE_FILTERS).optional(),
  category: z.enum(CATEGORIES).optional(),
  fee: z.enum(['free', 'paid']).optional(),
  hasSpots: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  saved: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  q: z.string().trim().max(60).optional().transform((v) => v || undefined),
  sort: z.enum(SORTS).default('closing'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

competitionRouter.get('/', optionalAuth, async (req, res) => {
  const { lang, ...filters } = listQuery.parse(req.query);
  res.set('Cache-Control', req.user ? 'private, no-cache' : 'no-cache');
  res.json(await listCompetitions(lang, filters, req.user?.id));
});

/** Bookmark / un-bookmark. Both are idempotent, so double taps and retries are harmless. */
competitionRouter.put('/:id/save', requireAuth, writeLimiter, async (req, res) => {
  const { id } = objectIdParam.parse(req.params);
  const exists = await CompetitionModel.exists({ _id: id, status: { $in: ['published', 'cancelled'] } });
  if (!exists) throw Errors.notFound('Competition');
  await SavedCompetitionModel.updateOne({ userId: userId(req), competitionId: id }, { $setOnInsert: { userId: userId(req), competitionId: id } }, { upsert: true });
  res.json({ saved: true });
});

competitionRouter.delete('/:id/save', requireAuth, writeLimiter, async (req, res) => {
  const { id } = objectIdParam.parse(req.params);
  await SavedCompetitionModel.deleteOne({ userId: userId(req), competitionId: id });
  res.json({ saved: false });
});

competitionRouter.get('/:id', optionalAuth, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { lang } = langQuery.parse(req.query);
  res.set('Cache-Control', 'private, no-cache');
  res.json(await getCompetitionDetails(id, lang, req.user?.id, publicBaseUrl(req)));
});

competitionRouter.get('/:id/availability', async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.set('Cache-Control', 'no-store');
  res.json(await getAvailability(id));
});

competitionRouter.get('/:id/previous-winners', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { limit } = limitQuery.parse(req.query);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ winners: await getPreviousWinners(id, limit, publicBaseUrl(req)) });
});

competitionRouter.post('/:id/registrations', requireAuth, writeLimiter, async (req, res) => {
  const { id } = objectIdParam.parse(req.params);
  const { registration, payment, created } = await registerForCompetition(id, userId(req));
  res.status(created ? 201 : 200).json({ registration: serializeRegistration(registration), payment });
});

competitionRouter.use('/:id/submissions', submissionRouter);
competitionRouter.use('/:id/ratings', ratingRouter);
competitionRouter.use('/:id/participants', peerRatingRouter);

// Organizer write endpoints: create, edit, publish, cancel, delete draft.
competitionRouter.use(competitionAdminRouter);
