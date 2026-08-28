import {
  type LocalizedText,
  type PartialLocalizedText,
  type PublicProduct,
  type PublicSeo,
} from '@barff/types';
import { type Prisma } from '../../generated/prisma/index.js';
import { type ResolveMedia } from '../media/media-resolver.service.js';

/**
 * Shapes a product row for a response.
 *
 * Two mappers, not one with a flag. The public shape must never gain a field by
 * accident — an admin-only column added later would otherwise appear on
 * barff.uz the moment somebody extends the shared mapper (`CLAUDE.md` §11: no
 * internal fields leaked).
 */

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    variants: true;
    images: { include: { mediaAsset: true } };
    documents: { include: { mediaAsset: true } };
  };
}>;

/**
 * Prisma types every JSON column as `JsonValue`, which cannot be narrowed
 * structurally. The shapes are ours — written through validated DTOs in this
 * same module — so these casts assert what the write path already enforced,
 * in one place rather than at every field.
 */
const localized = (value: Prisma.JsonValue): LocalizedText => value as unknown as LocalizedText;
const partial = (value: Prisma.JsonValue): PartialLocalizedText | null =>
  (value ?? null) as unknown as PartialLocalizedText | null;

/**
 * The return type is the shared `PublicProduct`, not an inferred object.
 *
 * That is what makes the contract real: renaming a field here stops compiling
 * against the type the web app fetches with, instead of quietly rendering
 * `undefined` on a page — which looks like missing content, not a bug.
 */
export function toPublicProduct(
  product: ProductWithRelations,
  resolveImage: ResolveMedia,
): PublicProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: localized(product.name),
    shortDescription: partial(product.shortDescription),
    description: partial(product.description),
    ingredients: partial(product.ingredients),
    storage: partial(product.storage),
    flavor: product.flavor,
    shelfLifeDays: product.shelfLifeDays,
    seo: (product.seo ?? null) as PublicSeo | null,
    category:
      product.category === null
        ? null
        : { slug: product.category.slug, name: localized(product.category.name) },
    // Inactive variants are dropped, not marked: the public site should not
    // show a size that cannot be ordered.
    variants: product.variants
      .filter((variant) => variant.isActive && variant.deletedAt === null)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((variant) => ({
        id: variant.id,
        volumeMl: variant.volumeMl,
        sku: variant.sku,
        barcode: variant.barcode,
        nutrition: (variant.nutrition ?? null) as Record<string, unknown> | null,
      })),
    images: product.images
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.displayOrder - b.displayOrder)
      .map((image) => ({
        altText: partial(image.altText ?? image.mediaAsset.altText),
        isPrimary: image.isPrimary,
        ...(resolveImage(image.mediaAssetId) ?? {
          url: '',
          blurDataUrl: null,
          variants: [],
        }),
      })),
    documents: product.documents
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((document) => ({
        kind: document.kind,
        title: localized(document.title),
        filename: document.mediaAsset.originalFilename,
        sizeBytes: document.mediaAsset.sizeBytes,
        mediaAssetId: document.mediaAssetId,
      })),
  };
}

export function toAdminProduct(product: ProductWithRelations) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    ingredients: product.ingredients,
    storage: product.storage,
    flavor: product.flavor,
    shelfLifeDays: product.shelfLifeDays,
    seo: product.seo,
    categoryId: product.categoryId,
    isActive: product.isActive,
    publishedAt: product.publishedAt?.toISOString() ?? null,
    displayOrder: product.displayOrder,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    // Admins see inactive variants — that is how they get re-enabled.
    variants: product.variants
      .filter((variant) => variant.deletedAt === null)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((variant) => ({
        id: variant.id,
        volumeMl: variant.volumeMl,
        sku: variant.sku,
        barcode: variant.barcode,
        packSize: variant.packSize,
        nutrition: variant.nutrition,
        isActive: variant.isActive,
        displayOrder: variant.displayOrder,
      })),
    images: product.images.map((image) => ({
      id: image.id,
      mediaAssetId: image.mediaAssetId,
      altText: image.altText,
      isPrimary: image.isPrimary,
      displayOrder: image.displayOrder,
    })),
    documents: product.documents.map((document) => ({
      id: document.id,
      mediaAssetId: document.mediaAssetId,
      kind: document.kind,
      title: document.title,
      displayOrder: document.displayOrder,
    })),
  };
}

export const PRODUCT_INCLUDE = {
  category: true,
  variants: true,
  images: { include: { mediaAsset: true } },
  documents: { include: { mediaAsset: true } },
} as const;
