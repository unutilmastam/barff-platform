import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * A full-width page section with the standard vertical rhythm.
 *
 * "Premium whitespace" (§16) is a measurement, not a feeling: one scale, used
 * everywhere, so sections cannot drift a few pixels apart. Spacing tightens on
 * small screens — 120px of padding on a 360px phone is wasted screen, not
 * elegance.
 */
export const sectionVariants = cva('w-full', {
  variants: {
    spacing: {
      none: '',
      sm: 'py-12 sm:py-16',
      md: 'py-sectionSm sm:py-section',
      lg: 'py-24 sm:py-40',
    },
    tone: {
      base: '',
      raised: 'bg-surface-raised',
      // A section divider is a hairline, never a heavy rule.
      bordered: 'border-t border-border',
    },
  },
  defaultVariants: { spacing: 'md', tone: 'base' },
});

export interface SectionProps
  extends HTMLAttributes<HTMLElement>, VariantProps<typeof sectionVariants> {
  as?: 'section' | 'div' | 'article';
}

export function Section({
  className,
  spacing,
  tone,
  as: Element = 'section',
  ...props
}: SectionProps) {
  return <Element className={cn(sectionVariants({ spacing, tone }), className)} {...props} />;
}
