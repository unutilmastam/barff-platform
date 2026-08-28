import { getTranslations } from 'next-intl/server';
import { type PublicProduct } from '@barff/types';
import { Container } from '@/components/layout/container';
import { Link } from '@/i18n/navigation';
import { ProductCard } from '@/components/products/product-card';
import { ProductAccentScope } from '@/components/products/product-accent-scope';

/**
 * Product carousel (§4.4).
 *
 * A scroll-snap row on phones and a grid from `sm` up. Built on native
 * overflow scrolling rather than a carousel library, for three reasons: it
 * works before any JavaScript loads, it is operable by keyboard and by a
 * screen reader without extra ARIA, and it has no arrows to mis-hit at 360px.
 *
 * Wrapped in `ProductAccentScope`, so this row is what drives the page accent
 * (§17a) — by hover on a fine pointer, by viewport centre on a touch screen.
 */
export async function ProductCarousel({
  products,
  locale,
}: {
  products: PublicProduct[];
  locale: string;
}) {
  const t = await getTranslations('home');
  if (products.length === 0) return null;

  return (
    <Container
      as="section"
      className="py-sectionSm sm:py-section"
      aria-labelledby="products-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2
          id="products-heading"
          className="text-2xl font-bold tracking-tight text-content-primary sm:text-3xl"
        >
          {t('products.heading')}
        </h2>
        <Link
          href="/products"
          className="text-sm font-semibold text-accent-text underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('products.all')}
        </Link>
      </div>

      <ProductAccentScope
        className={[
          'mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2',
          // The scroll container disappears from `sm` up, where everything fits.
          'sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible lg:grid-cols-4',
        ].join(' ')}
      >
        {products.map((product, index) => (
          <div key={product.slug} className="w-[46%] shrink-0 snap-start sm:w-auto sm:shrink">
            <ProductCard product={product} locale={locale} priority={index < 2} />
          </div>
        ))}
      </ProductAccentScope>
    </Container>
  );
}
