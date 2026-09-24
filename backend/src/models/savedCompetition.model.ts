import { model, Schema, type InferSchemaType } from 'mongoose';

/** A user's bookmark on a competition. */
const savedCompetitionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One bookmark per user and competition; also serves "my saved competitions, newest first".
savedCompetitionSchema.index({ userId: 1, competitionId: 1 }, { unique: true });
savedCompetitionSchema.index({ userId: 1, createdAt: -1 });

export type SavedCompetition = InferSchemaType<typeof savedCompetitionSchema>;
export const SavedCompetitionModel = model('SavedCompetition', savedCompetitionSchema);
