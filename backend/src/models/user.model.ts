import { randomBytes } from 'node:crypto';
import { model, Schema, type InferSchemaType } from 'mongoose';

export function generateReferralCode(): string {
  return randomBytes(5).toString('hex'); // 10 chars, e.g. "9f2c1a7b3e"
}

const ratingTotalsSchema = new Schema(
  {
    count: { type: Number, default: 0, min: 0 },
    sum: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    avatarUrl: { type: String },
    bio: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 60 },
    language: { type: String, enum: ['en', 'hi'], default: 'en' },
    referralCode: { type: String, required: true, unique: true, default: generateReferralCode },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    // Ratings participants gave this user as an organizer.
    organizerRating: { type: ratingTotalsSchema, default: () => ({}) },
    // Sportsmanship ratings from fellow participants after competitions end.
    sportsmanship: { type: ratingTotalsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
