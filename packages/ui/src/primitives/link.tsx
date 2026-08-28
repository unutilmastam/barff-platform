'use client';

import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

export const linkVariants = cva(
  [
    'inline-flex items-center gap-1 rounded-sm transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
  ],
  {
    variants: {
      variant: {
        // Underlined by default: colour alone is not a sufficient cue that
        // something is a link, and it fails for colour-blind readers.
        default: 'text-content-primary underline underline-offset-4 hover:text-brand-400',
        subtle: 'text-content-muted hover:text-content-primary',
        brand: 'text-brand-500 underline underline-offset-4 hover:text-brand-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface LinkProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>, VariantProps<typeof linkVariants> {
  /**
   * Render the child instead of an `<a>`.
   *
   * The web app must pass its locale-aware `Link` this way — a bare `<a>`
   * would drop the visitor's language.
   */
  asChild?: boolean;
  external?: boolean;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { className, variant, asChild = false, external = false, children, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'a';
  return (
    <Component
      ref={ref}
      className={cn(linkVariants({ variant }), className)}
      // `noopener` denies the opened page access to window.opener; `noreferrer`
      // also withholds the referrer.
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...props}
    >
      {children}
    </Component>
  );
});
