/**
 * Supported languages — `CLAUDE.md` §18. `uz` is the default.
 *
 * Large user-facing strings never live in components; these codes key the
 * translation files (S15) and the localized columns on content models (S10).
 */
export const Locale = {
  UZ: 'uz',
  RU: 'ru',
  EN: 'en',
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export const LOCALES = Object.values(Locale);

export const DEFAULT_LOCALE: Locale = Locale.UZ;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * A field translated into every supported language.
 *
 * All three are required so a missing translation is a type error rather than
 * an empty string in production. Use `PartialLocalizedText` for draft content
 * that is still being filled in.
 */
export type LocalizedText = Record<Locale, string>;

export type PartialLocalizedText = Partial<Record<Locale, string>>;

/**
 * Reads a localized field, falling back to the default locale and then to any
 * populated value. Returns an empty string rather than throwing — a missing
 * translation must never break a page render.
 */
export function resolveLocalized(
  value: PartialLocalizedText | undefined,
  locale: Locale,
  fallback: Locale = DEFAULT_LOCALE,
): string {
  if (!value) return '';
  return value[locale] ?? value[fallback] ?? Object.values(value).find(Boolean) ?? '';
}
