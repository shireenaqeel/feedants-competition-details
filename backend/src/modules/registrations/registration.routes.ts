import { Router } from 'express';
import { z } from 'zod';
import { objectIdSchema } from '../../lib/objectId.js';
import { requireAuth, userId } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { cancelHold, serializeRegistration, verifyPayment } from './registration.service.js';

export const registrationRouter = Router();

const params = z.object({ id: objectIdSchema });
const verifyBody = z.object({
  orderId: z.string().min(1).max(100),
  paymentId: z.string().min(1).max(100),
  signature: z.string().min(1).max(200),
});

registrationRouter.post('/:id/payment/verify', requireAuth, writeLimiter, async (req, res) => {
  const { id } = params.parse(req.params);
  const input = verifyBody.parse(req.body);
  const registration = await verifyPayment(id, userId(req), input);
  res.json({ registration: serializeRegistration(registration) });
});

registrationRouter.delete('/:id', requireAuth, writeLimiter, async (req, res) => {
  const { id } = params.parse(req.params);
  const registration = await cancelHold(id, userId(req));
  res.json({ registration: serializeRegistration(registration) });
});
