import { describe, expect, it } from 'vitest';
import { loadDemoDataIfEmpty } from '../src/data/demoData.js';
import { CompetitionModel } from '../src/models/competition.model.js';
import { api, createCompetition } from './helpers.js';
import mongoose from 'mongoose';

describe('default competitions on an empty database', () => {
  it('loads the default mix once (even when several instances start together), with dates relative to now', async () => {
    await mongoose.connection.collection('meta').deleteMany({});
    const results = await Promise.all([loadDemoDataIfEmpty(), loadDemoDataIfEmpty(), loadDemoDataIfEmpty()]);
    expect(results.filter(Boolean)).toHaveLength(1);

    const stage = async (phase: string) =>
      (await api().get(`/api/v1/competitions?phase=${phase}`)).body.competitions.map((c: { slug: string }) => c.slug).sort();
    expect(await stage('ongoing')).toEqual(['feedants-classical-dance-2026', 'feedants-folk-dance-2026', 'street-photography-walk']);
    expect(await stage('upcoming')).toEqual(['feedants-semi-classical-2026', 'hindi-poetry-slam']);
    expect(await stage('past')).toEqual(['feedants-classical-dance-spring', 'monsoon-singing-showdown', 'standup-comedy-open-mic']);

    // The design screen is always mid-registration, whenever the data is loaded.
    const main = await api().get('/api/v1/competitions/feedants-classical-dance-2026');
    expect(main.body.lifecycle).toMatchObject({ phase: 'registration_open', urgency: true });
    const winners = await api().get('/api/v1/competitions/feedants-classical-dance-2026/previous-winners');
    expect(winners.body.winners.map((w: { name: string }) => w.name)).toEqual(['Riya Shah', 'Aarav Mehta', 'Neha Verma', 'Ishita Chopra']);
    await mongoose.connection.collection('meta').deleteMany({});
  });

  it('demo videos are served by the API itself (no third-party links), with range requests for mobile players', async () => {
    await mongoose.connection.collection('meta').deleteMany({});
    await loadDemoDataIfEmpty();
    const details = await api().get('/api/v1/competitions/feedants-classical-dance-2026');
    const urls = [details.body.competition.judges[0].introVideoUrl, details.body.competition.media.prizeInfoVideoUrl];
    for (const url of urls) {
      const path = new URL(url).pathname;
      expect(path).toMatch(/^\/static\/demo-videos\/.+\.mp4$/);
      const res = await api().get(path).set('Range', 'bytes=0-99');
      expect(res.status).toBe(206);
      expect(res.headers['content-type']).toBe('video/mp4');
    }
    await mongoose.connection.collection('meta').deleteMany({});
  });

  it('never touches a database that already has competitions', async () => {
    await mongoose.connection.collection('meta').deleteMany({});
    await createCompetition(new Date());
    expect(await loadDemoDataIfEmpty()).toBe(false);
    expect(await CompetitionModel.countDocuments()).toBe(1);
  });
});
