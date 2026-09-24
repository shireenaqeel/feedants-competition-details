import { model, Schema, type InferSchemaType } from 'mongoose';
import { localizedSchema } from './localized.js';

const judgeSchema = new Schema(
  {
    name: { type: String, required: true },
    title: { type: localizedSchema, required: true },
    experienceYears: { type: Number, min: 0 },
    avatarUrl: { type: String },
    introVideoUrl: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export type Judge = InferSchemaType<typeof judgeSchema>;
export const JudgeModel = model('Judge', judgeSchema);
