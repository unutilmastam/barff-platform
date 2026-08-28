'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * Button.
 *
 * Radii stay small and gradients are absent by design — §16 rules out
 * "excessive rounded cards" and "excessive gradients". Depth comes from the
 * layered surfaces and thin borders instead.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded font-semibold transition-colors',
    // Never removed. A design system that drops the focus ring makes every
    // page built on it unusable by keyboard.
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    // `pointer-events-none` stops the cursor implying the control is live.
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-content-inverse hover:bg-accent-hover',
        secondary:
          'border border-border bg-surface-overlay text-content-primary hover:bg-surface-raised',
        ghost: 'text-content-secondary hover:bg-surface-overlay hover:text-content-primary',
        // `dangerFill`, not `danger`: the fill has to be dark enough for
        // content.primary to clear 4.5:1 on top of it.
        danger: 'bg-state-dangerFill text-content-primary hover:opacity-90',
      },
      size: {
        // Every size clears 24px so it satisfies WCAG 2.2 target-size on touch;
        // `sm` is 32px tall, not smaller.
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-5 text-sm',
        lg: 'h-12 px-7 text-base',
        icon: 'h-10 w-10',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a `<button>` — e.g. wrapping a link. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, asChild = false, type, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      // Inside a form an untyped <button> submits it. That surprise is a
      // recurring source of accidental submissions, so default to "button".
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
});
