import { Injectable } from '@nestjs/common';
import { MediaService } from './media.service.js';

export interface ResolvedMedia {
  url: string;
  blurDataUrl: string | null;
  variants: { label: string; url: string; width: number; height: number }[];
}

/** Looks a resolved asset up by id. Synchronous, so mappers stay pure. */
export type ResolveMedia = (mediaAssetId: string | null | undefined) => ResolvedMedia | undefined;

/**
 * Resolves every media id a response needs, once, up front.
 *
 * Signing a URL from inside a mapper would be one round trip per image, which
 * on a listing page is the difference between one lookup and thirty. Callers
 * gather their ids, resolve them together, and hand the returned lookup to the
 * mapper.
 *
 * Shared by products and content rather than copied into each: two
 * implementations of "turn an id into URLs" is two places for the signing rules
 * to drift apart.
 */
@Injectable()
export class MediaResolverService {
  constructor(private readonly media: MediaService) {}

  async resolve(ids: readonly (string | null | undefined)[]): Promise<ResolveMedia> {
    const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
    const resolved = new Map<string, ResolvedMedia>();

    for (const id of unique) {
      try {
        const asset = await this.media.findOne(id);
        resolved.set(id, {
          url: asset.url,
          blurDataUrl: asset.blurDataUrl ?? null,
          variants: asset.variants.map((variant) => ({
            label: variant.label,
            url: variant.url,
            width: variant.width,
            height: variant.height,
          })),
        });
      } catch {
        // A deleted or unreadable asset must not take the whole page down. It
        // is simply absent from the response, and the caller renders without it.
      }
    }

    return (mediaAssetId) =>
      typeof mediaAssetId === 'string' ? resolved.get(mediaAssetId) : undefined;
  }
}
