/**
 * Display formatting helpers.
 *
 * Everything here is presentation-only. None of it validates input — that is
 * `@barff/validation`'s job — and none of it may be relied on for business
 * rules.
 */
import { type Locale, toIntlLocale } from './locale-tags.js';

export function formatNumber(
  value: number,
  locale: Locale = 'uz',
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(toIntlLocale(locale), options).format(value);
}

/** `12.5` → `12,5%` in uz/ru. */
export function formatPercent(value: number, locale: Locale = 'uz', fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

/**
 * Strips everything except digits and a leading `+`.
 * Used before storing or comparing phone numbers.
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return '';
  // A 9-digit national number is assumed Uzbek and gets the country code.
  if (digits.length === 9) return `+998${digits}`;
  return `+${digits}`;
}

/**
 * Formats an Uzbek number as `+998 90 123 45 67`.
 * Anything that is not a 12-digit `+998…` number is returned normalized but
 * ungrouped, rather than being forced into a shape it does not have.
 */
export function formatPhone(value: string): string {
  const normalized = normalizePhone(value);
  const match = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(normalized);
  if (match === null) return normalized;
  return `+998 ${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
}

/** `1536` → `1.5 KB`. For the admin media library (S19). */
export function formatFileSize(bytes: number, locale: Locale = 'uz'): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 ? 0 : 1;
  return `${formatNumber(size, locale, { maximumFractionDigits: digits })} ${units[unitIndex]}`;
}

/**
 * Truncates to `maxLength` characters at a word boundary where possible.
 * The ellipsis counts toward the limit, so the result never exceeds it.
 */
export function truncate(value: string, maxLength: number, ellipsis = '…'): string {
  if (maxLength <= 0) return '';
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const budget = Math.max(0, maxLength - ellipsis.length);
  const sliced = trimmed.slice(0, budget);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace > budget / 2 ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.trimEnd()}${ellipsis}`;
}

/** Collapses runs of whitespace. Applied to pasted CMS text before storage. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function capitalize(value: string): string {
  if (value.length === 0) return '';
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

/**
 * Initials for avatar placeholders in the admin and dealer UIs.
 * Takes at most two words.
 */
export function initials(value: string, maxLetters = 2): string {
  return collapseWhitespace(value)
    .split(' ')
    .filter((word) => word.length > 0)
    .slice(0, maxLetters)
    .map((word) => word.charAt(0).toLocaleUpperCase())
    .join('');
}

/**
 * Masks all but the last `visible` characters.
 *
 * For showing a partial phone or account number in a confirmation screen.
 * Never use this to hide secrets in logs — secrets are not logged at all (§12).
 */
export function maskTail(value: string, visible = 4, maskChar = '•'): string {
  if (value.length <= visible) return value;
  return maskChar.repeat(value.length - visible) + value.slice(value.length - visible);
}

/** `ORDER_TRANSITION_NOT_ALLOWED` → `Order transition not allowed`. */
export function humanizeCode(code: string): string {
  return capitalize(code.toLowerCase().replace(/[_-]+/g, ' ').trim());
}
