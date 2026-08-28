import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface-overlay text-content-secondary',
        brand: 'border-border-brand bg-brand-950 text-brand-300',
        success: 'border-border bg-surface-overlay text-state-success',
        warning: 'border-border bg-surface-overlay text-state-warning',
        danger: 'border-border bg-surface-overlay text-state-danger',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /**
   * Text announced instead of the visual label.
   *
   * A badge often carries meaning through colour — an order status, a stock
   * warning. Colour reaches nobody using a screen reader, so anything whose
   * meaning is not fully in the text needs this.
   */
  srLabel?: string;
}

export function Badge({ className, variant, srLabel, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {srLabel !== undefined && <span className="sr-only">{srLabel}</span>}
      <span aria-hidden={srLabel !== undefined}>{children}</span>
    </span>
  );
}
