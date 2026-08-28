'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * Toast.
 *
 * Radix uses a live region, so a toast is announced when it appears rather
 * than only being visible — which matters because a toast is often the only
 * confirmation that an action worked.
 *
 * Radix also keeps the toast open while it is hovered or focused and lets
 * F6 jump to it. A message that disappears on a timer is unreadable for
 * anyone who reads slowly, and unrecoverable for anyone using a screen reader
 * who was mid-sentence.
 */
export const ToastProvider = ToastPrimitive.Provider;
export const ToastAction = ToastPrimitive.Action;
export const ToastClose = ToastPrimitive.Close;

export const ToastViewport = forwardRef<
  ElementRef<typeof ToastPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(function ToastViewport({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        // Bottom on a phone, where the top is the browser chrome and the reach
        // is worse; top-right on desktop.
        'fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4',
        'sm:top-0 sm:bottom-auto sm:flex-col sm:max-w-sm',
        className,
      )}
      {...props}
    />
  );
});

const toastVariants = cva(
  [
    'pointer-events-auto flex w-full items-start gap-3 rounded-md border p-4',
    'bg-surface-overlay shadow-overlay',
  ],
  {
    variants: {
      variant: {
        default: 'border-border',
        // The border is a second cue alongside colour, for readers who cannot
        // distinguish red from green.
        success: 'border-state-success/40',
        danger: 'border-state-danger/40',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export const Toast = forwardRef<
  ElementRef<typeof ToastPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>
>(function Toast({ className, variant, ...props }, ref) {
  return (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});

export const ToastTitle = forwardRef<
  ElementRef<typeof ToastPrimitive.Title>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(function ToastTitle({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Title
      ref={ref}
      className={cn('text-sm font-semibold text-content-primary', className)}
      {...props}
    />
  );
});

export const ToastDescription = forwardRef<
  ElementRef<typeof ToastPrimitive.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(function ToastDescription({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Description
      ref={ref}
      className={cn('text-sm text-content-secondary', className)}
      {...props}
    />
  );
});
