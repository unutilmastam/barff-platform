import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * Translucent panel — the "glass/translucent surfaces" of §16.
 *
 * Two deliberate restraints:
 *
 * - `rounded-lg` (10px), not `rounded-2xl`. §16 rules out "excessive rounded
 *   cards", and a premium product page reads sharper with restrained radii.
 * - A thin border rather than a shadow. Depth comes from layered surfaces and
 *   a 1px edge; heavy shadows are what make a dark UI look muddy.
 *
 * The blur is a `backdrop-filter`, which is expensive to composite. Use this
 * for a handful of panels, not for a grid of fifty cards.
 */
export const glassCardVariants = cva('rounded-lg border transition-colors', {
  variants: {
    tone: {
      glass: 'border-border bg-surface-glass backdrop-blur-glass',
      solid: 'border-border bg-surface-raised',
      // The one place a gradient is used, and it is barely there — a hint of
      // brand at one corner, not a coloured card.
      accent: 'border-border-brand bg-gradient-to-br from-accent-soft to-surface-raised',
    },
    padding: { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' },
    interactive: {
      true: 'hover:border-border-strong focus-within:border-border-strong',
    },
  },
  defaultVariants: { tone: 'glass', padding: 'md' },
});

export interface GlassCardProps
  extends HTMLAttributes<HTMLElement>, VariantProps<typeof glassCardVariants> {
  /**
   * Typed against `HTMLElement`, not `HTMLDivElement`: the element is
   * polymorphic, and div-specific event handler types are not assignable to
   * `<li>` under `exactOptionalPropertyTypes`. Event handler parameters are
   * contravariant, so the wider type is the one that fits every target.
   */
  as?: 'div' | 'article' | 'li' | 'section';
}

export function GlassCard({
  className,
  tone,
  padding,
  interactive,
  as: Element = 'div',
  ...props
}: GlassCardProps) {
  return (
    <Element
      className={cn(glassCardVariants({ tone, padding, interactive }), className)}
      {...props}
    />
  );
}
