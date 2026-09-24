import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { competitionRouter } from './modules/competitions/competition.routes.js';
import { organizerRouter } from './modules/organizer/organizer.routes.js';
import { paymentRouter, webhookRouter } from './modules/payments/payment.routes.js';
import { registrationRouter } from './modules/registrations/registration.routes.js';
import { uploadRoot } from './modules/submissions/storage.js';
import { uploadRouter } from './modules/uploads/upload.routes.js';
import { statsRouter } from './modules/stats/stats.routes.js';
import { testimonialRouter } from './modules/testimonials/testimonial.routes.js';
import { userRouter } from './modules/users/user.routes.js';
import { healthRouter } from './routes/health.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // correct client IPs for rate limiting behind a load balancer
  // CSP targets HTML pages; this API serves JSON and media only, and CSP's upgrade-insecure-requests
  // would stop browsers from playing videos served over plain HTTP in development.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',') }));
  if (!env.isTest) app.use(morgan('dev'));

  // Webhooks need the raw body for signature checks, so they are mounted before the JSON parser.
  app.use('/api/v1/webhooks', webhookRouter);
  app.use(express.json({ limit: '100kb' }));

  app.use('/uploads', express.static(uploadRoot, { maxAge: '1d', fallthrough: false }));
  // Bundled assets (demo videos). Resolved from this file so it works from src/ and dist/.
  app.use('/static', express.static(fileURLToPath(new URL('../assets', import.meta.url)), { maxAge: '7d', fallthrough: false }));

  const api = express.Router();
  api.use('/health', healthRouter);
  api.use('/auth', authRouter);
  api.use('/users', userRouter);
  api.use('/competitions', competitionRouter);
  api.use('/organizer', organizerRouter);
  api.use('/registrations', registrationRouter);
  api.use('/payments', paymentRouter);
  api.use('/testimonials', testimonialRouter);
  api.use('/uploads', uploadRouter);
  api.use('/stats', statsRouter);
  app.use('/api/v1', api);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
