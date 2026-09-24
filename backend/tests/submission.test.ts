import { describe, expect, it } from 'vitest';
import { clock } from '../src/lib/clock.js';
import { signPayment } from '../src/modules/payments/provider.js';
import { api, auth, createCompetition, createUser, DAY, HOUR } from './helpers.js';

const video = Buffer.from('fake-video-bytes');

async function paidUser(competitionId: unknown) {
  const user = await createUser();
  const reg = await api().post(`/api/v1/competitions/${competitionId}/registrations`).set(auth(user));
  const { orderId } = reg.body.payment;
  await api()
    .post(`/api/v1/registrations/${reg.body.registration.id}/payment/verify`)
    .set(auth(user))
    .send({ orderId, paymentId: 'pay_1', signature: signPayment(orderId, 'pay_1') });
  return user;
}

const upload = (competitionId: unknown, user: { _id: unknown }) =>
  api()
    .post(`/api/v1/competitions/${competitionId}/submissions`)
    .set(auth(user))
    .attach('file', video, { filename: 'dance.mp4', contentType: 'video/mp4' });

describe('submissions', () => {
  it('paid participant can upload and later replace their submission', async () => {
    const c = await createCompetition(new Date());
    const user = await paidUser(c._id);

    const first = await upload(c._id, user);
    expect(first.status).toBe(201);
    expect(first.body.submission.version).toBe(1);
    // Link uses the host the client called (a phone on the LAN gets a reachable URL).
    expect(first.body.submission.mediaUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/uploads\/submissions\//);

    const second = await upload(c._id, user);
    expect(second.body.submission.version).toBe(2);

    const details = await api().get(`/api/v1/competitions/${c._id}`).set(auth(user));
    expect(details.body.viewer.state).toBe('submitted');
  });

  it('only paid participants can submit', async () => {
    const c = await createCompetition(new Date());
    const user = await createUser();
    await api().post(`/api/v1/competitions/${c._id}/registrations`).set(auth(user)); // pending, unpaid
    const res = await upload(c._id, user);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_REGISTERED');
  });

  it('respects the submission window', async () => {
    const now = new Date();
    const c = await createCompetition(now, {
      timeline: {
        registrationOpensAt: new Date(now.getTime() - DAY),
        registrationClosesAt: new Date(now.getTime() + DAY),
        submissionStartsAt: new Date(now.getTime() + 2 * HOUR),
        submissionEndsAt: new Date(now.getTime() + 2 * DAY),
        resultAt: new Date(now.getTime() + 3 * DAY),
      },
    });
    const user = await paidUser(c._id);

    expect((await upload(c._id, user)).body.error.code).toBe('SUBMISSION_NOT_STARTED');
    clock.set(new Date(now.getTime() + 3 * HOUR));
    expect((await upload(c._id, user)).status).toBe(201);
    clock.set(new Date(now.getTime() + 2 * DAY + 1));
    expect((await upload(c._id, user)).body.error.code).toBe('SUBMISSION_CLOSED');
  });

  it('rejects unsupported file types', async () => {
    const c = await createCompetition(new Date());
    const user = await paidUser(c._id);
    const res = await api()
      .post(`/api/v1/competitions/${c._id}/submissions`)
      .set(auth(user))
      .attach('file', Buffer.from('x'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(415);
  });
});
