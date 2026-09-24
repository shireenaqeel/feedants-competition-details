import mongoose, { type ClientSession, type HydratedDocument } from 'mongoose';
import { env } from '../../config/env.js';
import { clock } from '../../lib/clock.js';
import { AppError, Errors } from '../../lib/errors.js';
import { CompetitionModel } from '../../models/competition.model.js';
import { RegistrationModel, REUSABLE_STATUSES, type Registration } from '../../models/registration.model.js';
import { paymentProvider, type PaymentOrder } from '../payments/provider.js';

type RegistrationDoc = HydratedDocument<Registration>;

export interface RegistrationResult {
  registration: RegistrationDoc;
  payment: PaymentOrder | null;
  created: boolean;
}

// ---------------------------------------------------------------------------
// Seat counters. Every change goes through a single atomic, conditional update on the
// competition document. That update is what prevents overselling.

async function reserveSeat(
  competitionId: unknown,
  kind: 'held' | 'confirmed',
  now: Date,
  session: ClientSession,
  { requireRegistrationOpen }: { requireRegistrationOpen: boolean },
): Promise<boolean> {
  const res = await CompetitionModel.updateOne(
    {
      _id: competitionId,
      status: 'published',
      ...(requireRegistrationOpen && {
        'timeline.registrationOpensAt': { $lte: now },
        'timeline.registrationClosesAt': { $gt: now },
      }),
      $expr: { $lt: [{ $add: ['$seats.confirmed', '$seats.held'] }, '$seats.total'] },
    },
    { $inc: { [`seats.${kind}`]: 1 } },
    { session },
  );
  return res.modifiedCount === 1;
}

async function releaseHeldSeat(competitionId: unknown, session: ClientSession, convertToConfirmed = false) {
  const res = await CompetitionModel.updateOne(
    { _id: competitionId, 'seats.held': { $gt: 0 } },
    { $inc: convertToConfirmed ? { 'seats.held': -1, 'seats.confirmed': 1 } : { 'seats.held': -1 } },
    { session },
  );
  if (res.modifiedCount !== 1) throw new Error(`Seat counter out of sync for competition ${String(competitionId)}`);
}

/** Called when the conditional reservation matched nothing: works out why and throws the matching error. */
async function throwReservationFailure(competitionId: unknown, now: Date, session: ClientSession): Promise<never> {
  const c = await CompetitionModel.findById(competitionId, { status: 1, timeline: 1 }).session(session).lean();
  if (!c || c.status === 'draft') throw Errors.notFound('Competition');
  if (c.status === 'cancelled') throw new AppError(409, 'COMPETITION_CANCELLED', 'This competition has been cancelled');
  if (now < c.timeline.registrationOpensAt) throw new AppError(409, 'REGISTRATION_NOT_OPEN', 'Registration has not opened yet');
  if (now >= c.timeline.registrationClosesAt) throw new AppError(409, 'REGISTRATION_CLOSED', 'Registration is closed');
  throw new AppError(409, 'COMPETITION_FULL', 'No spots left');
}

// ---------------------------------------------------------------------------

function toOrder(reg: RegistrationDoc): PaymentOrder | null {
  if (reg.status !== 'pending_payment' || !reg.payment?.orderId) return null;
  return {
    provider: reg.payment.provider ?? paymentProvider.name,
    orderId: reg.payment.orderId,
    amount: reg.amount,
    currency: reg.currency ?? 'INR',
    keyId: env.payment.keyId,
  };
}

/** Creates the payment order for a pending registration (once, even if called concurrently). */
async function ensurePaymentOrder(reg: RegistrationDoc): Promise<RegistrationDoc> {
  if (reg.status !== 'pending_payment' || reg.payment?.orderId) return reg;

  let order: PaymentOrder;
  try {
    order = await paymentProvider.createOrder({ amount: reg.amount, currency: reg.currency ?? 'INR', receipt: String(reg._id) });
  } catch (err) {
    // Don't keep a spot held for a payment that can never start.
    await cancelHold(String(reg._id), String(reg.userId)).catch(() => undefined);
    throw err;
  }

  const updated = await RegistrationModel.findOneAndUpdate(
    { _id: reg._id, status: 'pending_payment', 'payment.orderId': { $exists: false } },
    { $set: { payment: { provider: order.provider, orderId: order.orderId } } },
    { returnDocument: 'after' },
  );
  // Another request attached an order first: use that one.
  return updated ?? (await RegistrationModel.findById(reg._id).orFail());
}

/**
 * Holds a spot for the user and starts payment. Idempotent per (competition, user):
 * repeated or concurrent calls return the same registration.
 */
export async function registerForCompetition(competitionId: string, userId: string): Promise<RegistrationResult> {
  const now = clock.now();
  let registration!: RegistrationDoc;
  let created = false;

  await mongoose.connection.transaction(async (session) => {
    created = false;
    const competition = await CompetitionModel.findById(competitionId, { status: 1, entryFee: 1, currency: 1, organizerId: 1 }).session(session);
    if (!competition || competition.status === 'draft') throw Errors.notFound('Competition');
    if (competition.organizerId && String(competition.organizerId) === userId) {
      throw new AppError(409, 'IS_ORGANIZER', 'Organizers cannot register for their own competition');
    }

    const existing = await RegistrationModel.findOne({ competitionId, userId }).session(session);

    if (existing) {
      const holdActive = existing.status === 'pending_payment' && existing.holdExpiresAt && existing.holdExpiresAt > now;
      if (holdActive || existing.status === 'confirmed' || existing.status === 'refund_required') {
        registration = existing;
        return;
      }
      // A hold that expired but hasn't been cleaned up yet: give its seat back before re-reserving.
      if (existing.status === 'pending_payment') await releaseHeldSeat(competitionId, session);
      else if (!REUSABLE_STATUSES.includes(existing.status)) throw new AppError(409, 'ALREADY_REGISTERED', 'Already registered');
    }

    const isFree = competition.entryFee === 0;
    const fields = {
      status: isFree ? 'confirmed' : 'pending_payment',
      amount: competition.entryFee,
      currency: competition.currency ?? 'INR',
      holdExpiresAt: isFree ? undefined : new Date(now.getTime() + env.holdMinutes * 60_000),
      confirmedAt: isFree ? now : undefined,
      payment: undefined,
    } as const;

    // Write the registration first and the hot competition document last, to keep the write-conflict window short.
    if (existing) {
      existing.set(fields);
      registration = await existing.save({ session });
    } else {
      [registration] = await RegistrationModel.create([{ competitionId, userId, ...fields }], { session });
    }

    const reserved = await reserveSeat(competitionId, isFree ? 'confirmed' : 'held', now, session, { requireRegistrationOpen: true });
    if (!reserved) await throwReservationFailure(competitionId, now, session);
    created = true;
  });

  registration = await ensurePaymentOrder(registration);
  return { registration, payment: toOrder(registration), created };
}

/**
 * Marks the order paid and confirms the seat. Idempotent: the app's verify call and the
 * provider webhook may both arrive, in any order.
 */
export async function confirmPaidOrder(orderId: string, paymentId: string): Promise<RegistrationDoc> {
  const now = clock.now();
  let registration!: RegistrationDoc;

  await mongoose.connection.transaction(async (session) => {
    const reg = await RegistrationModel.findOne({ 'payment.orderId': orderId }).session(session);
    if (!reg) throw Errors.notFound('Registration');
    registration = reg;
    if (reg.status === 'confirmed' || reg.status === 'refund_required' || reg.status === 'refunded') return;

    if (reg.status === 'pending_payment') {
      // The seat is still held (even if the hold just lapsed and the sweeper hasn't run yet).
      await releaseHeldSeat(reg.competitionId, session, true);
      reg.status = 'confirmed';
    } else {
      // The hold was released (expired / cancelled) before payment arrived. Take a seat if one
      // is free; otherwise the payment must be refunded.
      const reserved = await reserveSeat(reg.competitionId, 'confirmed', now, session, { requireRegistrationOpen: false });
      reg.status = reserved ? 'confirmed' : 'refund_required';
    }

    reg.payment!.paymentId = paymentId;
    reg.payment!.verifiedAt = now;
    reg.holdExpiresAt = undefined;
    if (reg.status === 'confirmed') reg.confirmedAt = now;
    registration = await reg.save({ session });
  });

  return registration;
}

export async function verifyPayment(
  registrationId: string,
  userId: string,
  input: { orderId: string; paymentId: string; signature: string },
): Promise<RegistrationDoc> {
  const reg = await RegistrationModel.findById(registrationId);
  if (!reg) throw Errors.notFound('Registration');
  if (String(reg.userId) !== userId) throw Errors.forbidden();
  if (reg.payment?.orderId !== input.orderId) throw new AppError(400, 'ORDER_MISMATCH', 'Order does not belong to this registration');
  if (!paymentProvider.verifyPaymentSignature(input)) {
    throw new AppError(400, 'PAYMENT_VERIFICATION_FAILED', 'Payment signature is invalid');
  }
  return confirmPaidOrder(input.orderId, input.paymentId);
}

/** User abandons checkout: release the held seat right away. */
export async function cancelHold(registrationId: string, userId: string): Promise<RegistrationDoc> {
  let registration!: RegistrationDoc;
  await mongoose.connection.transaction(async (session) => {
    const reg = await RegistrationModel.findById(registrationId).session(session);
    if (!reg) throw Errors.notFound('Registration');
    if (String(reg.userId) !== userId) throw Errors.forbidden();
    if (reg.status !== 'pending_payment') {
      throw new AppError(409, 'NOT_CANCELLABLE', 'Only a registration awaiting payment can be cancelled');
    }
    await releaseHeldSeat(reg.competitionId, session);
    reg.status = 'cancelled';
    reg.holdExpiresAt = undefined;
    registration = await reg.save({ session });
  });
  return registration;
}

/**
 * Releases seats held by payments that were never completed. Safe to run on several
 * instances at once: each hold moves pending → expired exactly once.
 */
export async function expireStaleHolds(now = clock.now(), batchSize = 200): Promise<number> {
  const stale = await RegistrationModel.find(
    { status: 'pending_payment', holdExpiresAt: { $lte: now } },
    { _id: 1, competitionId: 1 },
  )
    .limit(batchSize)
    .lean();

  let expired = 0;
  for (const { _id, competitionId } of stale) {
    await mongoose.connection.transaction(async (session) => {
      const res = await RegistrationModel.updateOne(
        { _id, status: 'pending_payment', holdExpiresAt: { $lte: now } },
        { $set: { status: 'expired' }, $unset: { holdExpiresAt: 1 } },
        { session },
      );
      if (res.modifiedCount === 1) {
        await releaseHeldSeat(competitionId, session);
        expired++;
      }
    });
  }
  return expired;
}

export function serializeRegistration(reg: RegistrationDoc | Registration & { _id: unknown }) {
  return {
    id: String(reg._id),
    competitionId: String(reg.competitionId),
    status: reg.status,
    amount: reg.amount,
    currency: reg.currency,
    holdExpiresAt: reg.holdExpiresAt ?? null,
    confirmedAt: reg.confirmedAt ?? null,
  };
}
