'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cn } from '../lib/cn';
import { useField } from './field';

/**
 * Select.
 *
 * Radix rather than a native `<select>`: the native control cannot be styled
 * consistently across browsers, and a `<div>`-based menu written by hand has to
 * reimplement typeahead, arrow-key navigation, focus return on close and the
 * listbox ARIA pattern. Radix does all of that.
 */
export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(function SelectTrigger({ className, children, id, ...props }, ref) {
  const field = useField();

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      id={id ?? field?.inputId}
      aria-describedby={props['aria-describedby'] ?? field?.describedBy}
      aria-invalid={field?.hasError === true ? true : undefined}
      className={cn(
        'flex h-10 w-full items-center justify-between gap-2 rounded border bg-surface-inset px-3',
        'text-sm text-content-primary transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Placeholder text is live content, not a disabled control, so it must
        // meet contrast. `content.disabled` gave 2.72:1 on this surface.
        'data-[placeholder]:text-content-muted',
        field?.hasError === true ? 'border-state-danger' : 'border-border',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <svg viewBox="0 0 16 16" className="size-4 opacity-60" fill="none" aria-hidden="true">
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = 'popper', ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        className={cn(
          'z-50 min-w-[8rem] overflow-hidden rounded-md border border-border',
          // Opaque, not glass: text over a translucent panel sitting on unknown
          // content behind it cannot be guaranteed to meet contrast.
          'bg-surface-overlay shadow-overlay',
          position === 'popper' && 'data-[side=bottom]:translate-y-1',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-3 text-sm',
        'text-content-secondary outline-none',
        'data-[highlighted]:bg-surface-raised data-[highlighted]:text-content-primary',
        'data-[state=checked]:text-content-primary',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
            <path
              d="M3.5 8.5l3 3 6-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});

export const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(function SelectLabel({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn('px-3 py-1.5 text-xs font-medium text-content-muted', className)}
      {...props}
    />
  );
});
