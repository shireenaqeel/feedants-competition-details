import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { signToken } from '../src/middleware/auth.js';
import { CompetitionModel } from '../src/models/competition.model.js';
import { UserModel } from '../src/models/user.model.js';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export const api = () => supertest(createApp());

/** A published competition. By default registration and submissions are both open around `now`. */
export async function createCompetition(now: Date, overrides: Record<string, unknown> = {}) {
  const t = now.getTime();
  return CompetitionModel.create({
    slug: `comp-${Math.random().toString(36).slice(2, 10)}`,
    seriesId: 'series',
    status: 'published',
    title: { en: 'Test Competition', hi: 'परीक्षण प्रतियोगिता' },
    category: 'dance',
    entryFee: 9900,
    prizePool: 1000,
    rewards: [
      { position: 1, amount: 600 },
      { position: 2, amount: 400 },
    ],
    seats: { total: 20, confirmed: 0, held: 0 },
    timeline: {
      registrationOpensAt: new Date(t - DAY),
      registrationClosesAt: new Date(t + DAY),
      submissionStartsAt: new Date(t - HOUR),
      submissionEndsAt: new Date(t + 5 * DAY),
      resultAt: new Date(t + 7 * DAY),
    },
    content: { about: { en: 'About' } },
    ...overrides,
  });
}

let phoneCounter = 0;
export async function createUser(name = 'User') {
  phoneCounter++;
  return UserModel.create({ name, phone: `8${String(phoneCounter).padStart(9, '0')}` });
}

export async function createUsers(n: number) {
  return Promise.all(Array.from({ length: n }, (_, i) => createUser(`User ${i}`)));
}

export const auth = (user: { _id: unknown }) => ({ Authorization: `Bearer ${signToken(String(user._id))}` });

/** A complete, valid body for POST /competitions (amounts in paise). */
export function competitionPayload(now: Date, overrides: Record<string, unknown> = {}) {
  const t = now.getTime();
  return {
    title: { en: 'Summer Singing Cup', hi: 'ग्रीष्म गायन कप' },
    category: 'singing',
    tags: [{ en: 'Singing' }],
    isMultiWin: true,
    certificateForWinners: true,
    entryFee: 4900,
    rewards: [
      { position: 1, amount: 50000 },
      { position: 2, amount: 30000 },
      { position: 3, amount: 20000 },
    ],
    seatsTotal: 50,
    timeline: {
      registrationOpensAt: new Date(t - HOUR).toISOString(),
      registrationClosesAt: new Date(t + 5 * DAY).toISOString(),
      submissionStartsAt: new Date(t + DAY).toISOString(),
      submissionEndsAt: new Date(t + 10 * DAY).toISOString(),
      resultAt: new Date(t + 12 * DAY).toISOString(),
    },
    judge: { name: 'A. R. Judge', title: { en: 'Playback Singer' }, experienceYears: 10 },
    content: {
      about: { en: 'Sing your favourite song.' },
      judgingParameters: [
        { title: { en: 'Pitch' }, weight: 60 },
        { title: { en: 'Expression' }, weight: 40 },
      ],
      rulesEligibility: [{ en: 'Solo only' }],
    },
    disclaimer: { en: 'Only paid participants are judged.' },
    referralRewardPerSignup: 1000,
    ...overrides,
  };
}
