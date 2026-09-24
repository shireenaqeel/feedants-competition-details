import { model, Schema, type InferSchemaType } from 'mongoose';

const stars = { type: Number, required: true, min: 1, max: 5, validate: { validator: Number.isInteger, message: 'Stars must be a whole number' } };

/** One rating per participant per competition: the competition itself and its organizer. */
const ratingSchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    competitionStars: stars,
    organizerStars: stars,
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

ratingSchema.index({ competitionId: 1, userId: 1 }, { unique: true });
ratingSchema.index({ competitionId: 1, createdAt: -1 });
ratingSchema.index({ organizerId: 1, createdAt: -1 });

export type Rating = InferSchemaType<typeof ratingSchema>;
export const RatingModel = model('Rating', ratingSchema);
