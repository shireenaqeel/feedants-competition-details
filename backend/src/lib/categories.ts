export const CATEGORIES = ['dance', 'music', 'singing', 'art', 'photography', 'writing', 'comedy', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];
