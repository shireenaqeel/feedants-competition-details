import { useEffect, useRef } from 'react';
import type { CompetitionDetails } from '@/api/types';

/**
 * When a countdown reaches zero (registration closes, submissions open, a payment hold lapses)
 * the rules change, so ask the server for the new state instead of guessing on the device.
 */
export function useMilestoneRefetch(details: CompetitionDetails | undefined, now: number, refetch: () => void) {
  const fired = useRef(new Set<string>());
  useEffect(() => {
    if (!details) return;
    const boundaries = [details.lifecycle.nextMilestone?.at, details.viewer.registration?.holdExpiresAt].filter(
      (x): x is string => Boolean(x),
    );
    for (const at of boundaries) {
      if (now >= new Date(at).getTime() && !fired.current.has(at)) {
        fired.current.add(at);
        refetch();
      }
    }
  }, [details, now, refetch]);
}
