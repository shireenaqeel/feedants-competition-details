import { describe, expect, it } from 'vitest';
import { api, auth, createCompetition, createUser, DAY, HOUR } from './helpers.js';

async function setup() {
  const now = new Date();
  const t = now.getTime();
  const at = (open: number, close: number, subStart: number, subEnd: number, result: number) => ({
    registrationOpensAt: new Date(t + open),
    registrationClosesAt: new Date(t + close),
    submissionStartsAt: new Date(t + subStart),
    submissionEndsAt: new Date(t + subEnd),
    resultAt: new Date(t + result),
  });
  const openLater = at(-DAY, 5 * DAY, -HOUR, 6 * DAY, 7 * DAY);
  await createCompetition(now, { slug: 'open-dance', title: { en: 'Open Dance' }, category: 'dance', timeline: openLater });
  await createCompetition(now, { slug: 'closing-music', title: { en: 'Closing Music' }, category: 'music', entryFee: 0, timeline: at(-DAY, 5 * HOUR, 0, 3 * DAY, 4 * DAY) });
  await createCompetition(now, { slug: 'full-art', title: { en: 'Full Art' }, category: 'art', seats: { total: 2, confirmed: 2, held: 0 }, timeline: openLater });
  await createCompetition(now, { slug: 'upcoming-art', title: { en: 'Upcoming Art' }, category: 'art', timeline: at(DAY, 2 * DAY, 2 * DAY, 3 * DAY, 4 * DAY) });
  await createCompetition(now, { slug: 'results-dance', title: { en: 'Old Dance' }, category: 'dance', timeline: at(-9 * DAY, -8 * DAY, -8 * DAY, -3 * DAY, -DAY) });
  await createCompetition(now, { slug: 'cancelled-music', category: 'music', status: 'cancelled' });
  await createCompetition(now, { slug: 'draft-dance', category: 'dance', status: 'draft' });
}

const slugs = async (query: string) =>
  (await api().get(`/api/v1/competitions?${query}`)).body.competitions.map((c: { slug: string }) => c.slug).sort();

describe('browse filters', () => {
  it('never lists drafts', async () => {
    await setup();
    expect(await slugs('')).not.toContain('draft-dance');
    expect(await slugs('')).toHaveLength(6);
  });

  it('filters by phase', async () => {
    await setup();
    expect(await slugs('phase=open')).toEqual(['closing-music', 'full-art', 'open-dance']);
    expect(await slugs('phase=closing_soon')).toEqual(['closing-music']);
    expect(await slugs('phase=upcoming')).toEqual(['upcoming-art']);
    expect(await slugs('phase=results')).toEqual(['results-dance']);
    expect(await slugs('phase=cancelled')).toEqual(['cancelled-music']);
  });

  it('stage filters: active hides stale competitions; past includes finished and cancelled', async () => {
    await setup();
    expect(await slugs('phase=active')).toEqual(['closing-music', 'full-art', 'open-dance', 'upcoming-art']);
    expect(await slugs('phase=ongoing')).toEqual(['closing-music', 'full-art', 'open-dance']);
    expect(await slugs('phase=past')).toEqual(['cancelled-music', 'results-dance']);
    expect(await slugs('phase=past&q=music')).toEqual([]); // cancelled-music has the default title
  });

  it('filters by category, fee, free spots and search text', async () => {
    await setup();
    expect(await slugs('category=art')).toEqual(['full-art', 'upcoming-art']);
    expect(await slugs('fee=free')).toEqual(['closing-music']);
    expect(await slugs('phase=open&hasSpots=true')).toEqual(['closing-music', 'open-dance']);
    expect(await slugs('q=dance')).toEqual(['open-dance', 'results-dance']);
    expect(await slugs('q=.*')).toEqual([]); // regex characters are treated literally
  });

  it('sorts and paginates', async () => {
    await setup();
    const first = await api().get('/api/v1/competitions?sort=closing&limit=2');
    expect(first.body).toMatchObject({ page: 1, hasMore: true });
    expect(first.body.competitions[0].slug).toBe('results-dance');
    const last = await api().get('/api/v1/competitions?sort=closing&limit=2&page=3');
    expect(last.body.hasMore).toBe(false);
    expect(last.body.competitions).toHaveLength(2);
  });

  it('rejects unknown filter values', async () => {
    expect((await api().get('/api/v1/competitions?phase=soon')).status).toBe(400);
    expect((await api().get('/api/v1/competitions?category=cooking')).status).toBe(400);
  });
});

describe('saved competitions', () => {
  it('save/unsave is idempotent, reflected in details and the list, and requires login', async () => {
    const user = await createUser();
    const c = await createCompetition(new Date(), { slug: 'saveable' });
    const url = `/api/v1/competitions/${c._id}/save`;

    expect((await api().put(url)).status).toBe(401);
    const save1 = await api().put(url).set(auth(user));
    const save2 = await api().put(url).set(auth(user)); // idempotent
    expect([save1.status, save2.status]).toEqual([200, 200]);

    const details = await api().get(`/api/v1/competitions/${c.slug}`).set(auth(user));
    expect(details.body.viewer.isSaved).toBe(true);
    expect((await api().get(`/api/v1/competitions/${c.slug}`)).body.viewer.isSaved).toBe(false); // guest

    expect((await api().get('/api/v1/competitions?saved=true').set(auth(user))).body.competitions.map((x: { slug: string }) => x.slug)).toEqual([
      'saveable',
    ]);
    expect((await api().get('/api/v1/competitions?saved=true')).status).toBe(401);
    const list = await api().get('/api/v1/competitions').set(auth(user));
    expect(list.body.competitions.find((x: { slug: string }) => x.slug === 'saveable').isSaved).toBe(true);

    await api().delete(url).set(auth(user));
    await api().delete(url).set(auth(user)); // idempotent
    expect((await api().get('/api/v1/competitions?saved=true').set(auth(user))).body.competitions).toEqual([]);
  });

  it('cannot save a draft', async () => {
    const user = await createUser();
    const draft = await createCompetition(new Date(), { status: 'draft' });
    expect((await api().put(`/api/v1/competitions/${draft._id}/save`).set(auth(user))).status).toBe(404);
  });
});
