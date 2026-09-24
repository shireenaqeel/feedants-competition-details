import { Router } from 'express';
import { z } from 'zod';
import { LANGUAGES } from '../../lib/i18n.js';
import { objectIdSchema } from '../../lib/objectId.js';
import { requireAuth, userId } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import type { Competition } from '../../models/competition.model.js';
import { createCompetitionSchema, updateCompetitionSchema } from './competition.validation.js';
import {
  cancelCompetition,
  createCompetition,
  deleteDraft,
  getEditableCompetition,
  listMyCompetitions,
  publishCompetition,
  updateCompetition,
} from './organizer.service.js';

const params = z.object({ id: objectIdSchema });
const brief = (c: Competition & { _id: unknown }) => ({ id: String(c._id), slug: c.slug, status: c.status });

/** Write endpoints, mounted on /competitions. Only the competition's organizer may use them. */
export const competitionAdminRouter = Router();

competitionAdminRouter.post('/', requireAuth, writeLimiter, async (req, res) => {
  const input = createCompetitionSchema.parse(req.body);
  const competition = await createCompetition(userId(req), input);
  res.status(201).json({ competition: brief(competition) });
});

competitionAdminRouter.patch('/:id', requireAuth, writeLimiter, async (req, res) => {
  const { id } = params.parse(req.params);
  const patch = updateCompetitionSchema.parse(req.body);
  res.json({ competition: brief(await updateCompetition(id, userId(req), patch)) });
});

competitionAdminRouter.post('/:id/publish', requireAuth, writeLimiter, async (req, res) => {
  const { id } = params.parse(req.params);
  res.json({ competition: brief(await publishCompetition(id, userId(req))) });
});

competitionAdminRouter.post('/:id/cancel', requireAuth, writeLimiter, async (req, res) => {
  const { id } = params.parse(req.params);
  const { competition, refunds } = await cancelCompetition(id, userId(req));
  res.json({ competition: brief(competition), refunds });
});

competitionAdminRouter.delete('/:id', requireAuth, writeLimiter, async (req, res) => {
  const { id } = params.parse(req.params);
  await deleteDraft(id, userId(req));
  res.status(204).end();
});

/** Organizer dashboard, mounted on /organizer. */
export const organizerRouter = Router();
organizerRouter.use(requireAuth);

organizerRouter.get('/competitions', async (req, res) => {
  const { lang } = z.object({ lang: z.enum(LANGUAGES).default('en') }).parse(req.query);
  res.set('Cache-Control', 'private, no-cache');
  res.json({ competitions: await listMyCompetitions(userId(req), lang) });
});

organizerRouter.get('/competitions/:id', async (req, res) => {
  const { id } = params.parse(req.params);
  res.set('Cache-Control', 'private, no-cache');
  res.json({ competition: await getEditableCompetition(id, userId(req)) });
});
