'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '../lib/cn';

/**
 * Checkbox.
 *
 * Radix rather than a styled `<input type="checkbox">`: it keeps the real
 * control in the accessibility tree, handles the indeterminate state, and
 * supports Space activation and form participation. Hiding a native input
 * behind a styled `<div>` is the usual way this component loses its
 * accessibility.
 */
export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        // 20px box in a 24px hit area — WCAG 2.2 target size without an
        // oversized visual control.
        'peer inline-flex size-5 shrink-0 items-center justify-center rounded-sm border border-border',
        'bg-surface-inset transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        'data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-content-inverse">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
          <path
            d="M3.5 8.5l3 3 6-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

export interface CheckboxWithLabelProps extends ComponentPropsWithoutRef<
  typeof CheckboxPrimitive.Root
> {
  label: string;
}

/** Checkbox with a clickable label — the shape almost every form wants. */
export function CheckboxWithLabel({ label, id, ...props }: CheckboxWithLabelProps) {
  const inputId = id ?? `checkbox-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={inputId} {...props} />
      <label htmlFor={inputId} className="cursor-pointer text-sm text-content-secondary">
        {label}
      </label>
    </div>
  );
}
