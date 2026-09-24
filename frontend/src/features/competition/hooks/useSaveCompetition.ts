import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { endpoints } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import type { CompetitionDetails } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';

/**
 * Toggles the bookmark on a competition. Flips the icon immediately (optimistic), rolling back
 * if the request fails; the Saved filter and list badges catch up once it settles.
 */
export function useSaveCompetition(slug: string, competitionId: string | undefined) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();

  const setSaved = (isSaved: boolean) =>
    queryClient.setQueriesData<CompetitionDetails>({ queryKey: queryKeys.competitionAll(slug) }, (d) =>
      d ? { ...d, viewer: { ...d.viewer, isSaved } } : d,
    );

  const toggle = useMutation({
    mutationFn: async (next: boolean): Promise<{ saved: boolean }> =>
      next ? endpoints.saveCompetition(competitionId!) : endpoints.unsaveCompetition(competitionId!),
    onMutate: (next) => {
      setSaved(next);
      return { previous: !next };
    },
    onError: (_err, _next, ctx) => {
      if (ctx) setSaved(ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.competitionsAll });
    },
  });

  return {
    toggleSave: (currentlySaved: boolean) => {
      if (!user) {
        router.push('/login');
        return;
      }
      if (competitionId) toggle.mutate(!currentlySaved);
    },
  };
}
