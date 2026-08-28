import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Variant widths.
 *
 * Taken from what `ASSETS.md` says the site actually renders: 200px for dealer
 * cart line items, 600px for the `/products` grid, 800px for the home carousel,
 * 1200px for a product detail page. Generating sizes nothing requests is wasted
 * storage and wasted processing time on every upload.
 */
export const VARIANT_WIDTHS = [200, 600, 800, 1200] as const;

/** Formats every derived variant is produced in (§26: AVIF/WebP). */
export const VARIANT_FORMATS = ['avif', 'webp'] as const;
export type VariantFormat = (typeof VARIANT_FORMATS)[number];

export interface ImageVariant {
  /** e.g. `600.webp` — the label a consumer picks by. */
  label: string;
  format: VariantFormat;
  width: number;
  height: number;
  sizeBytes: number;
  body: Buffer;
}

export interface ProcessedImage {
  /** Re-encoded original, stripped of metadata. */
  normalized: Buffer;
  normalizedMimeType: string;
  width: number;
  height: number;
  /** Inline base64 preview for `next/image` placeholder="blur". */
  blurDataUrl: string;
  variants: ImageVariant[];
}

/**
 * Largest image this will decode, in pixels.
 *
 * A byte-size limit is not enough on its own: a "decompression bomb" is a few
 * kilobytes of PNG that expands to tens of gigabytes in memory. sharp is told
 * the ceiling so it refuses rather than trying.
 */
const MAX_PIXELS = 50_000_000;

@Injectable()
export class ImageProcessorService {
  /**
   * Re-encodes an image and derives its variants.
   *
   * Every image is re-encoded rather than stored as received. That does two
   * things beyond producing variants:
   *
   * - **Strips metadata.** EXIF travels with photographs, and factory or
   *     delivery photos carry GPS coordinates and device identifiers that
   *     nobody intended to publish.
   * - **Neutralises polyglots.** A file crafted to be a valid image *and* a
   *     valid script stops being the second thing once it has been decoded and
   *     written back out from pixels.
   */
  async process(input: Buffer): Promise<ProcessedImage> {
    const pipeline = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error' });
    const metadata = await pipeline.metadata();

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width === 0 || height === 0) {
      throw new Error('Image has no readable dimensions');
    }

    // `rotate()` with no argument applies the EXIF orientation, then the
    // metadata is dropped. Skipping it leaves phone photos sideways for
    // everyone, because the tag they relied on is gone.
    const normalized = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .webp({ quality: 90 })
      .toBuffer();

    const blurDataUrl = await this.buildBlurPlaceholder(input);
    const variants = await this.buildVariants(input, width);

    return {
      normalized,
      normalizedMimeType: 'image/webp',
      width,
      height,
      blurDataUrl,
      variants,
    };
  }

  /**
   * A 16px-wide WebP, inlined as a data URL.
   *
   * Small enough to sit in the HTML without measurably affecting page weight,
   * which is the point: the placeholder has to arrive with the markup, or the
   * image it is covering for has already loaded.
   */
  private async buildBlurPlaceholder(input: Buffer): Promise<string> {
    const buffer = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize(16, 16, { fit: 'inside' })
      .webp({ quality: 40 })
      .toBuffer();

    return `data:image/webp;base64,${buffer.toString('base64')}`;
  }

  private async buildVariants(input: Buffer, originalWidth: number): Promise<ImageVariant[]> {
    const variants: ImageVariant[] = [];

    for (const targetWidth of VARIANT_WIDTHS) {
      // Never upscale. Enlarging a 400px image to 1200px produces a bigger file
      // that looks worse than the original.
      if (targetWidth > originalWidth) continue;

      for (const format of VARIANT_FORMATS) {
        const pipeline = sharp(input, { limitInputPixels: MAX_PIXELS })
          .rotate()
          .resize(targetWidth, undefined, { withoutEnlargement: true });

        const body =
          format === 'avif'
            ? await pipeline.avif({ quality: 55 }).toBuffer()
            : await pipeline.webp({ quality: 80 }).toBuffer();

        const meta = await sharp(body).metadata();
        variants.push({
          label: `${targetWidth}.${format}`,
          format,
          width: meta.width ?? targetWidth,
          height: meta.height ?? 0,
          sizeBytes: body.length,
          body,
        });
      }
    }

    // An image smaller than every breakpoint still needs one rendition, or the
    // consumer has nothing to point at.
    if (variants.length === 0) {
      for (const format of VARIANT_FORMATS) {
        const pipeline = sharp(input, { limitInputPixels: MAX_PIXELS }).rotate();
        const body =
          format === 'avif'
            ? await pipeline.avif({ quality: 55 }).toBuffer()
            : await pipeline.webp({ quality: 80 }).toBuffer();
        const meta = await sharp(body).metadata();
        variants.push({
          label: `original.${format}`,
          format,
          width: meta.width ?? originalWidth,
          height: meta.height ?? 0,
          sizeBytes: body.length,
          body,
        });
      }
    }

    return variants;
  }
}
