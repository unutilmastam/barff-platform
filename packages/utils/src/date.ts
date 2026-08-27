/**
 * Date helpers.
 *
 * BARFF operates in a single timezone, so orders, deliveries and reports are
 * presented in Tashkent time regardless of where the viewer is. Storage stays
 * UTC — only formatting is localized.
 */
import { type Locale, toIntlLocale } from './locale-tags.js';

export const BARFF_TIMEZONE = 'Asia/Tashkent';

/** Parses a value into a `Date`, returning `null` instead of `Invalid Date`. */
export function parseDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface DateFormatOptions {
  locale?: Locale;
  timeZone?: string;
}

function formatWith(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
  { locale = 'uz', timeZone = BARFF_TIMEZONE }: DateFormatOptions = {},
): string {
  const date = parseDate(value);
  if (date === null) return '';
  return new Intl.DateTimeFormat(toIntlLocale(locale), { ...options, timeZone }).format(date);
}

/** `27.08.2026` in uz/ru, `Aug 27, 2026` in en. */
export function formatDate(
  value: string | number | Date | null | undefined,
  options?: DateFormatOptions,
): string {
  return formatWith(value, { year: 'numeric', month: '2-digit', day: '2-digit' }, options);
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  options?: DateFormatOptions,
): string {
  return formatWith(
    value,
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
    options,
  );
}

export function formatTime(
  value: string | number | Date | null | undefined,
  options?: DateFormatOptions,
): string {
  return formatWith(value, { hour: '2-digit', minute: '2-digit', hour12: false }, options);
}

/** Long form for news articles and certificates: `27 avgust 2026`. */
export function formatLongDate(
  value: string | number | Date | null | undefined,
  options?: DateFormatOptions,
): string {
  return formatWith(value, { year: 'numeric', month: 'long', day: 'numeric' }, options);
}

/**
 * `YYYY-MM-DD` in the given timezone.
 *
 * Built from `Intl` parts rather than `toISOString().slice(0, 10)`, which would
 * silently report the previous day for anything before 05:00 Tashkent time.
 */
export function toIsoDate(
  value: string | number | Date | null | undefined,
  timeZone: string = BARFF_TIMEZONE,
): string {
  const date = parseDate(value);
  if (date === null) return '';
  // en-CA yields YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Full ISO-8601 UTC timestamp — the format the API sends and stores. */
export function toIsoDateTime(value: string | number | Date | null | undefined): string {
  const date = parseDate(value);
  return date === null ? '' : date.toISOString();
}

export function startOfDay(value: Date): Date {
  const copy = new Date(value.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(value: Date): Date {
  const copy = new Date(value.getTime());
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function addDays(value: Date, days: number): Date {
  const copy = new Date(value.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Whole days between two instants, ignoring time of day. Negative if `b` is earlier. */
export function differenceInDays(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / msPerDay);
}

export function isPast(value: Date, now: Date = new Date()): boolean {
  return value.getTime() < now.getTime();
}

/**
 * Relative time for activity feeds and audit logs (`3 kun oldin`).
 * Falls back to an absolute date beyond 30 days, where "2 months ago" stops
 * being useful to a dispatcher.
 */
export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  { locale = 'uz', now = new Date() }: { locale?: Locale; now?: Date } = {},
): string {
  const date = parseDate(value);
  if (date === null) return '';

  const diffSeconds = (date.getTime() - now.getTime()) / 1000;

  // Beyond a month, "2 months ago" tells a dispatcher less than a date does.
  if (Math.abs(diffSeconds) > 30 * 86_400) {
    return formatDate(date, { locale });
  }

  const divisions: readonly { step: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { step: 60, unit: 'second' },
    { step: 60, unit: 'minute' },
    { step: 24, unit: 'hour' },
    { step: 30, unit: 'day' },
  ];

  const formatter = new Intl.RelativeTimeFormat(toIntlLocale(locale), { numeric: 'auto' });
  let duration = diffSeconds;
  for (const { step, unit } of divisions) {
    if (Math.abs(duration) < step) {
      return formatter.format(Math.round(duration), unit);
    }
    duration /= step;
  }
  return formatter.format(Math.round(duration), 'month');
}
