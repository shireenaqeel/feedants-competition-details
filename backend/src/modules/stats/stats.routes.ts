import { Router } from 'express';
import { clock } from '../../lib/clock.js';
import { CompetitionModel } from '../../models/competition.model.js';
import { RegistrationModel } from '../../models/registration.model.js';

export const statsRouter = Router();

/** Platform numbers for the home screen. Cheap aggregate, cached briefly by clients and proxies. */
statsRouter.get('/', async (_req, res) => {
  const now = clock.now();
  const [active] = await CompetitionModel.aggregate<{ count: number; prizes: number }>([
    { $match: { status: 'published', 'timeline.resultAt': { $gt: now } } },
    { $group: { _id: null, count: { $sum: 1 }, prizes: { $sum: '$prizePool' } } },
  ]);
  const participants = (await RegistrationModel.distinct('userId', { status: 'confirmed' })).length;
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ activeCompetitions: active?.count ?? 0, activePrizePool: active?.prizes ?? 0, participants });
});
