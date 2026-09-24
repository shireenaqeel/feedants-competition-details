import { Router } from 'express';
import { clock } from '../lib/clock.js';
import { dbState } from '../db/connect.js';

export const healthRouter = Router();

// `time` doubles as the server clock reference the app uses for countdowns.
healthRouter.get('/', (_req, res) => {
  const db = dbState();
  res.status(db === 'connected' ? 200 : 503).json({ status: 'ok', db, time: clock.now().toISOString() });
});
