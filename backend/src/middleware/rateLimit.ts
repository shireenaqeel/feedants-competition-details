import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

// In-memory store: fine for one instance. Multiple instances should share a Redis store.
function limiter(windowMs: number, limit: number): RequestHandler {
  if (env.isTest) return (_req, _res, next) => next();
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again shortly' } });
    },
  });
}

export const authLimiter = limiter(60_000, 20);
export const writeLimiter = limiter(60_000, 60);
