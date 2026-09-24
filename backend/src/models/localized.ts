import { Schema } from 'mongoose';

export const localizedSchema = new Schema(
  {
    en: { type: String, required: true, trim: true },
    hi: { type: String, trim: true },
  },
  { _id: false },
);
