import { SetMetadata } from '@nestjs/common';

/**
 * Cache generations, one per body of content that changes together.
 *
 * Finer than "everything public" so that publishing a news article does not
 * throw away the product catalogue, and coarser than one entry per route so
 * that a write never has to know which URLs it affected.
 */
export const CacheNamespace = {
  PRODUCTS: 'products',
  NEWS: 'news',
  CERTIFICATES: 'certificates',
  GALLERY: 'gallery',
  DOCUMENTS: 'documents',
  SECTIONS: 'sections',
  PRODUCTION_STEPS: 'production-steps',
  SEO: 'seo',
  SETTINGS: 'settings',
} as const;
export type CacheNamespace = (typeof CacheNamespace)[keyof typeof CacheNamespace];

export const ALL_CACHE_NAMESPACES = Object.values(CacheNamespace);

export const PUBLIC_CACHE_KEY = 'barff:publicCache';

export interface PublicCacheOptions {
  namespace: CacheNamespace;
  /** Seconds the rendered response may be reused. Clamped — see cache.service.ts. */
  ttlSeconds: number;
}

/**
 * Marks a public GET as cacheable.
 *
 * Opt-in, never inferred. A route is cached because somebody decided its
 * response is the same for every visitor and named how stale it may get — not
 * because it happened to be annotated `@Public()`. The inverse default is how
 * personalised data ends up in a shared CDN.
 */
export const PublicCache = (options: PublicCacheOptions) => SetMetadata(PUBLIC_CACHE_KEY, options);

export const INVALIDATES_CACHE_KEY = 'barff:invalidatesCache';

/**
 * Retires one or more namespaces after any successful write on this controller.
 *
 * Declared once per admin controller rather than called from each write method.
 * Both work; this one cannot be forgotten when a route is added later, and
 * "somebody adds an endpoint and forgets to purge" is the failure mode that
 * makes a cache untrustworthy — stale content nobody can explain.
 */
export const InvalidatesCache = (...namespaces: CacheNamespace[]) =>
  SetMetadata(INVALIDATES_CACHE_KEY, namespaces);
