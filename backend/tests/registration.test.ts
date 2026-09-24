import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { clock } from '../src/lib/clock.js';
import { CompetitionModel } from '../src/models/competition.model.js';
import { RegistrationModel } from '../src/models/registration.model.js';
import { signPayment } from '../src/modules/payments/provider.js';
import { expireStaleHolds } from '../src/modules/registrations/registration.service.js';
import { api, auth, createCompetition, createUser, createUsers } from './helpers.js';
import { createHmac } from 'node:crypto';

const seatsOf = async (id: unknown) => (await CompetitionModel.findById(id).lean())!.seats;

async function registerAndPay(competitionId: unknown, user: { _id: unknown }) {
  const reg = await api().post(`/api/v1/competitions/${competitionId}/registrations`).set(auth(user));
  const { orderId } = reg.body.payment;
  const paymentId = `pay_${Math.random().toString(36).slice(2)}`;
  const verify = await api()
    .post(`/api/v1/registrations/${reg.body.registration.id}/payment/verify`)
    .set(auth(user))
    .send({ orderId, paymentId, signature: signPayment(orderId, paymentId) });
  return { reg, verify, orderId, paymentId };
}

describe('concurrent registration', () => {
  it('50 users racing for 20 spots: exactly 20 get a spot, nobody is oversold', async () => {
    const competition = await createCompetition(new Date(), { seats: { total: 20, confirmed: 0, held: 0 } });
    const users = await createUsers(50);

    const responses = await Promise.all(
      users.map((u) => api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(u))),
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(20);
    const rejected = responses.filter((r) => r.status === 409);
    expect(rejected).toHaveLength(30);
    rejected.forEach((r) => expect(r.body.error.code).toBe('COMPETITION_FULL'));

    expect(await seatsOf(competition._id)).toMatchObject({ total: 20, held: 20, confirmed: 0 });
    expect(await RegistrationModel.countDocuments({ competitionId: competition._id })).toBe(20);
  });

  it('one user sending 10 parallel requests gets one registration and holds one spot', async () => {
    const competition = await createCompetition(new Date());
    const user = await createUser();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(user))),
    );

    responses.forEach((r) => expect([200, 201]).toContain(r.status));
    expect(new Set(responses.map((r) => r.body.registration.id)).size).toBe(1);
    expect(new Set(responses.map((r) => r.body.payment.orderId)).size).toBe(1);
    expect(await seatsOf(competition._id)).toMatchObject({ held: 1, confirmed: 0 });
    expect(await RegistrationModel.countDocuments({ competitionId: competition._id })).toBe(1);
  });
});

describe('registration rules', () => {
  it('rejects when registration is closed or not yet open', async () => {
    const now = new Date();
    const user = await createUser();
    const closed = await createCompetition(now, {
      timeline: {
        registrationOpensAt: new Date(now.getTime() - 10 * 86_400_000),
        registrationClosesAt: new Date(now.getTime() - 1000),
        submissionStartsAt: new Date(now.getTime() - 86_400_000),
        submissionEndsAt: new Date(now.getTime() + 86_400_000),
        resultAt: new Date(now.getTime() + 2 * 86_400_000),
      },
    });
    const res = await api().post(`/api/v1/competitions/${closed._id}/registrations`).set(auth(user));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REGISTRATION_CLOSED');
    expect(await seatsOf(closed._id)).toMatchObject({ held: 0 });
  });

  it('requires login and a valid id', async () => {
    const competition = await createCompetition(new Date());
    expect((await api().post(`/api/v1/competitions/${competition._id}/registrations`)).status).toBe(401);
    const user = await createUser();
    expect((await api().post('/api/v1/competitions/not-an-id/registrations').set(auth(user))).status).toBe(400);
    expect((await api().post('/api/v1/competitions/64b000000000000000000000/registrations').set(auth(user))).status).toBe(404);
  });

  it('free competitions confirm immediately without payment', async () => {
    const competition = await createCompetition(new Date(), { entryFee: 0 });
    const user = await createUser();
    const res = await api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(user));
    expect(res.status).toBe(201);
    expect(res.body.registration.status).toBe('confirmed');
    expect(res.body.payment).toBeNull();
    expect(await seatsOf(competition._id)).toMatchObject({ confirmed: 1, held: 0 });
  });
});

describe('payment', () => {
  it('verify confirms the registration and moves the seat from held to confirmed', async () => {
    const competition = await createCompetition(new Date());
    const user = await createUser();
    const { verify } = await registerAndPay(competition._id, user);
    expect(verify.status).toBe(200);
    expect(verify.body.registration.status).toBe('confirmed');
    expect(await seatsOf(competition._id)).toMatchObject({ confirmed: 1, held: 0 });
  });

  it('rejects a forged signature', async () => {
    const competition = await createCompetition(new Date());
    const user = await createUser();
    const reg = await api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(user));
    const res = await api()
      .post(`/api/v1/registrations/${reg.body.registration.id}/payment/verify`)
      .set(auth(user))
      .send({ orderId: reg.body.payment.orderId, paymentId: 'pay_x', signature: 'forged' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAYMENT_VERIFICATION_FAILED');
    expect(await seatsOf(competition._id)).toMatchObject({ confirmed: 0, held: 1 });
  });

  it('another user cannot verify or cancel my registration', async () => {
    const competition = await createCompetition(new Date());
    const [owner, other] = await createUsers(2);
    const reg = await api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(owner));
    const res = await api().delete(`/api/v1/registrations/${reg.body.registration.id}`).set(auth(other));
    expect(res.status).toBe(403);
  });

  it('client verify and webhook racing for the same order confirm exactly once', async () => {
    const competition = await createCompetition(new Date());
    const user = await createUser();
    const reg = await api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(user));
    const orderId = reg.body.payment.orderId;
    const paymentId = 'pay_race';

    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: orderId } } } });
    const webhookSig = createHmac('sha256', env.payment.webhookSecret).update(body).digest('hex');

    const [verify, webhook, webhook2] = await Promise.all([
      api()
        .post(`/api/v1/registrations/${reg.body.registration.id}/payment/verify`)
        .set(auth(user))
        .send({ orderId, paymentId, signature: signPayment(orderId, paymentId) }),
      api().post('/api/v1/webhooks/payments').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSig).send(body),
      api().post('/api/v1/webhooks/payments').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSig).send(body),
    ]);

    expect(verify.status).toBe(200);
    expect(webhook.status).toBe(200);
    expect(webhook2.status).toBe(200);
    expect(await seatsOf(competition._id)).toMatchObject({ confirmed: 1, held: 0 });
  });

  it('webhook with a bad signature is rejected', async () => {
    const res = await api()
      .post('/api/v1/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'nope')
      .send(JSON.stringify({ event: 'payment.captured', payload: {} }));
    expect(res.status).toBe(400);
  });
});

describe('holds', () => {
  it('cancelling a pending payment releases the spot, and the user can register again', async () => {
    const competition = await createCompetition(new Date());
    const user = await createUser();
    const first = await api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(user));
    const cancel = await api().delete(`/api/v1/registrations/${first.body.registration.id}`).set(auth(user));
    expect(cancel.body.registration.status).toBe('cancelled');
    expect(await seatsOf(competition._id)).toMatchObject({ held: 0 });

    const again = await api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(user));
    expect(again.status).toBe(201);
    expect(again.body.registration.id).toBe(first.body.registration.id); // same document reused
    expect(again.body.payment.orderId).not.toBe(first.body.payment.orderId);
    expect(await seatsOf(competition._id)).toMatchObject({ held: 1 });
  });

  it('the sweeper releases abandoned holds exactly once, even when run concurrently', async () => {
    const start = new Date();
    const competition = await createCompetition(start);
    const users = await createUsers(3);
    for (const u of users) await api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(u));
    expect(await seatsOf(competition._id)).toMatchObject({ held: 3 });

    const later = new Date(start.getTime() + (env.holdMinutes + 1) * 60_000);
    const results = await Promise.all([expireStaleHolds(later), expireStaleHolds(later), expireStaleHolds(later)]);
    expect(results.reduce((a, b) => a + b, 0)).toBe(3);
    expect(await seatsOf(competition._id)).toMatchObject({ held: 0 });
    expect(await RegistrationModel.countDocuments({ status: 'expired' })).toBe(3);
  });

  it('a user whose hold lapsed (before the sweeper ran) can register again without leaking a seat', async () => {
    const start = new Date();
    const competition = await createCompetition(start);
    const user = await createUser();
    await api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(user));

    clock.set(new Date(start.getTime() + (env.holdMinutes + 1) * 60_000));
    const again = await api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(user));
    expect(again.status).toBe(201);
    expect(await seatsOf(competition._id)).toMatchObject({ held: 1 });
  });

  it('payment arriving after the hold expired: confirmed if a spot is free, otherwise refund_required', async () => {
    const start = new Date();
    const competition = await createCompetition(start, { seats: { total: 1, confirmed: 0, held: 0 } });
    const [late, other] = await createUsers(2);

    const reg = await api().post(`/api/v1/competitions/${competition._id}/registrations`).set(auth(late));
    const { orderId } = reg.body.payment;
    const later = new Date(start.getTime() + (env.holdMinutes + 1) * 60_000);
    clock.set(later);
    await expireStaleHolds(later);

    // Someone else takes the only spot, then the late payment arrives.
    await registerAndPay(competition._id, other);
    const res = await api()
      .post(`/api/v1/registrations/${reg.body.registration.id}/payment/verify`)
      .set(auth(late))
      .send({ orderId, paymentId: 'pay_late', signature: signPayment(orderId, 'pay_late') });

    expect(res.status).toBe(200);
    expect(res.body.registration.status).toBe('refund_required');
    expect(await seatsOf(competition._id)).toMatchObject({ total: 1, confirmed: 1, held: 0 });
  });
});
