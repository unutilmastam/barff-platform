/**
 * Cross-package integration.
 *
 * `@barff/validation` is the only S01 package that imports the other two, so
 * this file doubles as the proof that workspace packages resolve, build and
 * interoperate. The equivalent check from a real application lands in S06,
 * when the first app exists to import them.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  DEFAULT_PAGE_SIZE,
  LOCALES,
  MAX_PAGE_SIZE,
  OrderStatus,
  ORDER_STATUS_SEQUENCE,
  orderStatusIndex,
  Role,
} from '@barff/types';
import { formatMoney, money, slugify, toIntlLocale } from '@barff/utils';
import { localizedTextSchema } from './localized.js';
import { paginationQuerySchema } from './pagination.js';
import { localeSchema } from './primitives.js';

describe('@barff/types is importable and self-consistent', () => {
  it('exposes the roles the seed will create', () => {
    expect(Object.values(Role)).toEqual([
      'ADMIN',
      'SALES',
      'WAREHOUSE',
      'LOGISTICS',
      'DRIVER',
      'DEALER',
    ]);
  });

  it('keeps the order sequence in the documented CLAUDE.md §5 order', () => {
    expect(ORDER_STATUS_SEQUENCE).toEqual([
      'DRAFT',
      'PENDING_REVIEW',
      'CONFIRMED',
      'RESERVED',
      'PICKING',
      'PACKED',
      'READY_FOR_DELIVERY',
      'DRIVER_ASSIGNED',
      'IN_TRANSIT',
      'DELIVERED',
    ]);
  });

  it('places CANCELLED outside the happy path', () => {
    expect(orderStatusIndex(OrderStatus.CANCELLED)).toBe(-1);
    expect(orderStatusIndex(OrderStatus.DRAFT)).toBe(0);
  });
});

describe('@barff/utils is importable', () => {
  it('transliterates a Russian product name', () => {
    expect(slugify('Гранатовый сок')).toBe('granatovyy-sok');
  });

  it('formats money from integer minor units', () => {
    expect(formatMoney(money(1_250_000, 'UZS'), 'en-US')).toContain('UZS');
  });
});

describe('the three packages agree on locales', () => {
  it('maps every @barff/types locale to a BCP 47 tag in @barff/utils', () => {
    for (const locale of LOCALES) {
      expect(toIntlLocale(locale)).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it('validates exactly the locales @barff/types declares', () => {
    for (const locale of LOCALES) {
      expect(localeSchema.safeParse(locale).success).toBe(true);
    }
    expect(localeSchema.safeParse('de').success).toBe(false);
  });

  it('builds a localized schema with one required key per locale', () => {
    const schema = localizedTextSchema();
    const complete = Object.fromEntries(LOCALES.map((locale) => [locale, `text-${locale}`]));
    expect(schema.safeParse(complete).success).toBe(true);

    const missingDefault = { ...complete };
    delete (missingDefault as Record<string, unknown>)[DEFAULT_LOCALE];
    expect(schema.safeParse(missingDefault).success).toBe(false);
  });
});

describe('pagination defaults come from @barff/types', () => {
  it('applies the shared defaults', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('coerces query-string values', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('enforces the shared page-size cap', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: MAX_PAGE_SIZE }).success).toBe(true);
    expect(paginationQuerySchema.safeParse({ pageSize: MAX_PAGE_SIZE + 1 }).success).toBe(false);
  });
});
