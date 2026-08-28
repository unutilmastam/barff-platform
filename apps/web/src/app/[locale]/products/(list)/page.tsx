import { Suspense } from 'react';
import { type Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchProductCategories, fetchProducts, itemsOr, listOr } from '@/lib/content-api';
import { Container } from '@/components/layout/container';
import { ProductGrid } from '@/components/products/product-grid';
import { Link } from '@/i18n/navigation';
import { ProductGridSkeleton } from '@/components/skeletons/product-grid-skeleton';
import { text } from '@/lib/localized';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'products' });
  return { title: t('title'), description: t('intro') };
}

/**
 * `/products` (§4).
 *
 * Category filtering is a link per category rather than a JavaScript control:
 * each filtered view gets its own URL, so it can be shared, indexed and cached
 * by S11 — and it works before hydration.
 */
export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  const { category } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('products');

  // Only the category list is awaited here. The grid streams inside its own
  // Suspense boundary below, so the page shell — heading, filters and, crucially,
  // the document metadata — resolves and flushes first.
  const categoryList = listOr(await fetchProductCategories());

  return (
    <Container as="section" className="py-sectionSm sm:py-section">
      <h1 className="text-4xl font-bold tracking-tight text-content-primary sm:text-5xl">
        {t('title')}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-content-secondary">{t('intro')}</p>

      {categoryList.length > 0 && (
        <nav aria-label={t('filterLabel')} className="mt-8">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href="/products"
                aria-current={category === undefined ? 'page' : undefined}
                className={filterClass(category === undefined)}
              >
                {t('allCategories')}
              </Link>
            </li>
            {categoryList.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/products?category=${encodeURIComponent(item.slug)}`}
                  aria-current={category === item.slug ? 'page' : undefined}
                  className={filterClass(category === item.slug)}
                >
                  {text(item.name, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-10">
        <Suspense
          // Keyed on the filter so switching category shows the skeleton again
          // rather than the previous category's products under a new heading.
          key={category ?? 'all'}
          fallback={<ProductGridSkeleton />}
        >
          <CatalogueGrid locale={locale} category={category} />
        </Suspense>
      </div>
    </Container>
  );
}

/**
 * The grid itself, so the fetch happens below the Suspense boundary.
 */
async function CatalogueGrid({
  locale,
  category,
}: {
  locale: string;
  category: string | undefined;
}) {
  const t = await getTranslations('products');
  const products = await fetchProducts({
    pageSize: 48,
    ...(category === undefined ? {} : { category }),
  });
  const items = itemsOr(products);

  if (items.length === 0) {
    // Empty state, not a blank page. It is also what a visitor sees if the API
    // is unreachable, which is why it reads as "nothing here yet" rather than
    // as an error.
    return (
      <p className="rounded-lg border border-border bg-surface-glass p-6 text-content-secondary">
        {t('empty')}
      </p>
    );
  }

  return <ProductGrid products={items} locale={locale} priorityCount={4} />;
}

const filterClass = (active: boolean) =>
  [
    // 24px minimum target (WCAG 2.2 SC 2.5.8) — py-1.5 on a 14px line clears it.
    'inline-block rounded-full border px-4 py-1.5 text-sm transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    active
      ? 'border-accent bg-accent-soft text-content-primary'
      : 'border-border text-content-secondary hover:border-border-strong hover:text-content-primary',
  ].join(' ');
