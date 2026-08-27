import { describe, expect, it } from 'vitest';
import {
  capitalize,
  collapseWhitespace,
  formatFileSize,
  formatNumber,
  formatPercent,
  formatPhone,
  humanizeCode,
  initials,
  maskTail,
  normalizePhone,
  truncate,
} from './format.js';

describe('numbers', () => {
  it('groups thousands', () => {
    expect(formatNumber(1_234_567, 'en')).toBe('1,234,567');
  });

  it('returns an empty string for non-finite values', () => {
    expect(formatNumber(Number.NaN)).toBe('');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('');
  });

  it('formats percentages from a 0-100 scale', () => {
    expect(formatPercent(12.5, 'en')).toBe('12.5%');
    expect(formatPercent(100, 'en')).toBe('100%');
  });
});

describe('phone numbers', () => {
  it('adds the country code to a 9-digit national number', () => {
    expect(normalizePhone('901234567')).toBe('+998901234567');
  });

  it('strips formatting characters', () => {
    expect(normalizePhone('+998 (90) 123-45-67')).toBe('+998901234567');
  });

  it('returns an empty string when there are no digits', () => {
    expect(normalizePhone('  -- ')).toBe('');
  });

  it('groups a valid Uzbek number', () => {
    expect(formatPhone('998901234567')).toBe('+998 90 123 45 67');
    expect(formatPhone('901234567')).toBe('+998 90 123 45 67');
  });

  it('leaves a foreign number normalized but ungrouped', () => {
    expect(formatPhone('+1 202 555 0143')).toBe('+12025550143');
  });
});

describe('formatFileSize', () => {
  it('scales through the units', () => {
    expect(formatFileSize(512, 'en')).toBe('512 B');
    expect(formatFileSize(1536, 'en')).toBe('1.5 KB');
    expect(formatFileSize(20_154_894, 'en')).toBe('19.2 MB');
  });

  it('rejects negative and non-finite sizes', () => {
    expect(formatFileSize(-1)).toBe('');
    expect(formatFileSize(Number.NaN)).toBe('');
  });
});

describe('truncate', () => {
  it('leaves short strings alone', () => {
    expect(truncate('short', 20)).toBe('short');
  });

  it('never exceeds maxLength', () => {
    const result = truncate('Granat sharbati premium sifat bilan', 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('…')).toBe(true);
  });

  it('cuts at a word boundary when there is one', () => {
    expect(truncate('Granat sharbati premium', 20)).toBe('Granat sharbati…');
  });

  it('handles a zero or negative budget', () => {
    expect(truncate('anything', 0)).toBe('');
  });
});

describe('text helpers', () => {
  it('collapses whitespace', () => {
    expect(collapseWhitespace('  a   b \n c  ')).toBe('a b c');
  });

  it('capitalizes without touching the rest', () => {
    expect(capitalize('granat sok')).toBe('Granat sok');
    expect(capitalize('')).toBe('');
  });

  it('builds initials from at most two words', () => {
    expect(initials('Barff Distribution Nukus')).toBe('BD');
    expect(initials('barff')).toBe('B');
    expect(initials('   ')).toBe('');
  });

  it('masks all but the tail', () => {
    expect(maskTail('998901234567')).toBe('••••••••4567');
    expect(maskTail('123', 4)).toBe('123');
  });

  it('humanizes an error code', () => {
    expect(humanizeCode('ORDER_TRANSITION_NOT_ALLOWED')).toBe('Order transition not allowed');
  });
});
