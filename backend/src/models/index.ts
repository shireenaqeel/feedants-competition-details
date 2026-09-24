import type { Model } from 'mongoose';
import { CompetitionModel } from './competition.model.js';
import { CompetitionResultModel } from './competitionResult.model.js';
import { JudgeModel } from './judge.model.js';
import { PeerRatingModel } from './peerRating.model.js';
import { RatingModel } from './rating.model.js';
import { ReferralModel } from './referral.model.js';
import { SavedCompetitionModel } from './savedCompetition.model.js';
import { RegistrationModel } from './registration.model.js';
import { SubmissionModel } from './submission.model.js';
import { TestimonialModel } from './testimonial.model.js';
import { UserModel } from './user.model.js';

export const allModels: Model<any>[] = [
  CompetitionModel,
  CompetitionResultModel,
  JudgeModel,
  PeerRatingModel,
  RatingModel,
  ReferralModel,
  SavedCompetitionModel,
  RegistrationModel,
  SubmissionModel,
  TestimonialModel,
  UserModel,
];

/**
 * Creates collections and builds indexes. The unique indexes are part of the
 * correctness guarantees (no double registration), so the server waits for them before serving.
 */
export async function initModels(): Promise<void> {
  for (const m of allModels) {
    await m.createCollection();
    await m.syncIndexes();
  }
}
