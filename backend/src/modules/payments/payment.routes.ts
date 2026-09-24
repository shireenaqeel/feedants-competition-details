import { randomBytes } from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError, Errors } from '../../lib/errors.js';
import { requireAuth, userId } from '../../middleware/auth.js';
import { RegistrationModel } from '../../models/registration.model.js';
import { confirmPaidOrder } from '../registrations/registration.service.js';
import { paymentProvider, signPayment } from './provider.js';

export const paymentRouter = Router();

/**
 * Development only: stands in for the Razorpay checkout sheet. Returns what the SDK returns on
 * success, which the app then sends to /registrations/:id/payment/verify.
 */
if (env.payment.provider === 'mock') {
  paymentRouter.post('/mock/checkout', requireAuth, async (req, res) => {
    const { orderId } = z.object({ orderId: z.string().min(1) }).parse(req.body);
    const reg = await RegistrationModel.findOne({ 'payment.orderId': orderId }, { userId: 1 }).lean();
    if (!reg) throw Errors.notFound('Order');
    if (String(reg.userId) !== userId(req)) throw Errors.forbidden();
    const paymentId = `pay_mock_${randomBytes(8).toString('hex')}`;
    res.json({ orderId, paymentId, signature: signPayment(orderId, paymentId) });
  });
}

const webhookEvent = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({ entity: z.object({ id: z.string(), order_id: z.string() }) }).optional(),
  }),
});

/** Provider webhook (Razorpay format). Needs the raw body for signature verification. */
export const webhookRouter = Router();
webhookRouter.post('/payments', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const signature = req.header('x-razorpay-signature');
  if (!signature || !Buffer.isBuffer(req.body) || !paymentProvider.verifyWebhookSignature(req.body, signature)) {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Webhook signature is invalid');
  }
  const { event, payload } = webhookEvent.parse(JSON.parse(req.body.toString('utf8')));
  if ((event === 'payment.captured' || event === 'order.paid') && payload.payment) {
    const { id: paymentId, order_id: orderId } = payload.payment.entity;
    try {
      await confirmPaidOrder(orderId, paymentId);
    } catch (err) {
      // Orders we don't know about are acknowledged so the provider stops retrying.
      if (!(err instanceof AppError && err.status === 404)) throw err;
    }
  }
  res.json({ received: true });
});
