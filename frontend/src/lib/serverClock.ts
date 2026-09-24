import { useEffect, useState } from 'react';

// Business decisions happen on the server; the app only needs its countdowns to agree with the
// server's clock. Every response carrying `serverTime` updates the offset from the device clock.
let offsetMs = 0;

export function syncServerTime(serverTimeIso: string, requestStartedAt: number) {
  const now = Date.now();
  const latency = (now - requestStartedAt) / 2;
  const next = new Date(serverTimeIso).getTime() + latency - now;
  if (Number.isFinite(next)) offsetMs = next;
}

export const serverNow = () => Date.now() + offsetMs;

/** Re-renders every `intervalMs` with the current server-aligned time. */
export function useServerNow(intervalMs = 1000): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
