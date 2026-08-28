import { type PublicProduct } from '@barff/types';
import { ProductCard } from './product-card';
import { ProductAccentScope } from './product-accent-scope';

/**
 * Responsive product grid.
 *
 * Two columns at 360px rather than one: a single column of square images makes
 * a phone visitor scroll past three products to see four, and the cards stay
 * above the 24px target minimum at that width.
 */
export function ProductGrid({
  products,
  locale,
  priorityCount = 2,
  headingLevel = 2,
}: {
  products: PublicProduct[];
  locale: string;
  /** How many images may preload. The rest are below the fold (§26). */
  priorityCount?: number;
  /** Card heading level. Defaults to `h2`: the grid follows the page `h1`. */
  headingLevel?: 2 | 3;
}) {
  return (
    <ProductAccentScope className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.slug}
          product={product}
          locale={locale}
          priority={index < priorityCount}
          headingLevel={headingLevel}
        />
      ))}
    </ProductAccentScope>
  );
}
