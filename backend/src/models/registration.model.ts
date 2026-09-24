import { model, Schema, type InferSchemaType } from 'mongoose';

export const REGISTRATION_STATUSES = [
  'pending_payment',
  'confirmed',
  'expired',
  'cancelled',
  'refund_required',
  'refunded',
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** Statuses from which the same user may register again (the document is reused). */
export const REUSABLE_STATUSES: RegistrationStatus[] = ['expired', 'cancelled', 'refunded'];

const registrationSchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: REGISTRATION_STATUSES, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    holdExpiresAt: { type: Date },
    payment: {
      provider: { type: String },
      orderId: { type: String },
      paymentId: { type: String },
      verifiedAt: { type: Date },
    },
    confirmedAt: { type: Date },
  },
  { timestamps: true },
);

// One registration per user per competition, even under concurrent requests.
registrationSchema.index({ competitionId: 1, userId: 1 }, { unique: true });
// Lets the expiry job find stale holds without scanning.
registrationSchema.index(
  { holdExpiresAt: 1 },
  { partialFilterExpression: { status: 'pending_payment' } },
);
// A payment order maps to exactly one registration (webhook + client verify are processed once).
registrationSchema.index(
  { 'payment.orderId': 1 },
  { unique: true, partialFilterExpression: { 'payment.orderId': { $type: 'string' } } },
);
registrationSchema.index({ userId: 1, createdAt: -1 });

export type Registration = InferSchemaType<typeof registrationSchema>;
export const RegistrationModel = model('Registration', registrationSchema);
