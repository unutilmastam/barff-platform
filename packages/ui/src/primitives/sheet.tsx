'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';
import { DialogOverlay } from './dialog';

/**
 * Sheet — a dialog that slides in from an edge.
 *
 * Built on the same Radix Dialog rather than as a separate component: a sheet
 * is a modal, so it needs identical focus trapping, Escape handling and
 * inerting. Only the position and animation differ. Reimplementing it would
 * mean maintaining two focus traps.
 *
 * Used for the mobile navigation and for admin filter panels (S18).
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const sheetVariants = cva(
  [
    'fixed z-50 flex flex-col gap-4 border-border bg-surface-raised p-6 shadow-overlay',
    'overflow-y-auto',
  ],
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 max-h-[85vh] border-b',
        bottom: 'inset-x-0 bottom-0 max-h-[85vh] border-t',
        left: 'inset-y-0 left-0 h-full w-[85vw] max-w-sm border-r',
        right: 'inset-y-0 right-0 h-full w-[85vw] max-w-sm border-l',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
    VariantProps<typeof sheetVariants> & { closeLabel: string }
>(function SheetContent({ className, children, side, closeLabel, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded',
            'text-content-muted transition-colors hover:bg-surface-overlay hover:text-content-primary',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          )}
        >
          <span className="sr-only">{closeLabel}</span>
          <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export const SheetTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function SheetTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-lg font-semibold text-content-primary', className)}
      {...props}
    />
  );
});

export const SheetDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function SheetDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-content-secondary', className)}
      {...props}
    />
  );
});
