import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { CATEGORIES } from '../lib/categories.js';
import { localizedSchema } from './localized.js';

export const COMPETITION_STATUSES = ['draft', 'published', 'cancelled'] as const;

const rewardSchema = new Schema(
  {
    position: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 }, // paise
  },
  { _id: false },
);

const judgingParameterSchema = new Schema(
  {
    title: { type: localizedSchema, required: true },
    weight: { type: Number, min: 0, max: 100 },
  },
  { _id: false },
);

const seatsSchema = new Schema(
  {
    total: { type: Number, required: true, min: 1 },
    confirmed: { type: Number, default: 0, min: 0 },
    held: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const timelineSchema = new Schema(
  {
    registrationOpensAt: { type: Date, required: true },
    registrationClosesAt: { type: Date, required: true },
    submissionStartsAt: { type: Date, required: true },
    submissionEndsAt: { type: Date, required: true },
    resultAt: { type: Date, required: true },
  },
  { _id: false },
);

const ratingTotalsSchema = new Schema(
  {
    count: { type: Number, default: 0, min: 0 },
    sum: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const isInteger = { validator: Number.isInteger, message: '{PATH} must be an integer (paise)' };

const competitionSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    seriesId: { type: String, required: true, index: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    status: { type: String, enum: COMPETITION_STATUSES, default: 'draft', required: true },

    title: { type: localizedSchema, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    tags: { type: [localizedSchema], default: [] },
    isMultiWin: { type: Boolean, default: false },
    certificateForWinners: { type: Boolean, default: false },

    currency: { type: String, default: 'INR' },
    entryFee: { type: Number, required: true, min: 0, validate: isInteger },
    prizePool: { type: Number, required: true, min: 0, validate: isInteger },
    rewards: { type: [rewardSchema], default: [] },

    seats: { type: seatsSchema, required: true },
    timeline: { type: timelineSchema, required: true },

    judgeIds: [{ type: Schema.Types.ObjectId, ref: 'Judge' }],
    content: {
      about: { type: localizedSchema, required: true },
      judgingParameters: { type: [judgingParameterSchema], default: [] },
      rulesEligibility: { type: [localizedSchema], default: [] },
    },
    disclaimer: { type: localizedSchema },
    refundPolicyUrl: { type: String },
    media: {
      coverImageUrl: { type: String },
      prizeInfoVideoUrl: { type: String },
    },
    referralRewardPerSignup: { type: Number, default: 0, min: 0 },
    rating: { type: ratingTotalsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

// Browse filters: public listings always filter on status, then category / date / prize.
competitionSchema.index({ status: 1, 'timeline.registrationClosesAt': 1 });
competitionSchema.index({ status: 1, category: 1, 'timeline.registrationClosesAt': 1 });
competitionSchema.index({ status: 1, prizePool: -1 });
competitionSchema.index({ status: 1, createdAt: -1 });

// Cross-field business invariants. Seat counters are enforced atomically at booking time;
// this guards documents created or edited through the model (seed, admin tools).
competitionSchema.pre('validate', function () {
  const tl = this.timeline;
  const problems: string[] = [];
  if (tl) {
    if (!(tl.registrationOpensAt < tl.registrationClosesAt)) problems.push('registration must open before it closes');
    if (!(tl.registrationClosesAt <= tl.submissionEndsAt)) problems.push('registration must close before submissions end');
    if (!(tl.submissionStartsAt < tl.submissionEndsAt)) problems.push('submissions must start before they end');
    if (!(tl.submissionEndsAt <= tl.resultAt)) problems.push('results must come after submissions end');
  }

  const positions = this.rewards.map((r) => r.position).sort((a, b) => a - b);
  if (positions.some((p, i) => p !== i + 1)) problems.push('reward positions must be 1..n without gaps');
  const rewardTotal = this.rewards.reduce((sum, r) => sum + r.amount, 0);
  if (this.rewards.length && rewardTotal !== this.prizePool) {
    problems.push(`rewards add up to ${rewardTotal}, but prize pool is ${this.prizePool}`);
  }

  if (this.seats && this.seats.confirmed + this.seats.held > this.seats.total) {
    problems.push('booked seats exceed total seats');
  }

  if (problems.length) this.invalidate('competition', problems.join('; '));
});

export type Competition = InferSchemaType<typeof competitionSchema>;
export type CompetitionDoc = HydratedDocument<Competition>;
export const CompetitionModel = model('Competition', competitionSchema);
