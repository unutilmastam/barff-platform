import { type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * Aspect-ratio container for product and factory imagery.
 *
 * Reserving the box before the image loads is what keeps CLS at zero (§26) —
 * an image that pushes the page down as it arrives is the single most common
 * cause of layout shift.
 *
 * The ratios match what `ASSETS.md` describes: product renders are 1254×1254
 * squares, and the hero needs a wide composition with no text burned in,
 * because headlines must stay translatable HTML.
 *
 * This does not render an `<img>` itself — the consumer passes `next/image`,
 * so the app keeps control of loader, sizes and priority.
 */
export const mediaFrameVariants = cva(
  'relative overflow-hidden bg-surface-inset [&>img]:size-full [&>img]:object-cover',
  {
    variants: {
      ratio: {
        square: 'aspect-square',
        portrait: 'aspect-[3/4]',
        video: 'aspect-video',
        wide: 'aspect-[21/9]',
      },
      rounded: { none: '', sm: 'rounded', md: 'rounded-lg' },
      bordered: { true: 'border border-border' },
      /** Product renders sit on a light background; a plate keeps them legible. */
      plate: { true: 'bg-white' },
    },
    defaultVariants: { ratio: 'square', rounded: 'md', bordered: true },
  },
);

export interface MediaFrameProps extends VariantProps<typeof mediaFrameVariants> {
  children: ReactNode;
  /**
   * Caption or credit, rendered under the frame.
   *
   * Not a replacement for the image's own `alt` — a caption is read by
   * everyone, `alt` is read instead of the image.
   */
  caption?: string;
  className?: string;
}

export function MediaFrame({
  children,
  ratio,
  rounded,
  bordered,
  plate,
  caption,
  className,
}: MediaFrameProps) {
  const frame = (
    <div className={cn(mediaFrameVariants({ ratio, rounded, bordered, plate }), className)}>
      {children}
    </div>
  );

  if (caption === undefined) return frame;

  return (
    <figure className="flex flex-col gap-2">
      {frame}
      <figcaption className="text-xs text-content-muted">{caption}</figcaption>
    </figure>
  );
}
