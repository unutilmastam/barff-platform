import Image from 'next/image';
import { type PublicMedia } from '@barff/types';

/**
 * A product or content image, or an honest placeholder.
 *
 * BARFF has not supplied approved production photography yet — the committed
 * bottle renders are AI mockups that ASSETS.md §5 warns against using at
 * full-page size (Q-022), and the media library is empty until the client
 * uploads. So "no image" is the normal case today, and it renders as a plain
 * surface rather than a broken frame or a stock photo standing in for a fact.
 */
export function MediaImage({
  media,
  alt,
  sizes,
  priority = false,
  className,
  fill = true,
}: {
  media: PublicMedia | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  fill?: boolean;
}) {
  if (!media?.url) {
    // `aria-hidden`: an empty frame communicates nothing, and announcing it
    // would only add noise for a screen reader.
    return <div aria-hidden="true" className={className ?? 'h-full w-full bg-surface-inset'} />;
  }

  return (
    <Image
      src={media.url}
      alt={alt}
      fill={fill}
      sizes={sizes}
      // The hero and the first cards are the LCP element; everything else waits
      // (§26: usable content paints before decoration).
      priority={priority}
      className={className ?? 'object-contain'}
      {...(media.blurDataUrl === null
        ? {}
        : { placeholder: 'blur' as const, blurDataURL: media.blurDataUrl })}
    />
  );
}
