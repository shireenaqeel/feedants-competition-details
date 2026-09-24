export const LANGUAGES = ['en', 'hi'] as const;
export type Lang = (typeof LANGUAGES)[number];

export type Localized = { en: string; hi?: string | null };

/** Picks the requested language, falling back to English when a translation is missing. */
export function t(value: Localized | null | undefined, lang: Lang): string {
  if (!value) return '';
  return (lang !== 'en' && value[lang]) || value.en;
}
