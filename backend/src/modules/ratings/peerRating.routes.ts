import { Router } from 'express';
import { z } from 'zod';
import { publicBaseUrl } from '../../lib/http.js';
import { objectIdSchema } from '../../lib/objectId.js';
import { requireAuth, userId } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { listFellowParticipants, ratePeer } from './peerRating.service.js';

// Mounted at /competitions/:id/participants
export const peerRatingRouter = Router({ mergeParams: true });

peerRatingRouter.get('/', requireAuth, async (req, res) => {
  const { id } = z.object({ id: objectIdSchema }).parse(req.params);
  res.set('Cache-Control', 'private, no-cache');
  res.json({ participants: await listFellowParticipants(id, userId(req), publicBaseUrl(req)) });
});

peerRatingRouter.put('/:userId/sportsmanship', requireAuth, writeLimiter, async (req, res) => {
  const { id, userId: rateeId } = z.object({ id: objectIdSchema, userId: objectIdSchema }).parse(req.params);
  const { stars } = z.object({ stars: z.number().int().min(1).max(5) }).parse(req.body);
  await ratePeer(id, userId(req), rateeId, stars);
  res.json({ ok: true, stars });
});
