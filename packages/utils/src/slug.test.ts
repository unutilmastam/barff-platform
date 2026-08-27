import { describe, expect, it } from 'vitest';
import { isValidSlug, slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it('slugifies Uzbek Latin product names', () => {
    expect(slugify('Qulupnay Ananas')).toBe('qulupnay-ananas');
    expect(slugify('Multifrukt sharbati')).toBe('multifrukt-sharbati');
  });

  it('transliterates Russian Cyrillic instead of stripping it', () => {
    // Plain NFKD normalization would leave an empty string here.
    expect(slugify('Гранатовый сок')).toBe('granatovyy-sok');
    expect(slugify('Апельсиновый сок')).toBe('apelsinovyy-sok');
    expect(slugify('Вишнёвый сок')).toBe('vishnyovyy-sok');
  });

  it('transliterates Uzbek Cyrillic letters', () => {
    expect(slugify('Ўзбекистон')).toBe('ozbekiston');
    expect(slugify('Ғалаба')).toBe('galaba');
  });

  it('drops Uzbek Latin apostrophe modifiers', () => {
    expect(slugify("Qo'shimcha shakar yo'q")).toBe('qoshimcha-shakar-yoq');
    expect(slugify('Qoʻshimcha')).toBe('qoshimcha');
  });

  it('strips diacritics', () => {
    expect(slugify('Crème brûlée')).toBe('creme-brulee');
  });

  it('collapses separators and trims the edges', () => {
    expect(slugify('  --Hello   World!!  ')).toBe('hello-world');
  });

  it('keeps digits', () => {
    expect(slugify('Granat 350 ml')).toBe('granat-350-ml');
  });

  it('returns an empty string when nothing survives', () => {
    expect(slugify('!!! ???')).toBe('');
    expect(slugify('')).toBe('');
  });

  it('honours a custom separator', () => {
    expect(slugify('Hello World', { separator: '_' })).toBe('hello_world');
  });

  it('truncates at a word boundary within maxLength', () => {
    const result = slugify('granat sharbati premium sifat', { maxLength: 20 });
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).toBe('granat-sharbati');
    expect(result.endsWith('-')).toBe(false);
  });
});

describe('isValidSlug', () => {
  it('accepts well-formed slugs', () => {
    expect(isValidSlug('granat')).toBe(true);
    expect(isValidSlug('qulupnay-ananas')).toBe(true);
    expect(isValidSlug('granat-350')).toBe(true);
  });

  it('rejects malformed slugs', () => {
    expect(isValidSlug('Granat')).toBe(false);
    expect(isValidSlug('-granat')).toBe(false);
    expect(isValidSlug('granat-')).toBe(false);
    expect(isValidSlug('granat--350')).toBe(false);
    expect(isValidSlug('granat sok')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('returns the base when it is free', () => {
    expect(uniqueSlug('granat', ['olma'])).toBe('granat');
  });

  it('suffixes until it finds a free slug', () => {
    expect(uniqueSlug('granat', ['granat'])).toBe('granat-2');
    expect(uniqueSlug('granat', ['granat', 'granat-2', 'granat-3'])).toBe('granat-4');
  });
});
