import { model, Schema, type InferSchemaType } from 'mongoose';
import { localizedSchema } from './localized.js';

const testimonialSchema = new Schema(
  {
    userName: { type: String, required: true },
    avatarUrl: { type: String },
    text: { type: localizedSchema, required: true },
    rating: { type: Number, min: 1, max: 5 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

testimonialSchema.index({ isPublished: 1, createdAt: -1 });

export type Testimonial = InferSchemaType<typeof testimonialSchema>;
export const TestimonialModel = model('Testimonial', testimonialSchema);
