import { describe, expect, it } from 'vitest';
import { clampToSignedUrlLifetime } from './cache.service.js';
import { cacheKey, etagFor, isNotModified } from './http-cache.interceptor.js';

describe('clampToSignedUrlLifetime', () => {
  const SIGNED_URL_TTLS = [60, 300, 900, 3600, 86_400];
  const REQUESTED = [1, 30, 60, 300, 600, 3600, 100_000];

  it('never lets a cached copy outlive the URLs inside it', () => {
    // The invariant this whole helper exists for. A response cached at t=0 can
    // be served at the very end of its Redis life and then held by the browser
    // for its full max-age, so the two windows add up — and the total has to
    // finish comfortably inside the signing window, or visitors get a valid
    // response full of dead image links.
    for (const signed of SIGNED_URL_TTLS) {
      for (const requested of REQUESTED) {
        const { redisSeconds, browserSeconds } = clampToSignedUrlLifetime(requested, signed);
        expect(redisSeconds + browserSeconds).toBeLessThan(signed);
      }
    }
  });

  it('never returns a zero or negative Redis TTL', () => {
    // `SETEX` rejects a TTL of 0, so a very short signing window must still
    // produce a usable one rather than making every write throw.
    for (const signed of [1, 2, 5, 60]) {
      expect(clampToSignedUrlLifetime(300, signed).redisSeconds).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps the browser window shorter than the shared one', () => {
    // A published change reaches a returning visitor after one CDN purge, not
    // after their own browser cache happens to expire.
    for (const signed of SIGNED_URL_TTLS) {
      const { redisSeconds, browserSeconds } = clampToSignedUrlLifetime(600, signed);
      expect(browserSeconds).toBeLessThanOrEqual(redisSeconds);
    }
  });

  it('honours a request for less than the ceiling', () => {
    expect(clampToSignedUrlLifetime(60, 900).redisSeconds).toBe(60);
  });

  it('caps a request for more than the ceiling', () => {
    expect(clampToSignedUrlLifetime(100_000, 900).redisSeconds).toBe(360);
  });
});

describe('cacheKey', () => {
  it('is stable across parameter order', () => {
    // Two spellings of the same request must not occupy two cache entries —
    // one of them would go stale and nothing would ever purge it.
    expect(cacheKey({ path: '/api/v1/products', query: { page: '2', category: 'juice' } })).toBe(
      cacheKey({ path: '/api/v1/products', query: { category: 'juice', page: '2' } }),
    );
  });

  it('separates different parameters', () => {
    expect(cacheKey({ path: '/api/v1/products', query: { page: '1' } })).not.toBe(
      cacheKey({ path: '/api/v1/products', query: { page: '2' } }),
    );
    expect(cacheKey({ path: '/api/v1/news', query: {} })).not.toBe(
      cacheKey({ path: '/api/v1/products', query: {} }),
    );
  });

  it('handles a repeated parameter deterministically', () => {
    expect(cacheKey({ path: '/x', query: { tag: ['b', 'a'] } })).toBe(
      cacheKey({ path: '/x', query: { tag: ['a', 'b'] } }),
    );
  });

  it('omits an empty query entirely', () => {
    expect(cacheKey({ path: '/api/v1/products', query: {} })).toBe('/api/v1/products');
  });
});

describe('etagFor', () => {
  it('is stable for the same body and different for another', () => {
    expect(etagFor({ a: 1 })).toBe(etagFor({ a: 1 }));
    expect(etagFor({ a: 1 })).not.toBe(etagFor({ a: 2 }));
  });

  it('is quoted, as RFC 9110 requires', () => {
    expect(etagFor({ a: 1 })).toMatch(/^"[0-9a-f]{64}"$/);
  });

  it('survives an undefined body', () => {
    expect(() => etagFor(undefined)).not.toThrow();
  });
});

describe('isNotModified', () => {
  const etag = etagFor({ a: 1 });

  it('matches an exact tag', () => {
    expect(isNotModified({ headers: { 'if-none-match': etag } }, etag)).toBe(true);
  });

  it('matches a tag a proxy has weakened', () => {
    // Cloudflare weakens ETags on compressed responses. Comparing raw strings
    // would miss, and every revalidation would re-download the body.
    expect(isNotModified({ headers: { 'if-none-match': `W/${etag}` } }, etag)).toBe(true);
  });

  it('matches one tag out of a list', () => {
    expect(isNotModified({ headers: { 'if-none-match': `"other", ${etag}` } }, etag)).toBe(true);
  });

  it('matches the wildcard', () => {
    expect(isNotModified({ headers: { 'if-none-match': '*' } }, etag)).toBe(true);
  });

  it('does not match a different tag, or no header', () => {
    expect(isNotModified({ headers: { 'if-none-match': '"other"' } }, etag)).toBe(false);
    expect(isNotModified({ headers: {} }, etag)).toBe(false);
  });
});
