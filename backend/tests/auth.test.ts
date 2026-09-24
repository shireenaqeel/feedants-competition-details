import { describe, expect, it } from 'vitest';
import { api } from './helpers.js';

describe('sign up and log in', () => {
  it('sign up creates an empty profile: no photo, zero stats', async () => {
    const res = await api().post('/api/v1/auth/signup').send({ name: 'Asha', phone: '98765 43210' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Asha', phone: '9876543210', avatarUrl: null, bio: null, city: null });

    const me = await api().get('/api/v1/users/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.stats).toMatchObject({ registered: 0, submitted: 0, noShows: 0, won: 0, organized: 0, sportsmanship: { count: 0 } });
  });

  it('the same phone cannot sign up twice, even concurrently', async () => {
    const body = { name: 'A', phone: '9000011111' };
    const results = await Promise.all([api().post('/api/v1/auth/signup').send(body), api().post('/api/v1/auth/signup').send(body)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe('PHONE_TAKEN');
  });

  it('log in only works for existing accounts', async () => {
    const missing = await api().post('/api/v1/auth/login').send({ phone: '9111111111' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('ACCOUNT_NOT_FOUND');

    await api().post('/api/v1/auth/signup').send({ name: 'Ravi', phone: '9111111111' });
    const ok = await api().post('/api/v1/auth/login').send({ phone: '9111111111' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.name).toBe('Ravi');
    expect(typeof ok.body.token).toBe('string');
  });

  it('validates input', async () => {
    expect((await api().post('/api/v1/auth/signup').send({ phone: '9111111111' })).status).toBe(400);
    expect((await api().post('/api/v1/auth/login').send({ phone: '123' })).status).toBe(400);
  });

  it('platform stats count active competitions only', async () => {
    const res = await api().get('/api/v1/stats');
    expect(res.body).toEqual({ activeCompetitions: 0, activePrizePool: 0, participants: 0 });
  });
});
