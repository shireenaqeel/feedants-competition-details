import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { endpoints } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import { useAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/i18n/LanguageProvider';

export const AVAILABILITY_POLL_MS = 15_000;

/** Full details payload; per language and per user (the viewer block differs). */
export function useCompetitionDetails(slug: string) {
  const { lang } = useLanguage();
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.competition(slug, lang, user?.id ?? null),
    queryFn: ({ signal }) => endpoints.competition(slug, lang, signal),
    // Switching language keeps the old content on screen until the new one arrives.
    placeholderData: keepPreviousData,
  });
}

/** Live spots, polled only while the screen is focused. */
export function useAvailability(slug: string) {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return useQuery({
    queryKey: queryKeys.availability(slug),
    queryFn: () => endpoints.availability(slug),
    refetchInterval: focused ? AVAILABILITY_POLL_MS : false,
    staleTime: 0,
  });
}

export function usePreviousWinners(slug: string) {
  return useQuery({ queryKey: queryKeys.winners(slug), queryFn: () => endpoints.previousWinners(slug), staleTime: 5 * 60_000 });
}

export function useTestimonials() {
  const { lang } = useLanguage();
  return useQuery({ queryKey: queryKeys.testimonials(lang), queryFn: () => endpoints.testimonials(lang), staleTime: 5 * 60_000 });
}

export function useReferral() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.referral(user?.id ?? null),
    queryFn: endpoints.referral,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });
}
