import { type HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Text announced while content loads.
   *
   * When omitted the skeleton is hidden from assistive technology entirely,
   * which is correct for a decorative placeholder inside a region that already
   * announces its own loading state — announcing "loading" five times for five
   * skeleton blocks is worse than saying nothing.
   */
  srLabel?: string;
}

/**
 * Loading placeholder.
 *
 * Size these to match the real content so nothing shifts when it arrives
 * (§26 — no layout shift). The pulse is a CSS animation, so it stops under
 * `prefers-reduced-motion` via the global rule in the web app.
 */
export function Skeleton({ className, srLabel, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded bg-surface-overlay', className)}
      {...(srLabel === undefined
        ? { 'aria-hidden': true }
        : { role: 'status', 'aria-live': 'polite' })}
      {...props}
    >
      {srLabel !== undefined && <span className="sr-only">{srLabel}</span>}
    </div>
  );
}
