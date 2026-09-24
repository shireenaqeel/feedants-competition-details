import { expireStaleHolds } from '../modules/registrations/registration.service.js';

/** Periodically releases seats from abandoned payments. Returns a stop function. */
export function startHoldSweeper(intervalMs: number): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // never overlap runs on the same instance
    running = true;
    try {
      const expired = await expireStaleHolds();
      if (expired) console.log(`Released ${expired} expired registration hold(s)`);
    } catch (err) {
      console.error('Hold sweeper failed:', err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
