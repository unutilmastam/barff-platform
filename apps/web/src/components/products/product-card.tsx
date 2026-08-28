import { getTranslations } from 'next-intl/server';
import { type PublicProduct } from '@barff/types';
import { Link } from '@/i18n/navigation';
import { MediaImage } from '@/components/media/media-image';
import { text } from '@/lib/localized';
import { accentTargetProps } from '@/lib/product-accent';

/**
 * One product in a grid or carousel.
 *
 * The whole card is a single link rather than a card containing a link: a
 * clickable div with a nested anchor gives a keyboard user one target and a
 * mouse user another, and screen readers announce the wrong thing.
 */
export async function ProductCard({
  product,
  locale,
  priority = false,
  headingLevel = 3,
}: {
  product: PublicProduct;
  locale: string;
  priority?: boolean;
  /**
   * Where this card sits in the document outline.
   *
   * A grid that follows the page's `h1` directly must use `h2`; the same card
   * inside the homepage carousel sits under that section's `h2` and must use
   * `h3`. Hard-coding either one skips a level on the other page, which is a
   * real navigation problem for a screen-reader user moving by heading — and
   * what Lighthouse flagged as `heading-order` on /products.
   */
  headingLevel?: 2 | 3;
}) {
  const t = await getTranslations('products');
  const Heading = (headingLevel === 2 ? 'h2' : 'h3') as 'h2' | 'h3';
  const name = text(product.name, locale);
  const primary = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const volumes = product.variants.map((variant) => variant.volumeMl);

  return (
    <Link
      href={`/products/${product.slug}`}
      // The slug drives the page accent while this card is hovered or centred.
      {...accentTargetProps(product.slug)}
      className="group flex h-full flex-col rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded">
        {/* The glow is the only thing the product accent drives here — never the
            border, the text or the surface (§17a). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-slow group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 55%, var(--barff-accent-glow) 0%, transparent 70%)',
            filter: 'blur(24px)',
          }}
        />
        <MediaImage
          media={primary ?? null}
          alt={text(primary?.altText, locale) || name}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          priority={priority}
          className="relative object-contain"
        />
      </div>

      <Heading className="mt-4 text-base font-semibold text-content-primary">{name}</Heading>
      {volumes.length > 0 && (
        <p className="mt-1 text-sm text-content-muted">
          {volumes.map((volume) => t('volume', { volume })).join(' · ')}
        </p>
      )}
    </Link>
  );
}
