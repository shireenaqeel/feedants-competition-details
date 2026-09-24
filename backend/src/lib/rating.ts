/** Average from running totals, rounded to one decimal; null when nobody rated yet. */
export function ratingSummary(totals: { count?: number | null; sum?: number | null } | null | undefined) {
  const count = totals?.count ?? 0;
  return { average: count ? Math.round(((totals?.sum ?? 0) / count) * 10) / 10 : null, count };
}
