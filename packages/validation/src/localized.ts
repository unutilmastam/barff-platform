/**
 * Localized content schemas — `CLAUDE.md` §18.
 *
 * Content is authored in three languages. Which of them are mandatory depends
 * on the field: a product name must exist in all three before publishing, while
 * a draft news article may be started in one.
 */
import { z } from 'zod';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@barff/types';

/** Every language required — for content that is about to be published. */
export function localizedTextSchema(min = 1, max = 500) {
  return z.object(
    Object.fromEntries(
      LOCALES.map((locale) => [
        locale,
        z
          .string()
          .trim()
          .min(min, { error: 'validation.localized.missingTranslation' })
          .max(max, { error: 'validation.localized.tooLong' }),
      ]),
    ) as Record<Locale, z.ZodString>,
  );
}

/**
 * Default language required, the others optional — for drafts.
 * Publishing re-validates with `localizedTextSchema` (S10).
 */
export function draftLocalizedTextSchema(max = 500) {
  const shape = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      locale === DEFAULT_LOCALE
        ? z.string().trim().min(1, { error: 'validation.localized.missingTranslation' }).max(max)
        : z.string().trim().max(max).optional(),
    ]),
  );
  return z.object(shape);
}

export type LocalizedTextInput = z.infer<ReturnType<typeof localizedTextSchema>>;
