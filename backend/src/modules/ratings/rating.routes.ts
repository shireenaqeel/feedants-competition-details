import { Router } from 'express';
import { z } from 'zod';
import { publicBaseUrl } from '../../lib/http.js';
import { objectIdSchema } from '../../lib/objectId.js';
import { requireAuth, userId } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { listRatings, rateCompetition, rateSchema, serializeMyRating } from './rating.service.js';

// Mounted at /competitions/:id/ratings
export const ratingRouter = Router({ mergeParams: true });
const params = z.object({ id: objectIdSchema });

ratingRouter.get('/', async (req, res) => {
  const { id } = params.parse(req.params);
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(req.query);
  res.set('Cache-Control', 'public, max-age=30');
  res.json(await listRatings(id, limit, publicBaseUrl(req)));
});

/** Create or replace my rating (idempotent PUT). */
ratingRouter.put('/me', requireAuth, writeLimiter, async (req, res) => {
  const { id } = params.parse(req.params);
  const rating = await rateCompetition(id, userId(req), rateSchema.parse(req.body));
  res.json({ rating: serializeMyRating(rating) });
});
