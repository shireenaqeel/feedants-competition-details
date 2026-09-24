import { t, type Lang } from '../../lib/i18n.js';
import { mediaUrl } from '../../lib/media.js';
import type { Competition } from '../../models/competition.model.js';
import type { Judge } from '../../models/judge.model.js';
import { spotsLeft } from './lifecycle.js';

type WithId<T> = T & { _id: unknown };

export function serializeSeats(seats: Competition['seats']) {
  return { total: seats.total, booked: seats.confirmed, held: seats.held, left: spotsLeft(seats) };
}

export function serializeJudge(j: WithId<Judge>, lang: Lang, baseUrl: string) {
  return {
    id: String(j._id),
    name: j.name,
    title: t(j.title, lang),
    experienceYears: j.experienceYears ?? null,
    avatarUrl: mediaUrl(j.avatarUrl, baseUrl),
    introVideoUrl: mediaUrl(j.introVideoUrl, baseUrl),
  };
}

export function serializeCompetition(c: WithId<Competition>, judges: WithId<Judge>[], lang: Lang, baseUrl: string) {
  // Keep the judge order defined on the competition.
  const judgeById = new Map(judges.map((j) => [String(j._id), j]));
  return {
    id: String(c._id),
    slug: c.slug,
    status: c.status,
    organizerId: c.organizerId ? String(c.organizerId) : null,
    title: t(c.title, lang),
    category: c.category,
    tags: c.tags.map((tag) => t(tag, lang)),
    isMultiWin: c.isMultiWin,
    certificateForWinners: c.certificateForWinners,
    currency: c.currency,
    entryFee: c.entryFee,
    prizePool: c.prizePool,
    rewards: [...c.rewards].sort((a, b) => a.position - b.position).map((r) => ({ position: r.position, amount: r.amount })),
    seats: serializeSeats(c.seats),
    timeline: c.timeline,
    judges: c.judgeIds.flatMap((id) => {
      const j = judgeById.get(String(id));
      return j ? [serializeJudge(j, lang, baseUrl)] : [];
    }),
    content: {
      about: t(c.content?.about, lang),
      judgingParameters: (c.content?.judgingParameters ?? []).map((p) => ({ title: t(p.title, lang), weight: p.weight ?? null })),
      rulesEligibility: (c.content?.rulesEligibility ?? []).map((r) => t(r, lang)),
    },
    disclaimer: t(c.disclaimer, lang) || null,
    refundPolicyUrl: c.refundPolicyUrl ?? null,
    media: { coverImageUrl: mediaUrl(c.media?.coverImageUrl, baseUrl), prizeInfoVideoUrl: mediaUrl(c.media?.prizeInfoVideoUrl, baseUrl) },
    referralRewardPerSignup: c.referralRewardPerSignup,
  };
}
