import { model, Schema, type InferSchemaType } from 'mongoose';

const mediaSchema = new Schema(
  {
    storageKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { _id: false },
);

const submissionSchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    registrationId: { type: Schema.Types.ObjectId, ref: 'Registration', required: true },
    media: { type: mediaSchema, required: true },
    caption: { type: String, maxlength: 500 },
    status: { type: String, enum: ['submitted', 'withdrawn'], default: 'submitted' },
    version: { type: Number, default: 1 },
    submittedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

submissionSchema.index({ competitionId: 1, userId: 1 }, { unique: true });

export type Submission = InferSchemaType<typeof submissionSchema>;
export const SubmissionModel = model('Submission', submissionSchema);
