import { describe, expect, it } from 'vitest';
import { clock } from '../src/lib/clock.js';
import { CompetitionModel } from '../src/models/competition.model.js';
import { RegistrationModel } from '../src/models/registration.model.js';
import { SubmissionModel } from '../src/models/submission.model.js';
import { UserModel } from '../src/models/user.model.js';
import { api, auth, createCompetition, createUser, createUsers, DAY, HOUR } from './helpers.js';

/** A competition that ended an hour ago (results announced), with confirmed participants. */
async function finishedCompetition(participants: { _id: unknown }[], organizer?: { _id: unknown }) {
  const now = Date.now();
  const c = await createCompetition(new Date(), {
    organizerId: organizer?._id,
    timeline: {
      registrationOpensAt: new Date(now - 20 * DAY),
      registrationClosesAt: new Date(now - 10 * DAY),
      submissionStartsAt: new Date(now - 15 * DAY),
      submissionEndsAt: new Date(now - DAY),
      resultAt: new Date(now - HOUR),
    },
    seats: { total: 20, confirmed: participants.length, held: 0 },
  });
  const regs = await RegistrationModel.insertMany(
    participants.map((p) => ({ competitionId: c._id, userId: p._id, status: 'confirmed', amount: 9900 })),
  );
  return { c, regs };
}

describe('rating competitions and organizers', () => {
  it('participants rate once the competition has ended; totals stay exact across edits and concurrent requests', async () => {
    const organizer = await createUser('Org');
    const [a, b] = await createUsers(2);
    const { c } = await finishedCompetition([a, b], organizer);
    const url = `/api/v1/competitions/${c._id}/ratings/me`;

    await Promise.all([
      api().put(url).set(auth(a)).send({ competitionStars: 4, organizerStars: 5, comment: 'Great' }),
      api().put(url).set(auth(a)).send({ competitionStars: 4, organizerStars: 5, comment: 'Great' }),
      api().put(url).set(auth(b)).send({ competitionStars: 2, organizerStars: 3 }),
    ]);
    await api().put(url).set(auth(a)).send({ competitionStars: 5, organizerStars: 5 }); // edit

    expect((await CompetitionModel.findById(c._id).lean())!.rating).toEqual({ count: 2, sum: 7 });
    expect((await UserModel.findById(organizer._id).lean())!.organizerRating).toEqual({ count: 2, sum: 8 });

    const list = await api().get(`/api/v1/competitions/${c._id}/ratings`);
    expect(list.body.summary).toEqual({ average: 3.5, count: 2 });
    const details = await api().get(`/api/v1/competitions/${c._id}`).set(auth(a));
    expect(details.body.viewer.myRating).toMatchObject({ competitionStars: 5, organizerStars: 5, comment: null });
    expect(details.body.competition.organizer).toMatchObject({ name: 'Org', rating: { average: 4, count: 2 } });
  });

  it('refuses non-participants, organizers, and ratings before the competition ends', async () => {
    const organizer = await createUser();
    const [participant, outsider] = await createUsers(2);
    const { c } = await finishedCompetition([participant], organizer);
    const body = { competitionStars: 5, organizerStars: 5 };

    expect((await api().put(`/api/v1/competitions/${c._id}/ratings/me`).set(auth(outsider)).send(body)).body.error.code).toBe('NOT_PARTICIPANT');
    expect((await api().put(`/api/v1/competitions/${c._id}/ratings/me`).set(auth(organizer)).send(body)).body.error.code).toBe('IS_ORGANIZER');
    expect((await api().put(`/api/v1/competitions/${c._id}/ratings/me`).set(auth(participant)).send({ competitionStars: 6, organizerStars: 1 })).status).toBe(400);

    // Submissions closed but results not announced yet: still too early.
    clock.set(new Date(Date.now() - 2 * HOUR));
    expect((await api().put(`/api/v1/competitions/${c._id}/ratings/me`).set(auth(participant)).send(body)).body.error.code).toBe('RATING_NOT_OPEN');
    const [fellow] = await createUsers(1);
    await RegistrationModel.create({ competitionId: c._id, userId: fellow._id, status: 'confirmed', amount: 9900 });
    const peer = await api().put(`/api/v1/competitions/${c._id}/participants/${fellow._id}/sportsmanship`).set(auth(participant)).send({ stars: 5 });
    expect(peer.body.error.code).toBe('RATING_NOT_OPEN');
  });
});

describe('sportsmanship (participants rating each other)', () => {
  it('fellow participants rate each other once per competition; edits adjust the total', async () => {
    const [a, b, c2] = await createUsers(3);
    const { c } = await finishedCompetition([a, b, c2]);

    const fellows = await api().get(`/api/v1/competitions/${c._id}/participants`).set(auth(a));
    expect(fellows.body.participants.map((p: { id: string }) => p.id).sort()).toEqual([String(b._id), String(c2._id)].sort());

    const rate = (from: { _id: unknown }, to: { _id: unknown }, stars: number) =>
      api().put(`/api/v1/competitions/${c._id}/participants/${to._id}/sportsmanship`).set(auth(from)).send({ stars });
    await rate(a, b, 5);
    await rate(c2, b, 3);
    await rate(a, b, 4); // edit
    expect((await UserModel.findById(b._id).lean())!.sportsmanship).toEqual({ count: 2, sum: 7 });

    expect((await rate(a, a, 5)).body.error.code).toBe('CANNOT_RATE_SELF');
    const outsider = await createUser();
    expect((await rate(outsider, b, 5)).body.error.code).toBe('NOT_PARTICIPANT');
    expect((await rate(a, outsider, 5)).body.error.code).toBe('PARTICIPANT_NOT_FOUND');

    const again = await api().get(`/api/v1/competitions/${c._id}/participants`).set(auth(a));
    expect(again.body.participants.find((p: { id: string }) => p.id === String(b._id))).toMatchObject({ myStars: 4, sportsmanship: { average: 3.5, count: 2 } });
  });
});

describe('public profile', () => {
  it('shows participation (with no-shows), sportsmanship, and organized competitions by stage', async () => {
    const organizer = await createUser('Organizer');
    const [showed, noShow] = await createUsers(2);
    const { c, regs } = await finishedCompetition([showed, noShow], organizer);
    await SubmissionModel.create({
      competitionId: c._id,
      userId: showed._id,
      registrationId: regs[0]._id,
      media: { storageKey: 'x.mp4', mimeType: 'video/mp4', sizeBytes: 1 },
      submittedAt: new Date(),
    });
    await createCompetition(new Date(), { organizerId: organizer._id, status: 'draft' }); // private

    const a = await api().get(`/api/v1/users/${showed._id}/public`);
    expect(a.body.stats).toMatchObject({ registered: 1, submitted: 1, noShows: 0 });
    const b = await api().get(`/api/v1/users/${noShow._id}/public`);
    expect(b.body.stats).toMatchObject({ registered: 1, submitted: 0, noShows: 1 });
    expect(b.body.participated).toHaveLength(1);

    const org = await api().get(`/api/v1/users/${organizer._id}/public`);
    expect(org.body.stats.organized).toBe(1); // drafts are not public
    expect(org.body.organized[0].lifecycle.stage).toBe('past');
    expect(org.body.user).not.toHaveProperty('phone');
  });
});
