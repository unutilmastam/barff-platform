import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { ImageProcessorService, VARIANT_WIDTHS } from './image-processor.service.js';

const processor = new ImageProcessorService();

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 46, g: 182, b: 106 } },
  })
    .jpeg()
    .toBuffer();
}

describe('ImageProcessorService', () => {
  let large: Buffer;

  beforeAll(async () => {
    large = await makeJpeg(1600, 1200);
  }, 30_000);

  it('reports the original dimensions', async () => {
    const result = await processor.process(large);
    expect(result.width).toBe(1600);
    expect(result.height).toBe(1200);
  });

  it('re-encodes the original to WebP', async () => {
    const result = await processor.process(large);
    expect(result.normalizedMimeType).toBe('image/webp');
    expect((await sharp(result.normalized).metadata()).format).toBe('webp');
  });

  it('strips EXIF, so a factory photo does not publish its GPS coordinates', async () => {
    // The privacy claim in the service docstring, asserted. Phone cameras write
    // location and device identifiers into every photo, and nobody uploading a
    // production-line picture intends to publish where they were standing.
    const withExif = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .withExif({ IFD0: { Copyright: 'BARFF', Artist: 'test-camera' } })
      .jpeg()
      .toBuffer();

    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const result = await processor.process(withExif);
    expect((await sharp(result.normalized).metadata()).exif).toBeUndefined();
  }, 30_000);

  it('produces an inline blur placeholder small enough to sit in the HTML', async () => {
    const result = await processor.process(large);
    expect(result.blurDataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    // A placeholder that costs kilobytes defeats its own purpose.
    expect(result.blurDataUrl.length).toBeLessThan(2000);
  });

  it('emits both AVIF and WebP for every applicable width', async () => {
    const result = await processor.process(large);
    for (const width of VARIANT_WIDTHS) {
      expect(
        result.variants.some((v) => v.label === `${width}.avif`),
        `${width}.avif`,
      ).toBe(true);
      expect(
        result.variants.some((v) => v.label === `${width}.webp`),
        `${width}.webp`,
      ).toBe(true);
    }
  }, 60_000);

  it('never upscales — an enlarged image is bigger and looks worse', async () => {
    const small = await makeJpeg(300, 200);
    const result = await processor.process(small);
    for (const variant of result.variants) {
      expect(variant.width, variant.label).toBeLessThanOrEqual(300);
    }
  }, 30_000);

  it('still produces a rendition for an image below every breakpoint', async () => {
    // Otherwise a consumer has nothing to point at.
    const tiny = await makeJpeg(120, 90);
    const result = await processor.process(tiny);
    expect(result.variants.length).toBeGreaterThan(0);
    expect(result.variants.every((v) => v.label.startsWith('original.'))).toBe(true);
  }, 30_000);

  it('makes variants meaningfully smaller than the source', async () => {
    const result = await processor.process(large);
    const smallest = result.variants.find((v) => v.label === '200.avif');
    expect(smallest).toBeDefined();
    expect(smallest!.sizeBytes).toBeLessThan(large.length);
  }, 60_000);

  it('rejects a decompression bomb rather than trying to decode it', async () => {
    // A few kilobytes that expand to an enormous bitmap. A byte-size limit
    // alone does not catch this — the file is small, the decode is not.
    const bomb = await sharp({
      create: { width: 12_000, height: 12_000, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    // 144M pixels is over the 50M ceiling.
    await expect(processor.process(bomb)).rejects.toThrow();
  }, 120_000);

  it('rejects bytes that are not a decodable image', async () => {
    await expect(processor.process(Buffer.from('not an image', 'utf8'))).rejects.toThrow();
  });
});
