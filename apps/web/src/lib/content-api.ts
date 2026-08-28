import {
  type PublicCertificate,
  type PublicNewsArticle,
  type PublicPageSection,
  type PublicProduct,
  type PublicProductCategory,
  type PublicProductionStep,
  type PaginatedResult,
} from '@barff/types';

/**
 * Server-side reader for the public API.
 *
 * Two rules, both learned from what a build actually does:
 *
 * 1. **Nothing here throws.** A page that cannot reach the API must render its
 *    empty state, not a 500. The API is a separate deployment; a rolling
 *    restart of it should degrade barff.uz, never take it down.
 * 2. **The build must not need a live API.** CI builds with nothing running, so
 *    `generateStaticParams` returning an empty list has to be a normal outcome
 *    rather than a failure. Pages are then rendered on demand and cached.
 *
 * The API's own Redis layer (S11) already caches these responses, so
 * `revalidate` here is the second tier: how long a *rendered page* may be
 * reused, not how long the data may be stale.
 */
const DEFAULT_BASE_URL = 'http://localhost:4000/api/v1';

/**
 * Server-side calls prefer an internal address.
 *
 * `NEXT_PUBLIC_API_URL` is the browser's route to the API — through Cloudflare
 * and the load balancer. Rendering on the server should not take that hop, and
 * in a private subnet it may not be able to.
 */
function baseUrl(): string {
  return process.env['API_INTERNAL_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? DEFAULT_BASE_URL;
}

export type Fetched<T> = { ok: true; data: T } | { ok: false };

const MISS = { ok: false } as const;

async function getPublic<T>(path: string, revalidateSeconds: number): Promise<Fetched<T>> {
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      // `revalidate` rather than `no-store`: these pages are the same for every
      // visitor, and rendering them per request would put the database behind a
      // marketing site.
      next: { revalidate: revalidateSeconds },
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return MISS;
    return { ok: true, data: (await response.json()) as T };
  } catch {
    // Connection refused, DNS failure, timeout. Logged by the platform; the
    // page renders without this section.
    return MISS;
  }
}

/** Page shells change rarely and are cheap to re-render. */
const CONTENT_TTL = 300;
const PRODUCT_TTL = 300;
const NEWS_TTL = 180;

export async function fetchProducts(params: {
  pageSize?: number;
  category?: string;
}): Promise<Fetched<PaginatedResult<PublicProduct>>> {
  const query = new URLSearchParams();
  if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  if (params.category !== undefined) query.set('category', params.category);
  const suffix = query.size === 0 ? '' : `?${query.toString()}`;
  return getPublic<PaginatedResult<PublicProduct>>(`/products${suffix}`, PRODUCT_TTL);
}

export async function fetchProduct(slug: string): Promise<Fetched<PublicProduct>> {
  return getPublic<PublicProduct>(`/products/${encodeURIComponent(slug)}`, PRODUCT_TTL);
}

export async function fetchProductCategories(): Promise<Fetched<PublicProductCategory[]>> {
  return getPublic<PublicProductCategory[]>('/products/categories', PRODUCT_TTL);
}

export async function fetchNews(
  pageSize: number,
): Promise<Fetched<PaginatedResult<PublicNewsArticle>>> {
  return getPublic<PaginatedResult<PublicNewsArticle>>(`/news?pageSize=${pageSize}`, NEWS_TTL);
}

export async function fetchCertificates(): Promise<Fetched<PublicCertificate[]>> {
  return getPublic<PublicCertificate[]>('/content/certificates', CONTENT_TTL);
}

export async function fetchProductionSteps(): Promise<Fetched<PublicProductionStep[]>> {
  return getPublic<PublicProductionStep[]>('/content/production-steps', CONTENT_TTL);
}

export async function fetchPageSections(page: string): Promise<Fetched<PublicPageSection[]>> {
  return getPublic<PublicPageSection[]>(`/content/sections/${page}`, CONTENT_TTL);
}

/** Convenience: the list, or an empty one. Most callers want exactly this. */
export const listOr = <T>(result: Fetched<T[]>, fallback: T[] = []): T[] =>
  result.ok ? result.data : fallback;

export const itemsOr = <T>(result: Fetched<PaginatedResult<T>>): T[] =>
  result.ok ? result.data.items : [];

/** Finds a seeded section by key, so a page can render it or fall back. */
export const sectionByKey = (
  sections: PublicPageSection[],
  key: string,
): PublicPageSection | undefined => sections.find((section) => section.key === key);
