import { model, Schema, type InferSchemaType } from 'mongoose';

const referralSchema = new Schema(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    rewardAmount: { type: Number, required: true, min: 0 }, // paise
    status: { type: String, enum: ['pending', 'credited'], default: 'pending' },
  },
  { timestamps: true },
);

export type Referral = InferSchemaType<typeof referralSchema>;
export const ReferralModel = model('Referral', referralSchema);
