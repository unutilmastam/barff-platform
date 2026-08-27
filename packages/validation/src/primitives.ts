/**
 * Reusable field schemas.
 *
 * These are shared by the public site, the dealer portal, the admin CMS and the
 * API so a field cannot be validated one way in the browser and another way on
 * the server. The server always re-validates: passing these schemas in the
 * browser is a usability feature, never an authorization decision (§12).
 */
import { z } from 'zod';
import { LOCALES } from '@barff/types';
import { isValidSlug, normalizePhone } from '@barff/utils';

export const idSchema = z.uuid({ error: 'validation.id.invalid' });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: 'validation.email.tooLong' })
  .pipe(z.email({ error: 'validation.email.invalid' }));

/**
 * Uzbek mobile/landline number in E.164 form.
 *
 * Input is normalized first, so `90 123 45 67`, `+998 90 123-45-67` and
 * `998901234567` all validate and all store identically.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => normalizePhone(value))
  .pipe(z.string().regex(/^\+998\d{9}$/, { error: 'validation.phone.invalidUzbekNumber' }));

/**
 * Password floor.
 *
 * S04 owns the final policy (hashing, rotation, admin MFA). This is the minimum
 * every entry point agrees on; it is deliberately a length-first rule, because
 * length beats character-class theatre.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: 'validation.password.tooShort' })
  .max(PASSWORD_MAX_LENGTH, { error: 'validation.password.tooLong' })
  .refine((value) => /[a-z]/i.test(value), { error: 'validation.password.needsLetter' })
  .refine((value) => /\d/.test(value), { error: 'validation.password.needsDigit' });

/** URL-safe slug. Uniqueness is a database concern (S09), not a schema concern. */
export const slugSchema = z
  .string()
  .trim()
  .min(1, { error: 'validation.slug.required' })
  .max(120, { error: 'validation.slug.tooLong' })
  .refine(isValidSlug, { error: 'validation.slug.invalidFormat' });

export const localeSchema = z.enum(LOCALES as [string, ...string[]], {
  error: 'validation.locale.unsupported',
});

/** Free-text field with both ends bounded, so empty strings never reach the DB. */
export function boundedTextSchema(min: number, max: number, key: string) {
  return z
    .string()
    .trim()
    .min(min, { error: `validation.${key}.tooShort` })
    .max(max, { error: `validation.${key}.tooLong` });
}

export const positiveIntSchema = z
  .number()
  .int({ error: 'validation.number.notInteger' })
  .positive({ error: 'validation.number.notPositive' });

export const nonNegativeIntSchema = z
  .number()
  .int({ error: 'validation.number.notInteger' })
  .nonnegative({ error: 'validation.number.negative' });

/**
 * A money amount as an integer count of minor units.
 *
 * Prices and totals never cross the wire as floats — see `@barff/utils/money`
 * and the S36 requirement that money math uses integer minor units.
 */
export const moneyMinorUnitsSchema = z
  .number()
  .int({ error: 'validation.money.notMinorUnits' })
  .safe({ error: 'validation.money.outOfRange' });

export const currencySchema = z.enum(['UZS', 'USD', 'EUR'], {
  error: 'validation.currency.unsupported',
});

/**
 * Hidden field that real users never fill in (S14 spam guard).
 * A non-empty value means a bot; the API discards the submission silently
 * rather than returning an error a bot could learn from.
 */
export const honeypotSchema = z.string().max(0, { error: 'validation.honeypot.filled' }).optional();
