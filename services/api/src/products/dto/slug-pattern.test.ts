import { describe, expect, it } from 'vitest';
import { isValidSlug } from '@barff/utils';
import { SLUG_PATTERN } from './category.dto.js';

/**
 * `SLUG_PATTERN` is a second copy of the rule `isValidSlug` implements —
 * class-validator's `@Matches` needs a literal regex, and it cannot call a
 * function. Two copies of a rule drift, and the drift would be silent: the
 * admin UI (which uses `@barff/utils` to suggest a slug) would offer something
 * the API then rejects, or the reverse.
 *
 * So the agreement is asserted rather than assumed, over inputs chosen to hit
 * every edge the two could disagree on.
 */
const CASES = [
  'granat',
  'apelsin',
  'olcha',
  'qulupnay-ananas',
  'granat-350',
  '350',
  'a',
  'a-b-c-d',
  // Rejected by both:
  '',
  'Granat',
  '-granat',
  'granat-',
  'granat--350',
  'granat_350',
  'granat 350',
  'granat.350',
  'granat/350',
  'gránat',
  'гранат',
  'granat\n',
  '\ngranat',
  'granat\nolma',
];

describe('SLUG_PATTERN', () => {
  it.each(CASES)('agrees with isValidSlug for %j', (value) => {
    expect(SLUG_PATTERN.test(value)).toBe(isValidSlug(value));
  });

  it('accepts the slugs the seeded catalogue uses', () => {
    for (const slug of [
      'granat',
      'apelsin',
      'olcha',
      'shaftoli',
      'olma',
      'multifrukt',
      'qulupnay-ananas',
    ]) {
      expect(SLUG_PATTERN.test(slug)).toBe(true);
    }
  });

  it('is anchored at both ends', () => {
    // A pattern missing `^` or `$` would accept an embedded newline and let a
    // slug carry a second line — which is how a header injection starts.
    expect(SLUG_PATTERN.source.startsWith('^')).toBe(true);
    expect(SLUG_PATTERN.source.endsWith('$')).toBe(true);
    expect(SLUG_PATTERN.multiline).toBe(false);
  });

  it('is not stateful', () => {
    // A `g` flag would make `.test()` return different answers on repeat calls,
    // so the same slug would validate on one request and fail on the next.
    expect(SLUG_PATTERN.global).toBe(false);
    expect(SLUG_PATTERN.test('granat')).toBe(true);
    expect(SLUG_PATTERN.test('granat')).toBe(true);
  });
});
