import { describe, expect, it } from 'vitest';
import { LOCALES } from '@barff/types';
import {
  currencySchema,
  emailSchema,
  honeypotSchema,
  localeSchema,
  moneyMinorUnitsSchema,
  passwordSchema,
  phoneSchema,
  positiveIntSchema,
  slugSchema,
} from './primitives.js';

describe('emailSchema', () => {
  it('trims and lowercases before validating', () => {
    expect(emailSchema.parse('  Dealer@BARFF.UZ ')).toBe('dealer@barff.uz');
  });

  it('rejects malformed addresses', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
  });
});

describe('phoneSchema', () => {
  it('normalizes the accepted input shapes to one stored form', () => {
    for (const input of ['901234567', '+998 90 123-45-67', '998901234567']) {
      expect(phoneSchema.parse(input)).toBe('+998901234567');
    }
  });

  it('rejects non-Uzbek and malformed numbers', () => {
    expect(phoneSchema.safeParse('+1 202 555 0143').success).toBe(false);
    expect(phoneSchema.safeParse('12345').success).toBe(false);
    expect(phoneSchema.safeParse('').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts a long password with a letter and a digit', () => {
    expect(passwordSchema.safeParse('barff-quality-2026').success).toBe(true);
  });

  it('rejects short passwords and missing character classes', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('alllettersnodigit').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890123').success).toBe(false);
  });
});

describe('slugSchema', () => {
  it('accepts the slugs used by the seeded products', () => {
    for (const slug of ['granat', 'apelsin', 'qulupnay-ananas']) {
      expect(slugSchema.safeParse(slug).success).toBe(true);
    }
  });

  it('rejects slugs that are not URL-safe', () => {
    expect(slugSchema.safeParse('Granat').success).toBe(false);
    expect(slugSchema.safeParse('granat sok').success).toBe(false);
    expect(slugSchema.safeParse('-granat-').success).toBe(false);
  });
});

describe('localeSchema', () => {
  it('accepts every supported locale and nothing else', () => {
    for (const locale of LOCALES) {
      expect(localeSchema.safeParse(locale).success).toBe(true);
    }
    expect(localeSchema.safeParse('de').success).toBe(false);
  });
});

describe('numeric primitives', () => {
  it('rejects fractional money amounts', () => {
    expect(moneyMinorUnitsSchema.safeParse(1250).success).toBe(true);
    expect(moneyMinorUnitsSchema.safeParse(12.5).success).toBe(false);
  });

  it('bounds positive integers', () => {
    expect(positiveIntSchema.safeParse(1).success).toBe(true);
    expect(positiveIntSchema.safeParse(0).success).toBe(false);
    expect(positiveIntSchema.safeParse(-1).success).toBe(false);
  });

  it('restricts currencies to the supported set', () => {
    expect(currencySchema.safeParse('UZS').success).toBe(true);
    expect(currencySchema.safeParse('GBP').success).toBe(false);
  });
});

describe('honeypotSchema', () => {
  it('passes when absent or empty and fails when a bot fills it', () => {
    expect(honeypotSchema.safeParse(undefined).success).toBe(true);
    expect(honeypotSchema.safeParse('').success).toBe(true);
    expect(honeypotSchema.safeParse('http://spam.example').success).toBe(false);
  });
});
