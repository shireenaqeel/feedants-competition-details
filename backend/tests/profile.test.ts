import { describe, expect, it } from 'vitest';
import { signPayment } from '../src/modules/payments/provider.js';
import { api, auth, createCompetition, createUser } from './helpers.js';

const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

describe('profile', () => {
  it('returns the profile with stats', async () => {
    const user = await createUser('Asha');
    const res = await api().get('/api/v1/users/me').set(auth(user));
    expect(res.body.user).toMatchObject({ name: 'Asha', avatarUrl: null, bio: null });
    expect(res.body.stats).toEqual({
      registered: 0,
      submitted: 0,
      noShows: 0,
      won: 0,
      organized: 0,
      sportsmanship: { average: null, count: 0 },
      organizerRating: { average: null, count: 0 },
    });
  });

  it('edits name, bio, city, language and photo; clears fields with empty values', async () => {
    const user = await createUser();
    const upload = await api().post('/api/v1/uploads/images').set(auth(user)).attach('file', png, { filename: 'me.png', contentType: 'image/png' });
    expect(upload.status).toBe(201);
    expect(upload.body.path).toMatch(/^\/uploads\/images\//);

    const res = await api()
      .patch('/api/v1/users/me')
      .set(auth(user))
      .send({ name: 'Asha K', bio: 'Dancer', city: 'Pune', language: 'hi', avatarUrl: upload.body.path });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Asha K', bio: 'Dancer', city: 'Pune', language: 'hi' });
    expect(res.body.user.avatarUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/uploads\/images\//);

    const cleared = await api().patch('/api/v1/users/me').set(auth(user)).send({ bio: '', avatarUrl: null });
    expect(cleared.body.user).toMatchObject({ bio: null, avatarUrl: null });
  });

  it('validates profile edits', async () => {
    const user = await createUser();
    const bad = async (body: object) => (await api().patch('/api/v1/users/me').set(auth(user)).send(body)).status;
    expect(await bad({ name: '' })).toBe(400);
    expect(await bad({ avatarUrl: 'https://evil.example/x.png' })).toBe(400); // only uploaded photos
    expect(await bad({ phone: '123' })).toBe(400); // phone is not editable
    expect(await bad({})).toBe(400);
    const txt = await api().post('/api/v1/uploads/images').set(auth(user)).attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(txt.status).toBe(415);
  });

  it('lists my competitions with registration status', async () => {
    const user = await createUser();
    const c = await createCompetition(new Date());
    const reg = await api().post(`/api/v1/competitions/${c._id}/registrations`).set(auth(user));
    const { orderId } = reg.body.payment;
    await api()
      .post(`/api/v1/registrations/${reg.body.registration.id}/payment/verify`)
      .set(auth(user))
      .send({ orderId, paymentId: 'p', signature: signPayment(orderId, 'p') });

    const res = await api().get('/api/v1/users/me/registrations').set(auth(user));
    expect(res.body.registrations).toHaveLength(1);
    expect(res.body.registrations[0]).toMatchObject({ registration: { status: 'confirmed' }, competition: { slug: c.slug }, hasSubmission: false });
    expect((await api().get('/api/v1/users/me').set(auth(user))).body.stats.registered).toBe(1);
  });
});
