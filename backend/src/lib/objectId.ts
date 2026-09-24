import { Types } from 'mongoose';
import { z } from 'zod';

export const isObjectId = (value: string) => Types.ObjectId.isValid(value) && /^[a-f\d]{24}$/i.test(value);

export const objectIdSchema = z.string().refine(isObjectId, 'Invalid id');
