import type { Request } from 'express';
import { env } from '../config/env.js';

/** Base URL clients should use for links served by this API. */
export function publicBaseUrl(req: Request): string {
  return env.publicBaseUrl ?? `${req.protocol}://${req.get('host')}`;
}
