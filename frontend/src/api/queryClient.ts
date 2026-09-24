import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { ApiError } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: (count, error) => {
        // Don't retry client errors (404, 401, validation); do retry flaky networks.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return count < 2;
      },
    },
  },
});

// Refetch when the app returns to the foreground (React Native has no window focus events).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'));
}

export const queryKeys = {
  competitions: (lang: string, filters: object) => ['competitions', lang, filters] as const,
  competitionsAll: ['competitions'] as const,
  me: (userId: string | null) => ['me', userId] as const,
  myRegistrations: (userId: string | null, lang: string) => ['myRegistrations', userId, lang] as const,
  myCompetitions: (userId: string | null, lang: string) => ['myCompetitions', userId, lang] as const,
  editable: (id: string) => ['editable', id] as const,
  publicProfile: (id: string, lang: string) => ['publicProfile', id, lang] as const,
  reviews: (competitionId: string) => ['reviews', competitionId] as const,
  fellows: (competitionId: string) => ['fellows', competitionId] as const,
  competition: (slug: string, lang: string, userId: string | null) => ['competition', slug, lang, userId] as const,
  competitionAll: (slug: string) => ['competition', slug] as const,
  availability: (slug: string) => ['availability', slug] as const,
  winners: (slug: string) => ['winners', slug] as const,
  testimonials: (lang: string) => ['testimonials', lang] as const,
  referral: (userId: string | null) => ['referral', userId] as const,
};
