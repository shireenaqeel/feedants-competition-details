// Shapes returned by the backend (see docs/BACKEND_DESIGN.md). Money is in paise; dates are ISO strings.

export type Phase = 'cancelled' | 'upcoming' | 'registration_open' | 'submission_open' | 'judging' | 'results_out';
export type MilestoneType = 'registration_opens' | 'registration_closes' | 'submission_starts' | 'submission_ends' | 'results';
export type ViewerState = 'guest' | 'organizer' | 'not_registered' | 'payment_pending' | 'registered' | 'submitted' | 'refund_pending' | 'winner';

export type ActionReason =
  | 'LOGIN_REQUIRED'
  | 'IS_ORGANIZER'
  | 'NOT_PUBLISHED'
  | 'COMPETITION_CANCELLED'
  | 'REGISTRATION_NOT_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'COMPETITION_FULL'
  | 'ALREADY_REGISTERED'
  | 'PAYMENT_PENDING'
  | 'NO_PENDING_PAYMENT'
  | 'NOT_REGISTERED'
  | 'SUBMISSION_NOT_STARTED'
  | 'SUBMISSION_CLOSED'
  | 'RESULTS_NOT_OUT'
  | 'NOT_PARTICIPANT'
  | 'RATING_NOT_OPEN';

export interface Action {
  allowed: boolean;
  reason?: ActionReason;
}

export interface Seats {
  total: number;
  booked: number;
  held: number;
  left: number;
}

export interface Timeline {
  registrationOpensAt: string;
  registrationClosesAt: string;
  submissionStartsAt: string;
  submissionEndsAt: string;
  resultAt: string;
}

export type Stage = 'upcoming' | 'ongoing' | 'past';

export interface RatingSummary {
  average: number | null;
  count: number;
}

export interface Lifecycle {
  phase: Phase;
  stage: Stage;
  registrationOpen: boolean;
  submissionOpen: boolean;
  isFull: boolean;
  nextMilestone: { type: MilestoneType; at: string } | null;
  urgency: boolean;
}

export interface Judge {
  id: string;
  name: string;
  title: string;
  experienceYears: number | null;
  avatarUrl: string | null;
  introVideoUrl: string | null;
}

export interface Competition {
  id: string;
  slug: string;
  status: CompetitionStatus;
  organizerId: string | null;
  title: string;
  category: Category;
  tags: string[];
  isMultiWin: boolean;
  certificateForWinners: boolean;
  currency: string;
  entryFee: number;
  prizePool: number;
  rewards: { position: number; amount: number }[];
  seats: Seats;
  timeline: Timeline;
  judges: Judge[];
  content: {
    about: string;
    judgingParameters: { title: string; weight: number | null }[];
    rulesEligibility: string[];
  };
  disclaimer: string | null;
  refundPolicyUrl: string | null;
  media: { coverImageUrl: string | null; prizeInfoVideoUrl: string | null };
  referralRewardPerSignup: number;
}

export interface Registration {
  id: string;
  competitionId: string;
  status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'refund_required' | 'refunded';
  amount: number;
  currency: string;
  holdExpiresAt: string | null;
  confirmedAt: string | null;
}

export interface Submission {
  id: string;
  mediaUrl: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  version: number;
  submittedAt: string;
}

export interface MyRating {
  competitionStars: number;
  organizerStars: number;
  comment: string | null;
  updatedAt: string;
}

export interface CompetitionDetails {
  competition: Competition & {
    rating: RatingSummary;
    organizer: { id: string; name: string; avatarUrl: string | null; rating: RatingSummary } | null;
  };
  lifecycle: Lifecycle;
  viewer: {
    state: ViewerState;
    isOrganizer: boolean;
    registration: Registration | null;
    submission: Submission | null;
    resultPosition: number | null;
    myRating: MyRating | null;
    isSaved: boolean;
  };
  actions: { register: Action; pay: Action; submit: Action; viewResults: Action; rate: Action };
  serverTime: string;
}

export interface Availability {
  seats: Seats;
  isFull: boolean;
  registrationOpen: boolean;
  serverTime: string;
}

export type CompetitionStatus = 'draft' | 'published' | 'cancelled';

export const CATEGORIES = ['dance', 'music', 'singing', 'art', 'photography', 'writing', 'comedy', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PHASE_FILTERS = ['active', 'ongoing', 'closing_soon', 'upcoming', 'past'] as const;
export type PhaseFilter = (typeof PHASE_FILTERS)[number] | 'open';
export type SortOption = 'closing' | 'newest' | 'prize';

export interface CompetitionFilters {
  phase?: PhaseFilter;
  category?: Category;
  fee?: 'free' | 'paid';
  hasSpots?: boolean;
  saved?: boolean;
  q?: string;
  sort?: SortOption;
}

export interface CompetitionPage {
  competitions: CompetitionSummary[];
  page: number;
  hasMore: boolean;
}

export interface CompetitionSummary {
  id: string;
  slug: string;
  status: CompetitionStatus;
  title: string;
  category: Category;
  currency: string;
  entryFee: number;
  prizePool: number;
  seats: Seats;
  timeline: Timeline;
  lifecycle: Lifecycle;
  rating: RatingSummary;
  isSaved: boolean;
}

export interface Winner {
  id: string;
  name: string;
  avatarUrl: string | null;
  position: number;
  videoUrl: string | null;
  edition: string | null;
  awardedAt: string;
}

export interface Testimonial {
  id: string;
  userName: string;
  avatarUrl: string | null;
  text: string;
  rating: number | null;
}

export interface PaymentOrder {
  provider: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  language: 'en' | 'hi';
  memberSince: string;
}

export interface UserStats {
  registered: number;
  submitted: number;
  noShows: number;
  won: number;
  organized: number;
  sportsmanship: RatingSummary;
  organizerRating: RatingSummary;
}

export interface PublicProfile {
  user: { id: string; name: string; avatarUrl: string | null; bio: string | null; city: string | null; memberSince: string };
  stats: UserStats;
  participated: CompetitionSummary[];
  organized: CompetitionSummary[];
}

export interface CompetitionReview {
  id: string;
  userName: string;
  avatarUrl: string | null;
  competitionStars: number;
  organizerStars: number;
  comment: string | null;
  createdAt: string;
}

export interface FellowParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
  sportsmanship: RatingSummary;
  myStars: number | null;
}

export interface MyRegistration {
  registration: Registration;
  competition: CompetitionSummary;
  hasSubmission: boolean;
}

export interface OrganizerCompetition extends CompetitionSummary {
  submissions: number;
  createdAt: string;
}

export interface LocalizedText {
  en: string;
  hi?: string | null;
}

/** Both-language values for the organizer's edit form. Money in paise. */
export interface EditableCompetition {
  id: string;
  slug: string;
  status: CompetitionStatus;
  title: LocalizedText;
  category: Category;
  tags: LocalizedText[];
  isMultiWin: boolean;
  certificateForWinners: boolean;
  entryFee: number;
  rewards: { position: number; amount: number }[];
  seats: { total: number; taken: number };
  timeline: Timeline;
  judge: { name: string; title: LocalizedText; experienceYears: number | null; avatarUrl: string | null; introVideoUrl: string | null } | null;
  content: { about: LocalizedText; judgingParameters: { title: LocalizedText; weight?: number | null }[]; rulesEligibility: LocalizedText[] };
  disclaimer: LocalizedText | null;
  refundPolicyUrl: string | null;
  prizeInfoVideoUrl: string | null;
  coverImageUrl: string | null;
  referralRewardPerSignup: number;
  locks: { entryFee: boolean };
}

/** Body for POST /competitions and PATCH /competitions/:id. */
export interface CompetitionInput {
  title: LocalizedText;
  category: Category;
  tags: LocalizedText[];
  isMultiWin: boolean;
  certificateForWinners: boolean;
  entryFee: number;
  rewards: { position: number; amount: number }[];
  seatsTotal: number;
  timeline: Record<keyof Timeline, string>;
  judge: { name: string; title: LocalizedText; experienceYears?: number; avatarUrl?: string; introVideoUrl?: string };
  content: { about: LocalizedText; judgingParameters: { title: LocalizedText; weight?: number }[]; rulesEligibility: LocalizedText[] };
  disclaimer?: LocalizedText;
  refundPolicyUrl?: string;
  prizeInfoVideoUrl?: string;
  referralRewardPerSignup: number;
  publish?: boolean;
}

export interface Referral {
  code: string;
  link: string;
  signups: number;
  earned: number;
}
