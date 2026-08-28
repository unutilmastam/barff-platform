import { type LocalizedText, type PartialLocalizedText } from './locale.js';

/**
 * The shapes the **public** API returns.
 *
 * Declared here rather than in either consumer so the API's mappers and the web
 * app's fetch layer are checked against one definition. Two hand-written copies
 * of a response shape drift silently: the API renames a field, the app keeps
 * compiling, and the page renders `undefined` — which looks like missing
 * content, not like a bug.
 *
 * Only *public* shapes live here. Admin responses carry `isActive`,
 * `publishedAt` and internal ids, and keeping them out of a package the web app
 * imports is one more reason a draft cannot leak into a public page.
 */

export interface PublicMediaVariant {
  label: string;
  url: string;
  width: number;
  height: number;
}

/** A resolved image: the original plus its generated sizes and blur placeholder. */
export interface PublicMedia {
  url: string;
  blurDataUrl: string | null;
  variants: PublicMediaVariant[];
}

export interface PublicProductImage extends PublicMedia {
  altText: PartialLocalizedText | null;
  isPrimary: boolean;
}

export interface PublicProductVariant {
  id: string;
  volumeMl: number;
  sku: string | null;
  barcode: string | null;
  nutrition: Record<string, unknown> | null;
}

export interface PublicProductDocument {
  kind: string;
  title: LocalizedText;
  filename: string;
  sizeBytes: number;
  mediaAssetId: string;
}

export interface PublicProductCategoryRef {
  slug: string;
  name: LocalizedText;
}

export interface PublicSeo {
  title?: PartialLocalizedText;
  description?: PartialLocalizedText;
}

export interface PublicProduct {
  id: string;
  slug: string;
  name: LocalizedText;
  shortDescription: PartialLocalizedText | null;
  description: PartialLocalizedText | null;
  ingredients: PartialLocalizedText | null;
  storage: PartialLocalizedText | null;
  flavor: string | null;
  shelfLifeDays: number | null;
  seo: PublicSeo | null;
  category: PublicProductCategoryRef | null;
  variants: PublicProductVariant[];
  images: PublicProductImage[];
  documents: PublicProductDocument[];
}

export interface PublicProductCategory {
  id: string;
  slug: string;
  name: LocalizedText;
  description: PartialLocalizedText | null;
  parentId: string | null;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface PublicNewsArticle {
  slug: string;
  title: LocalizedText;
  excerpt: PartialLocalizedText | null;
  body: PartialLocalizedText | null;
  seo: PublicSeo | null;
  publishedAt: string | null;
  coverImage: PublicMedia | null;
}

export interface PublicCertificate {
  id: string;
  title: LocalizedText;
  description: PartialLocalizedText | null;
  issuer: string | null;
  certificateNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  image: PublicMedia | null;
  document: PublicMedia | null;
}

export interface PublicProductionStep {
  key: string;
  name: LocalizedText;
  description: PartialLocalizedText | null;
  displayOrder: number;
  image: PublicMedia | null;
}

export const PAGE_SECTION_TYPES = ['HERO', 'RICH_TEXT', 'STATS', 'MEDIA', 'CTA'] as const;
export type PageSectionType = (typeof PAGE_SECTION_TYPES)[number];

export interface PublicPageSection {
  key: string;
  type: PageSectionType;
  heading: LocalizedText | null;
  subheading: PartialLocalizedText | null;
  body: PartialLocalizedText | null;
  ctaLabel: LocalizedText | null;
  ctaHref: string | null;
  /**
   * Type-specific payload, shaped per section type by the page that renders it.
   * Deliberately `unknown`: the API does not validate it (D-010), so the
   * consumer must narrow rather than trust.
   */
  data: unknown;
  media: PublicMedia | null;
}

export interface PublicGalleryItem {
  id: string;
  title: PartialLocalizedText | null;
  caption: PartialLocalizedText | null;
  category: string;
  altText: PartialLocalizedText | null;
  image: PublicMedia | null;
}

export interface PublicDocument {
  id: string;
  title: LocalizedText;
  description: PartialLocalizedText | null;
  kind: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
}
