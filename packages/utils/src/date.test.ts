import { describe, expect, it } from 'vitest';
import {
  addDays,
  BARFF_TIMEZONE,
  differenceInDays,
  endOfDay,
  formatDate,
  formatDateTime,
  formatLongDate,
  formatRelativeTime,
  isPast,
  parseDate,
  startOfDay,
  toIsoDate,
  toIsoDateTime,
} from './date.js';

describe('parseDate', () => {
  it('returns null instead of an Invalid Date', () => {
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });

  it('parses ISO strings, epochs and Date instances', () => {
    expect(parseDate('2026-08-27T10:00:00Z')?.toISOString()).toBe('2026-08-27T10:00:00.000Z');
    expect(parseDate(0)?.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(parseDate(new Date('2026-08-27T10:00:00Z'))?.toISOString()).toBe(
      '2026-08-27T10:00:00.000Z',
    );
  });

  it('copies rather than aliasing the input Date', () => {
    const original = new Date('2026-08-27T10:00:00Z');
    const parsed = parseDate(original);
    original.setFullYear(2030);
    expect(parsed?.getUTCFullYear()).toBe(2026);
  });
});

describe('toIsoDate', () => {
  it('uses the Tashkent calendar day, not the UTC one', () => {
    // 22:00 UTC is already the next day in Tashkent (UTC+5).
    expect(toIsoDate('2026-08-27T22:00:00Z')).toBe('2026-08-28');
    expect(new Date('2026-08-27T22:00:00Z').toISOString().slice(0, 10)).toBe('2026-08-27');
  });

  it('returns an empty string for unparseable input', () => {
    expect(toIsoDate('nonsense')).toBe('');
  });

  it('honours an explicit timezone', () => {
    expect(toIsoDate('2026-08-27T22:00:00Z', 'UTC')).toBe('2026-08-27');
  });
});

describe('formatting', () => {
  const instant = '2026-08-27T09:30:00Z';

  it('formats a date in Tashkent time', () => {
    expect(formatDate(instant, { locale: 'ru' })).toBe('27.08.2026');
  });

  it('formats a datetime shifted into Tashkent time', () => {
    // 09:30 UTC is 14:30 in Tashkent.
    expect(formatDateTime(instant, { locale: 'ru' })).toContain('14:30');
  });

  it('formats a long date', () => {
    expect(formatLongDate(instant, { locale: 'en' })).toBe('August 27, 2026');
  });

  it('returns an empty string for unparseable input', () => {
    expect(formatDate('nonsense')).toBe('');
    expect(formatDateTime(null)).toBe('');
  });

  it('exposes the operating timezone', () => {
    expect(BARFF_TIMEZONE).toBe('Asia/Tashkent');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-27T12:00:00Z');

  it('reports minutes and hours in the past', () => {
    expect(formatRelativeTime('2026-08-27T11:30:00Z', { locale: 'en', now })).toBe(
      '30 minutes ago',
    );
    expect(formatRelativeTime('2026-08-27T09:00:00Z', { locale: 'en', now })).toBe('3 hours ago');
  });

  it('reports days and handles the future', () => {
    expect(formatRelativeTime('2026-08-24T12:00:00Z', { locale: 'en', now })).toBe('3 days ago');
    expect(formatRelativeTime('2026-08-29T12:00:00Z', { locale: 'en', now })).toBe('in 2 days');
  });

  it('falls back to an absolute date beyond 30 days', () => {
    expect(formatRelativeTime('2026-01-01T12:00:00Z', { locale: 'ru', now })).toBe('01.01.2026');
  });

  it('returns an empty string for unparseable input', () => {
    expect(formatRelativeTime('nonsense', { now })).toBe('');
  });
});

describe('date arithmetic', () => {
  it('brackets a local day', () => {
    const date = new Date('2026-08-27T09:30:00Z');
    expect(startOfDay(date).getHours()).toBe(0);
    expect(endOfDay(date).getHours()).toBe(23);
    expect(endOfDay(date).getMilliseconds()).toBe(999);
  });

  it('adds and subtracts days without mutating the input', () => {
    const date = new Date('2026-08-27T09:30:00Z');
    const later = addDays(date, 5);
    expect(differenceInDays(date, later)).toBe(5);
    expect(differenceInDays(later, date)).toBe(-5);
    expect(date.toISOString()).toBe('2026-08-27T09:30:00.000Z');
  });

  it('crosses a month boundary', () => {
    expect(toIsoDateTime(addDays(new Date('2026-08-30T00:00:00Z'), 3)).slice(0, 10)).toBe(
      '2026-09-02',
    );
  });

  it('detects past instants', () => {
    const now = new Date('2026-08-27T12:00:00Z');
    expect(isPast(new Date('2026-08-26T12:00:00Z'), now)).toBe(true);
    expect(isPast(new Date('2026-08-28T12:00:00Z'), now)).toBe(false);
  });
});
