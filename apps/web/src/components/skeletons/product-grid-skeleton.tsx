import { useTranslations } from 'next-intl';

/**
 * Loading state for the catalogue grid.
 *
 * A `<Suspense>` fallback inside the page rather than a `loading.tsx` beside
 * it, and the difference is not cosmetic. A route-level `loading.tsx` makes
 * Next stream the whole response, and a streamed page emits its
 * `<meta name="description">` into the **body** instead of `<head>` — verified
 * in a browser, on every user agent, including the crawler path. The same
 * boundary also sends the 200 status line before the page can call
 * `notFound()`, which turned every draft product URL into a soft 404.
 *
 * Scoped here, the page shell and its metadata resolve normally and only the
 * grid streams. The skeleton matches the real grid — two columns on a phone,
 * four on a desktop, square tiles — so nothing moves when the products land
 * (§26: no layout shift caused by loading).
 */
export function ProductGridSkeleton() {
  const t = useTranslations('common');

  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="rounded-lg border border-border bg-surface-raised p-4">
            <div className="aspect-square w-full animate-pulse rounded bg-surface-overlay" />
            <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-surface-overlay" />
            <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-surface-overlay" />
          </div>
        ))}
      </div>
    </div>
  );
}
