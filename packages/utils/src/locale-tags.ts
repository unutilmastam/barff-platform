/**
 * BCP 47 tags for the three supported languages.
 *
 * `packages/utils` deliberately does not depend on `@barff/types`: it is the
 * lowest layer in the workspace and is imported by the API, all four apps and
 * the Prisma seed. Keeping it dependency-free avoids a cycle once `@barff/types`
 * grows helpers of its own. The `Locale` union is kept structurally identical
 * to `@barff/types`'s and is checked against it by a test in
 * `@barff/validation`.
 */
export type Locale = 'uz' | 'ru' | 'en';

const INTL_LOCALE: Record<Locale, string> = {
  uz: 'uz-UZ',
  ru: 'ru-UZ',
  en: 'en-US',
};

/**
 * Maps a BARFF locale to the tag `Intl` should use.
 *
 * `ru` maps to `ru-UZ` rather than `ru-RU` so a Russian-speaking dealer in
 * Uzbekistan sees local date and number conventions.
 */
export function toIntlLocale(locale: Locale): string {
  return INTL_LOCALE[locale];
}
