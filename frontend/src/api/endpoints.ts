import type { Lang } from '@/i18n/strings';
import { api } from './client';
import type {
  Availability,
  CompetitionDetails,
  CompetitionFilters,
  CompetitionInput,
  CompetitionPage,
  CompetitionReview,
  EditableCompetition,
  FellowParticipant,
  MyRating,
  PublicProfile,
  RatingSummary,
  MyRegistration,
  OrganizerCompetition,
  PaymentOrder,
  Referral,
  Registration,
  Testimonial,
  User,
  UserStats,
  Winner,
} from './types';

type Brief = { competition: { id: string; slug: string; status: string } };

export const endpoints = {
  signup: (name: string, phone: string) => api<{ token: string; user: User }>('/auth/signup', { method: 'POST', body: { name, phone } }),
  login: (phone: string) => api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { phone } }),
  platformStats: () => api<{ activeCompetitions: number; activePrizePool: number; participants: number }>('/stats'),
  me: () => api<{ user: User; stats: UserStats }>('/users/me'),
  updateMe: (patch: Partial<Pick<User, 'name' | 'bio' | 'city' | 'language'>> & { avatarUrl?: string | null }) =>
    api<{ user: User }>('/users/me', { method: 'PATCH', body: patch }),
  myRegistrations: (lang: Lang) => api<{ registrations: MyRegistration[] }>('/users/me/registrations', { query: { lang } }),
  referral: () => api<Referral>('/users/me/referral'),
  publicProfile: (userId: string, lang: Lang) => api<PublicProfile>(`/users/${userId}/public`, { query: { lang } }),

  // Ratings
  reviews: (competitionId: string) =>
    api<{ summary: RatingSummary; ratings: CompetitionReview[] }>(`/competitions/${competitionId}/ratings`, { query: { limit: 5 } }),
  rateCompetition: (competitionId: string, body: { competitionStars: number; organizerStars: number; comment?: string }) =>
    api<{ rating: MyRating }>(`/competitions/${competitionId}/ratings/me`, { method: 'PUT', body }),
  fellowParticipants: (competitionId: string) => api<{ participants: FellowParticipant[] }>(`/competitions/${competitionId}/participants`),
  rateSportsmanship: (competitionId: string, userId: string, stars: number) =>
    api<{ ok: true }>(`/competitions/${competitionId}/participants/${userId}/sportsmanship`, { method: 'PUT', body: { stars } }),

  competitions: (lang: Lang, filters: CompetitionFilters, page: number) =>
    api<CompetitionPage>('/competitions', {
      query: {
        lang,
        page,
        limit: 20,
        ...filters,
        hasSpots: filters.hasSpots ? 'true' : undefined,
        saved: filters.saved ? 'true' : undefined,
      },
    }),
  competition: (idOrSlug: string, lang: Lang, signal?: AbortSignal) =>
    api<CompetitionDetails>(`/competitions/${encodeURIComponent(idOrSlug)}`, { query: { lang }, signal }),
  availability: (idOrSlug: string) => api<Availability>(`/competitions/${encodeURIComponent(idOrSlug)}/availability`),
  previousWinners: (idOrSlug: string) =>
    api<{ winners: Winner[] }>(`/competitions/${encodeURIComponent(idOrSlug)}/previous-winners`, { query: { limit: 10 } }),
  testimonials: (lang: Lang) => api<{ testimonials: Testimonial[] }>('/testimonials', { query: { lang, limit: 10 } }),
  saveCompetition: (competitionId: string) => api<{ saved: true }>(`/competitions/${competitionId}/save`, { method: 'PUT' }),
  unsaveCompetition: (competitionId: string) => api<{ saved: false }>(`/competitions/${competitionId}/save`, { method: 'DELETE' }),

  register: (competitionId: string) =>
    api<{ registration: Registration; payment: PaymentOrder | null }>(`/competitions/${competitionId}/registrations`, { method: 'POST' }),
  cancelRegistration: (registrationId: string) =>
    api<{ registration: Registration }>(`/registrations/${registrationId}`, { method: 'DELETE' }),
  mockCheckout: (orderId: string) =>
    api<{ orderId: string; paymentId: string; signature: string }>('/payments/mock/checkout', { method: 'POST', body: { orderId } }),
  verifyPayment: (registrationId: string, body: { orderId: string; paymentId: string; signature: string }) =>
    api<{ registration: Registration }>(`/registrations/${registrationId}/payment/verify`, { method: 'POST', body }),

  // Organizer
  myCompetitions: (lang: Lang) => api<{ competitions: OrganizerCompetition[] }>('/organizer/competitions', { query: { lang } }),
  editableCompetition: (id: string) => api<{ competition: EditableCompetition }>(`/organizer/competitions/${id}`),
  createCompetition: (body: CompetitionInput) => api<Brief>('/competitions', { method: 'POST', body }),
  updateCompetition: (id: string, body: Partial<CompetitionInput>) => api<Brief>(`/competitions/${id}`, { method: 'PATCH', body }),
  publishCompetition: (id: string) => api<Brief>(`/competitions/${id}/publish`, { method: 'POST' }),
  cancelCompetition: (id: string) => api<Brief & { refunds: number }>(`/competitions/${id}/cancel`, { method: 'POST' }),
  deleteCompetition: (id: string) => api<null>(`/competitions/${id}`, { method: 'DELETE' }),
};
