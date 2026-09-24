import { model, Schema, type InferSchemaType } from 'mongoose';

const competitionResultSchema = new Schema(
  {
    // Empty for results imported from editions that predate the platform (only `edition` is known).
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition' },
    edition: { type: String },
    seriesId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
    position: { type: Number, required: true, min: 1 },
    videoUrl: { type: String },
    awardedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// "Previous winners" of a series: best positions first, most recent edition first.
competitionResultSchema.index({ seriesId: 1, position: 1, awardedAt: -1 });
competitionResultSchema.index({ competitionId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });

export type CompetitionResult = InferSchemaType<typeof competitionResultSchema>;
export const CompetitionResultModel = model('CompetitionResult', competitionResultSchema);
