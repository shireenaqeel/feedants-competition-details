import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';

export interface PaymentOrder {
  provider: string;
  orderId: string;
  amount: number; // paise
  currency: string;
  keyId: string; // public key the app passes to the checkout SDK
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: { amount: number; currency: string; receipt: string }): Promise<PaymentOrder>;
  /** Checkout success callback: HMAC_SHA256(orderId + "|" + paymentId, keySecret). Same scheme as Razorpay. */
  verifyPaymentSignature(input: { orderId: string; paymentId: string; signature: string }): boolean;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}

function hmac(secret: string, data: string | Buffer): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function signPayment(orderId: string, paymentId: string, secret = env.payment.keySecret): string {
  return hmac(secret, `${orderId}|${paymentId}`);
}

abstract class HmacProvider implements PaymentProvider {
  abstract readonly name: string;
  abstract createOrder(input: { amount: number; currency: string; receipt: string }): Promise<PaymentOrder>;

  verifyPaymentSignature({ orderId, paymentId, signature }: { orderId: string; paymentId: string; signature: string }) {
    return safeEqual(signPayment(orderId, paymentId), signature);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string) {
    return safeEqual(hmac(env.payment.webhookSecret, rawBody), signature);
  }
}

/** Local development / tests: no network, same order + signature flow as Razorpay. */
class MockProvider extends HmacProvider {
  readonly name = 'mock';
  async createOrder({ amount, currency }: { amount: number; currency: string; receipt: string }) {
    return { provider: this.name, orderId: `order_mock_${randomBytes(8).toString('hex')}`, amount, currency, keyId: env.payment.keyId };
  }
}

class RazorpayProvider extends HmacProvider {
  readonly name = 'razorpay';
  async createOrder({ amount, currency, receipt }: { amount: number; currency: string; receipt: string }) {
    const auth = Buffer.from(`${env.payment.keyId}:${env.payment.keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency, receipt }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Could not create payment order');
    const order = (await res.json()) as { id: string };
    return { provider: this.name, orderId: order.id, amount, currency, keyId: env.payment.keyId };
  }
}

export const paymentProvider: PaymentProvider = env.payment.provider === 'razorpay' ? new RazorpayProvider() : new MockProvider();
