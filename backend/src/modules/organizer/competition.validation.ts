import { z } from 'zod';
import { CATEGORIES } from '../../lib/categories.js';

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(max).optional());

const localized = (max: number) => z.object({ en: text(max), hi: optionalText(max) });

/** Absolute http(s) URL, or a file uploaded to this API ("/uploads/..."). Empty → not set. */
const mediaRef = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => /^https?:\/\/\S+$/i.test(v) || /^\/uploads\/[\w./-]+$/.test(v), 'Must be a link (https://…) or an uploaded file')
    .optional(),
);

const paise = z.number().int().min(0).max(1_00_00_00_000); // up to ₹1 crore

export const timelineSchema = z
  .object({
    registrationOpensAt: z.coerce.date(),
    registrationClosesAt: z.coerce.date(),
    submissionStartsAt: z.coerce.date(),
    submissionEndsAt: z.coerce.date(),
    resultAt: z.coerce.date(),
  })
  .superRefine((tl, ctx) => {
    const rule = (ok: boolean, path: keyof typeof tl, message: string) => {
      if (!ok) ctx.addIssue({ code: 'custom', path: [path], message });
    };
    rule(tl.registrationOpensAt < tl.registrationClosesAt, 'registrationClosesAt', 'Registration must close after it opens');
    rule(tl.submissionStartsAt < tl.submissionEndsAt, 'submissionEndsAt', 'Submissions must end after they start');
    rule(tl.registrationClosesAt <= tl.submissionEndsAt, 'submissionEndsAt', 'Submissions must stay open until registration closes');
    rule(tl.submissionEndsAt <= tl.resultAt, 'resultAt', 'Results must come after submissions end');
  });

const rewardsSchema = z
  .array(z.object({ position: z.number().int().min(1).max(50), amount: paise }))
  .min(1, 'Add at least one reward')
  .max(20)
  .refine((r) => r.map((x) => x.position).sort((a, b) => a - b).every((p, i) => p === i + 1), 'Reward positions must be 1, 2, 3… without gaps');

export const judgeSchema = z.object({
  name: text(80),
  title: localized(120),
  experienceYears: z.number().int().min(0).max(80).optional(),
  avatarUrl: mediaRef,
  introVideoUrl: mediaRef,
});

const judgingParametersSchema = z
  .array(z.object({ title: localized(80), weight: z.number().int().min(0).max(100).optional() }))
  .max(10)
  .refine((ps) => {
    const weighted = ps.filter((p) => p.weight !== undefined);
    return weighted.length === 0 || weighted.reduce((sum, p) => sum + (p.weight ?? 0), 0) === 100;
  }, 'Judging weights must add up to 100%');

const baseSchema = z.object({
  title: localized(120),
  category: z.enum(CATEGORIES),
  tags: z.array(localized(30)).max(6).default([]),
  isMultiWin: z.boolean().default(false),
  certificateForWinners: z.boolean().default(false),
  entryFee: paise,
  rewards: rewardsSchema,
  seatsTotal: z.number().int().min(1).max(100_000),
  timeline: timelineSchema,
  judge: judgeSchema,
  content: z.object({
    about: localized(4000),
    judgingParameters: judgingParametersSchema.default([]),
    rulesEligibility: z.array(localized(500)).max(20).default([]),
  }),
  disclaimer: localized(500).optional(),
  refundPolicyUrl: mediaRef,
  prizeInfoVideoUrl: mediaRef,
  coverImageUrl: mediaRef,
  referralRewardPerSignup: paise.default(0),
});

/** Create: every field of the details screen. The prize pool is derived from the rewards. */
export const createCompetitionSchema = baseSchema.extend({ publish: z.boolean().default(false) });

/** Edit: any subset; nested objects (timeline, judge, content) are replaced as a whole. */
export const updateCompetitionSchema = baseSchema.partial().refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;
export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>;
