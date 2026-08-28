import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchProduct, fetchProducts, itemsOr } from '@/lib/content-api';
import { routing } from '@/i18n/routing';
import { Container } from '@/components/layout/container';
import { MediaImage } from '@/components/media/media-image';
import { hasText, text } from '@/lib/localized';

/**
 * Pre-renders the products that exist at build time.
 *
 * An empty list is a normal outcome, not a failure: CI builds with no API
 * running. `dynamicParams` (Next's default) then renders any slug on demand and
 * caches it, so the site is correct either way — and the build never depends on
 * a separate deployment being up.
 */
export async function generateStaticParams() {
  const products = await fetchProducts({ pageSize: 100 });
  return routing.locales.flatMap((locale) =>
    itemsOr(products).map((product) => ({ locale, slug: product.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const result = await fetchProduct(slug);
  if (!result.ok) return {};

  const product = result.data;
  const title = text(product.seo?.title, locale) || text(product.name, locale);
  const description =
    text(product.seo?.description, locale) || text(product.shortDescription, locale);

  return {
    title,
    ...(description === '' ? {} : { description }),
    // Full Open Graph, canonical and hreflang are S15. Nothing fabricated here:
    // both values come from the record.
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('products');

  const result = await fetchProduct(slug);
  // A draft and a slug that never existed are the same 404 from the API (S09),
  // and they are the same 404 here.
  if (!result.ok) notFound();

  const product = result.data;
  const name = text(product.name, locale);
  const primary = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const gallery = product.images.filter((image) => image !== primary);

  return (
    <Container as="article" className="py-sectionSm sm:py-section">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface-raised">
            <MediaImage
              media={primary ?? null}
              alt={text(primary?.altText, locale) || name}
              sizes="(min-width: 1024px) 50vw, 100vw"
              // The product photo is the LCP element on this page, so it is the
              // one image allowed to preload (§26).
              priority
            />
          </div>

          {gallery.length > 0 && (
            <ul className="mt-4 grid grid-cols-4 gap-3">
              {gallery.map((image) => (
                <li
                  key={image.url}
                  className="relative aspect-square overflow-hidden rounded border border-border bg-surface-raised"
                >
                  <MediaImage
                    media={image}
                    alt={text(image.altText, locale) || name}
                    sizes="25vw"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {product.category !== null && (
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">
              {text(product.category.name, locale)}
            </p>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-content-primary sm:text-4xl">
            {name}
          </h1>

          {hasText(product.shortDescription, locale) && (
            <p className="mt-4 text-lg text-content-secondary">
              {text(product.shortDescription, locale)}
            </p>
          )}
          {hasText(product.description, locale) && (
            <p className="mt-4 text-content-secondary">{text(product.description, locale)}</p>
          )}

          {product.variants.length > 0 && (
            <section className="mt-8" aria-labelledby="variants-heading">
              <h2 id="variants-heading" className="text-sm font-semibold text-content-primary">
                {t('variants')}
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <li
                    key={variant.id}
                    className="rounded-full border border-border px-4 py-1.5 text-sm text-content-secondary"
                  >
                    {t('volume', { volume: variant.volumeMl })}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/*
            Ingredients, nutrition, storage and shelf life are legally required
            on a published product page and BARFF has not supplied them (Q-016).
            Each block appears only when its field is filled in — the page never
            invents one, and never shows an empty heading either.
          */}
          <dl className="mt-8 space-y-4">
            {hasText(product.ingredients, locale) && (
              <Detail term={t('ingredients')}>{text(product.ingredients, locale)}</Detail>
            )}
            {hasText(product.storage, locale) && (
              <Detail term={t('storage')}>{text(product.storage, locale)}</Detail>
            )}
            {product.shelfLifeDays !== null && (
              <Detail term={t('shelfLife')}>{t('days', { count: product.shelfLifeDays })}</Detail>
            )}
          </dl>

          {product.documents.length > 0 && (
            <section className="mt-8" aria-labelledby="documents-heading">
              <h2 id="documents-heading" className="text-sm font-semibold text-content-primary">
                {t('documents')}
              </h2>
              <ul className="mt-3 space-y-2">
                {product.documents.map((document) => (
                  <li key={document.mediaAssetId} className="text-sm text-content-secondary">
                    {text(document.title, locale)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </Container>
  );
}

function Detail({ term, children }: { term: string; children: string }) {
  return (
    <div className="border-t border-border-subtle pt-4">
      <dt className="text-sm font-semibold text-content-primary">{term}</dt>
      <dd className="mt-1 text-sm text-content-secondary">{children}</dd>
    </div>
  );
}
