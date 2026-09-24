import type { RequestHandler } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError, Errors } from '../lib/errors.js';

export function signToken(userId: string): string {
  return jwt.sign({}, env.jwtSecret, { subject: userId, expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] });
}

function readUser(header: string | undefined): { id: string } | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'INVALID_TOKEN', 'Malformed Authorization header');
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (typeof payload === 'string' || !payload.sub) throw new Error('no subject');
    return { id: payload.sub };
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
  }
}

/** Attaches req.user when a token is sent; anonymous requests pass through. A bad token is still rejected. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  req.user = readUser(req.headers.authorization);
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  req.user = readUser(req.headers.authorization);
  if (!req.user) throw Errors.unauthenticated();
  next();
};

/** For handlers mounted after requireAuth. */
export function userId(req: Express.Request): string {
  if (!req.user) throw Errors.unauthenticated();
  return req.user.id;
}
