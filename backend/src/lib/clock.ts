// All business rules read time through this clock so tests can move time deterministically.
let override: Date | null = null;

export const clock = {
  now: (): Date => (override ? new Date(override) : new Date()),
  set: (date: Date) => {
    override = date;
  },
  reset: () => {
    override = null;
  },
};
