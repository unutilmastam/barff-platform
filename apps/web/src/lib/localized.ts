import { type Locale, type PartialLocalizedText, resolveLocalized } from '@barff/types';

/**
 * Reads a localized field that may be `null`.
 *
 * The API returns `null` for copy an editor has not written yet; `@barff/types`
 * takes `undefined`. One adapter here rather than `?? undefined` at forty call
 * sites.
 */
export function text(value: PartialLocalizedText | null | undefined, locale: string): string {
  return resolveLocalized(value ?? undefined, locale as Locale);
}

/** True when a localized field has something worth rendering in this locale. */
export function hasText(value: PartialLocalizedText | null | undefined, locale: string): boolean {
  return text(value, locale).trim().length > 0;
}
