import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { publicBaseUrl } from '../../lib/http.js';
import { signToken } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { UserModel } from '../../models/user.model.js';
import { serializeUser } from '../users/user.routes.js';

// Phone-based sign up / log in without OTP verification (a stand-in until an SMS provider is
// added). Disabled in production unless explicitly allowed.
export const authRouter = Router();

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{10,15}$/, 'Enter a valid phone number'));

const onlyWhereAllowed: RequestHandler = (_req, _res, next) => {
  if (env.isProduction && process.env.ALLOW_DEMO_LOGIN !== 'true') throw new AppError(404, 'NOT_FOUND', 'Not found');
  next();
};

/** New account: empty profile (no photo, zero stats). */
authRouter.post('/signup', authLimiter, onlyWhereAllowed, async (req, res) => {
  const body = z.object({ name: z.string().trim().min(1, 'Enter your name').max(60), phone }).parse(req.body);
  try {
    const user = await UserModel.create({ name: body.name, phone: body.phone });
    res.status(201).json({ token: signToken(String(user._id)), user: serializeUser(user, publicBaseUrl(req)) });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new AppError(409, 'PHONE_TAKEN', 'An account with this phone number already exists. Log in instead.');
    }
    throw err;
  }
});

/** Existing account only; an unknown number is told to sign up. */
authRouter.post('/login', authLimiter, onlyWhereAllowed, async (req, res) => {
  const body = z.object({ phone }).parse(req.body);
  const user = await UserModel.findOne({ phone: body.phone });
  if (!user) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'No account with this phone number. Sign up first.');
  res.json({ token: signToken(String(user._id)), user: serializeUser(user, publicBaseUrl(req)) });
});
