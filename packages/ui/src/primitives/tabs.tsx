'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../lib/cn';

/**
 * Tabs.
 *
 * Radix supplies the roving tabindex: arrow keys move between tabs, Home/End
 * jump to the ends, and only the active tab is in the tab order. A hand-rolled
 * version usually makes every tab tabbable, which is the wrong pattern and
 * makes a long tab list tedious to get past.
 *
 * Used by the localized editors in the admin CMS (S19), where each tab is a
 * language.
 */
export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded border border-border bg-surface-raised p-1',
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-sm px-3 text-sm font-medium',
        'text-content-muted transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'hover:text-content-secondary',
        'data-[state=active]:bg-surface-overlay data-[state=active]:text-content-primary',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'mt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        className,
      )}
      {...props}
    />
  );
});
