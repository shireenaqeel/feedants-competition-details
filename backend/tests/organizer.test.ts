import { describe, expect, it } from 'vitest';
import { CompetitionModel } from '../src/models/competition.model.js';
import { RegistrationModel } from '../src/models/registration.model.js';
import { signPayment } from '../src/modules/payments/provider.js';
import { api, auth, competitionPayload, createUser, createUsers, DAY } from './helpers.js';

async function create(user: { _id: unknown }, overrides: Record<string, unknown> = {}) {
  return api().post('/api/v1/competitions').set(auth(user)).send(competitionPayload(new Date(), overrides));
}

async function registerAndPay(competitionId: string, user: { _id: unknown }) {
  const reg = await api().post(`/api/v1/competitions/${competitionId}/registrations`).set(auth(user));
  const { orderId } = reg.body.payment;
  await api()
    .post(`/api/v1/registrations/${reg.body.registration.id}/payment/verify`)
    .set(auth(user))
    .send({ orderId, paymentId: 'pay_x', signature: signPayment(orderId, 'pay_x') });
}

describe('creating competitions', () => {
  it('creates a draft with every field from the screen; prize pool is derived from the rewards', async () => {
    const organizer = await createUser();
    const res = await create(organizer, { prizePool: 1 }); // a client-sent prize pool is ignored
    expect(res.status).toBe(201);
    expect(res.body.competition.status).toBe('draft');

    const doc = await CompetitionModel.findById(res.body.competition.id).lean();
    expect(doc).toMatchObject({ prizePool: 100000, category: 'singing', seats: { total: 50, confirmed: 0, held: 0 } });
    expect(String(doc!.organizerId)).toBe(String(organizer._id));
    expect(doc!.judgeIds).toHaveLength(1);
  });

  it('drafts are hidden from everyone except the organizer', async () => {
    const [organizer, other] = await createUsers(2);
    const { body } = await create(organizer);
    const id = body.competition.id;

    expect((await api().get(`/api/v1/competitions/${id}`).set(auth(other))).status).toBe(404);
    expect((await api().get('/api/v1/competitions')).body.competitions).toHaveLength(0);

    const own = await api().get(`/api/v1/competitions/${id}`).set(auth(organizer));
    expect(own.status).toBe(200);
    expect(own.body.viewer.state).toBe('organizer');
    expect(own.body.actions.register.reason).toBe('IS_ORGANIZER');
  });

  it('publishing makes it public; organizers cannot register for their own competition', async () => {
    const organizer = await createUser();
    const { body } = await create(organizer);
    const pub = await api().post(`/api/v1/competitions/${body.competition.id}/publish`).set(auth(organizer));
    expect(pub.body.competition.status).toBe('published');
    expect((await api().get('/api/v1/competitions')).body.competitions).toHaveLength(1);

    const reg = await api().post(`/api/v1/competitions/${body.competition.id}/registrations`).set(auth(organizer));
    expect(reg.status).toBe(409);
    expect(reg.body.error.code).toBe('IS_ORGANIZER');
  });

  it.each([
    ['missing title', { title: undefined }, 'title'],
    ['reward positions with a gap', { rewards: [{ position: 1, amount: 100 }, { position: 3, amount: 50 }] }, 'rewards'],
    ['judging weights not adding up to 100', { content: { about: { en: 'x' }, judgingParameters: [{ title: { en: 'A' }, weight: 50 }] } }, 'content.judgingParameters'],
    ['unknown category', { category: 'cooking' }, 'category'],
    ['negative fee', { entryFee: -1 }, 'entryFee'],
    ['bad link', { refundPolicyUrl: 'javascript:alert(1)' }, 'refundPolicyUrl'],
  ])('rejects %s', async (_label, overrides, path) => {
    const res = await create(await createUser(), overrides);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
  });

  it('rejects dates out of order, pointing at the offending field', async () => {
    const now = Date.now();
    const res = await create(await createUser(), {
      timeline: {
        registrationOpensAt: new Date(now).toISOString(),
        registrationClosesAt: new Date(now + 5 * DAY).toISOString(),
        submissionStartsAt: new Date(now + DAY).toISOString(),
        submissionEndsAt: new Date(now + 10 * DAY).toISOString(),
        resultAt: new Date(now + 9 * DAY).toISOString(),
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({ path: 'timeline.resultAt', message: 'Results must come after submissions end' });
  });

  it('cannot publish a competition whose registration already closed', async () => {
    const now = Date.now();
    const res = await create(await createUser(), {
      publish: true,
      timeline: {
        registrationOpensAt: new Date(now - 3 * DAY).toISOString(),
        registrationClosesAt: new Date(now - DAY).toISOString(),
        submissionStartsAt: new Date(now - 2 * DAY).toISOString(),
        submissionEndsAt: new Date(now + 10 * DAY).toISOString(),
        resultAt: new Date(now + 12 * DAY).toISOString(),
      },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TIMELINE_IN_PAST');
  });
});

describe('editing competitions', () => {
  it('only the organizer can edit', async () => {
    const [organizer, other] = await createUsers(2);
    const { body } = await create(organizer);
    const url = `/api/v1/competitions/${body.competition.id}`;
    expect((await api().patch(url).send({ seatsTotal: 10 })).status).toBe(401);
    expect((await api().patch(url).set(auth(other)).send({ seatsTotal: 10 })).status).toBe(403);
    expect((await api().patch(url).set(auth(organizer)).send({ seatsTotal: 10 })).status).toBe(200);
  });

  it('updates fields and recomputes the prize pool', async () => {
    const organizer = await createUser();
    const { body } = await create(organizer);
    const res = await api()
      .patch(`/api/v1/competitions/${body.competition.id}`)
      .set(auth(organizer))
      .send({ title: { en: 'Monsoon Singing Cup' }, rewards: [{ position: 1, amount: 70000 }] });
    expect(res.status).toBe(200);
    const doc = await CompetitionModel.findById(body.competition.id).lean();
    expect(doc).toMatchObject({ title: { en: 'Monsoon Singing Cup' }, prizePool: 70000 });
  });

  it('total spots can never go below spots already taken; the fee is locked once people registered', async () => {
    const organizer = await createUser();
    const { body } = await create(organizer, { publish: true });
    const id = body.competition.id;
    const participants = await createUsers(3);
    for (const p of participants) await registerAndPay(id, p);

    const below = await api().patch(`/api/v1/competitions/${id}`).set(auth(organizer)).send({ seatsTotal: 2 });
    expect(below.status).toBe(409);
    expect(below.body.error.code).toBe('SEATS_BELOW_BOOKED');

    expect((await api().patch(`/api/v1/competitions/${id}`).set(auth(organizer)).send({ seatsTotal: 3 })).status).toBe(200);

    const fee = await api().patch(`/api/v1/competitions/${id}`).set(auth(organizer)).send({ entryFee: 9900 });
    expect(fee.body.error.code).toBe('ENTRY_FEE_LOCKED');
  });
});

describe('cancel and delete', () => {
  it('cancelling marks paid registrations for refund, cancels pending payments and blocks new registrations', async () => {
    const organizer = await createUser();
    const { body } = await create(organizer, { publish: true });
    const id = body.competition.id;
    const [paid, pending, late] = await createUsers(3);
    await registerAndPay(id, paid);
    await api().post(`/api/v1/competitions/${id}/registrations`).set(auth(pending));

    const res = await api().post(`/api/v1/competitions/${id}/cancel`).set(auth(organizer));
    expect(res.body).toMatchObject({ competition: { status: 'cancelled' }, refunds: 1 });
    expect(await RegistrationModel.find({ competitionId: id }).distinct('status')).toEqual(expect.arrayContaining(['refund_required', 'cancelled']));
    expect((await CompetitionModel.findById(id).lean())!.seats.held).toBe(0);

    const reg = await api().post(`/api/v1/competitions/${id}/registrations`).set(auth(late));
    expect(reg.body.error.code).toBe('COMPETITION_CANCELLED');
    expect((await api().patch(`/api/v1/competitions/${id}`).set(auth(organizer)).send({ seatsTotal: 99 })).status).toBe(409);
  });

  it('only drafts can be deleted', async () => {
    const organizer = await createUser();
    const draft = (await create(organizer)).body.competition.id;
    const live = (await create(organizer, { publish: true })).body.competition.id;
    expect((await api().delete(`/api/v1/competitions/${live}`).set(auth(organizer))).status).toBe(409);
    expect((await api().delete(`/api/v1/competitions/${draft}`).set(auth(organizer))).status).toBe(204);
    expect(await CompetitionModel.exists({ _id: draft })).toBeNull();
  });
});

describe('organizer dashboard', () => {
  it('lists my competitions (drafts included) with counts, and returns both languages for editing', async () => {
    const [organizer, other] = await createUsers(2);
    const draft = (await create(organizer)).body.competition.id;
    await create(organizer, { publish: true });
    await create(other, { publish: true });

    const mine = await api().get('/api/v1/organizer/competitions').set(auth(organizer));
    expect(mine.body.competitions).toHaveLength(2);
    expect(mine.body.competitions.map((c: { status: string }) => c.status).sort()).toEqual(['draft', 'published']);
    expect(mine.body.competitions[0]).toHaveProperty('submissions', 0);

    const editable = await api().get(`/api/v1/organizer/competitions/${draft}`).set(auth(organizer));
    expect(editable.body.competition).toMatchObject({ title: { en: 'Summer Singing Cup', hi: 'ग्रीष्म गायन कप' }, judge: { name: 'A. R. Judge' }, locks: { entryFee: false } });
    expect((await api().get(`/api/v1/organizer/competitions/${draft}`).set(auth(other))).status).toBe(403);
  });
});
