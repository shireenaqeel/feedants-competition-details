import { model, Schema, type InferSchemaType } from 'mongoose';

/** A participant rating another participant's sportsmanship, once per competition. */
const peerRatingSchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    raterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rateeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stars: { type: Number, required: true, min: 1, max: 5, validate: { validator: Number.isInteger, message: 'Stars must be a whole number' } },
  },
  { timestamps: true },
);

peerRatingSchema.index({ competitionId: 1, raterId: 1, rateeId: 1 }, { unique: true });
peerRatingSchema.index({ rateeId: 1 });

export type PeerRating = InferSchemaType<typeof peerRatingSchema>;
export const PeerRatingModel = model('PeerRating', peerRatingSchema);
