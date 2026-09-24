import { describe, expect, it } from 'vitest';
import { clock } from '../src/lib/clock.js';
import { CompetitionResultModel } from '../src/models/competitionResult.model.js';
import { JudgeModel } from '../src/models/judge.model.js';
import { api, auth, createCompetition, createUser, DAY } from './helpers.js';

describe('GET /competitions/:id', () => {
  it('returns content, live seats, lifecycle and server time for guests', async () => {
    const now = new Date();
    const judge = await JudgeModel.create({ name: 'Manju Dubey', title: { en: 'Kathak Dancer', hi: 'कथक नृत्यांगना' }, experienceYears: 12 });
    const c = await createCompetition(now, { judgeIds: [judge._id], seats: { total: 20, confirmed: 1, held: 0 } });

    const res = await api().get(`/api/v1/competitions/${c.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.competition).toMatchObject({
      title: 'Test Competition',
      seats: { total: 20, booked: 1, left: 19 },
      judges: [{ name: 'Manju Dubey', title: 'Kathak Dancer', experienceYears: 12 }],
    });
    expect(res.body.lifecycle.phase).toBe('registration_open');
    expect(res.body.viewer.state).toBe('guest');
    expect(res.body.actions.register.reason).toBe('LOGIN_REQUIRED');
    expect(new Date(res.body.serverTime).getTime()).toBeGreaterThan(0);
  });

  it('localizes content with English fallback', async () => {
    const c = await createCompetition(new Date());
    const res = await api().get(`/api/v1/competitions/${c._id}?lang=hi`);
    expect(res.body.competition.title).toBe('परीक्षण प्रतियोगिता');
    expect(res.body.competition.content.about).toBe('About'); // no Hindi → English
    expect((await api().get(`/api/v1/competitions/${c._id}?lang=fr`)).status).toBe(400);
  });

  it('follows the viewer through register → pay → registered', async () => {
    const c = await createCompetition(new Date());
    const user = await createUser();
    expect((await api().get(`/api/v1/competitions/${c._id}`).set(auth(user))).body.viewer.state).toBe('not_registered');
    await api().post(`/api/v1/competitions/${c._id}/registrations`).set(auth(user));
    const pending = await api().get(`/api/v1/competitions/${c._id}`).set(auth(user));
    expect(pending.body.viewer.state).toBe('payment_pending');
    expect(pending.body.actions.pay.allowed).toBe(true);
  });

  it('phase and actions follow the server clock', async () => {
    const now = new Date();
    const c = await createCompetition(now);
    clock.set(new Date(now.getTime() + 6 * DAY));
    const res = await api().get(`/api/v1/competitions/${c._id}`);
    expect(res.body.lifecycle.phase).toBe('judging');
    expect(res.body.actions.register.reason).toBe('REGISTRATION_CLOSED');
  });

  it('hides drafts and handles unknown ids', async () => {
    const draft = await createCompetition(new Date(), { status: 'draft' });
    expect((await api().get(`/api/v1/competitions/${draft._id}`)).status).toBe(404);
    expect((await api().get('/api/v1/competitions/does-not-exist')).status).toBe(404);
  });

  it('rejects an invalid token instead of silently treating the user as a guest', async () => {
    const c = await createCompetition(new Date());
    const res = await api().get(`/api/v1/competitions/${c._id}`).set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });
});

describe('related endpoints', () => {
  it('lists published competitions with their lifecycle, never drafts', async () => {
    const now = new Date();
    await createCompetition(now, { slug: 'open-one' });
    await createCompetition(now, { slug: 'hidden', status: 'draft' });
    const res = await api().get('/api/v1/competitions');
    expect(res.status).toBe(200);
    expect(res.body.competitions.map((c: { slug: string }) => c.slug)).toEqual(['open-one']);
    expect(res.body.competitions[0].lifecycle.phase).toBe('registration_open');
  });

  it('availability reflects held and confirmed seats', async () => {
    const c = await createCompetition(new Date(), { seats: { total: 5, confirmed: 2, held: 1 } });
    const res = await api().get(`/api/v1/competitions/${c._id}/availability`);
    expect(res.body.seats).toEqual({ total: 5, booked: 2, held: 1, left: 2 });
  });

  it('previous winners come from other editions of the series, best position first', async () => {
    const now = new Date();
    const current = await createCompetition(now, { seriesId: 'classical' });
    const past = await createCompetition(now, { seriesId: 'classical' });
    await CompetitionResultModel.insertMany([
      { competitionId: past._id, seriesId: 'classical', displayName: 'Second', position: 2, awardedAt: now },
      { competitionId: past._id, seriesId: 'classical', displayName: 'First', position: 1, awardedAt: now },
      { competitionId: current._id, seriesId: 'classical', displayName: 'Current', position: 1, awardedAt: now },
      { competitionId: past._id, seriesId: 'other', displayName: 'Other series', position: 1, awardedAt: now },
    ]);
    const res = await api().get(`/api/v1/competitions/${current._id}/previous-winners`);
    expect(res.body.winners.map((w: { name: string }) => w.name)).toEqual(['First', 'Second']);
  });

  it('competition validation: rewards must add up to the prize pool', async () => {
    await expect(
      createCompetition(new Date(), { prizePool: 999 }),
    ).rejects.toThrow(/prize pool/);
  });
});
