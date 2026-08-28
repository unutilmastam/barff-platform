'use client';

import { cn } from '../lib/cn';
import { Button } from './button';

export interface PaginationLabels {
  /** Names the whole control, e.g. "Pagination". */
  navigation: string;
  previous: string;
  next: string;
  /** Receives the page number, e.g. (n) => `Page ${n}`. */
  page: (page: number) => string;
  /** Receives page and total, e.g. (p, t) => `Page ${p} of ${t}`. */
  status: (page: number, totalPages: number) => string;
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /**
   * All text is passed in — this package holds no user-facing copy (§18), so a
   * consumer supplies translated labels.
   */
  labels: PaginationLabels;
  /** Number of pages shown either side of the current one. */
  siblingCount?: number;
  className?: string;
}

const ELLIPSIS = 'ellipsis' as const;
type PageItem = number | typeof ELLIPSIS;

/**
 * Page numbers with gaps collapsed, always including the first and last.
 *
 * Exported for testing: the windowing is the part with edge cases, and it is
 * far easier to assert on an array than on rendered markup.
 */
export function buildPageItems(page: number, totalPages: number, siblingCount = 1): PageItem[] {
  if (totalPages <= 0) return [];

  // Enough room for every page: first, last, current, two siblings, two gaps.
  const maxVisible = siblingCount * 2 + 5;
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_unused, index) => index + 1);
  }

  const left = Math.max(page - siblingCount, 1);
  const right = Math.min(page + siblingCount, totalPages);

  const items: PageItem[] = [1];
  // A gap of exactly one page is rendered as that page — an ellipsis hiding a
  // single number is worse than showing it.
  if (left > 2) items.push(left === 3 ? 2 : ELLIPSIS);

  for (let current = Math.max(left, 2); current <= Math.min(right, totalPages - 1); current += 1) {
    items.push(current);
  }

  if (right < totalPages - 1) items.push(right === totalPages - 2 ? totalPages - 1 : ELLIPSIS);
  items.push(totalPages);

  return items;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  labels,
  siblingCount = 1,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const items = buildPageItems(page, totalPages, siblingCount);

  return (
    <nav aria-label={labels.navigation} className={cn('flex items-center gap-1', className)}>
      {/* The current page is announced as text rather than left to be inferred
          from which button looks highlighted. */}
      <span className="sr-only" role="status" aria-live="polite">
        {labels.status(page, totalPages)}
      </span>

      <Button
        variant="ghost"
        size="sm"
        aria-label={labels.previous}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <span aria-hidden="true">‹</span>
      </Button>

      {items.map((item, index) =>
        item === ELLIPSIS ? (
          <span
            // Index is a safe key here: the list is positional and never
            // reordered or keyed to data.
            key={`gap-${index}`}
            aria-hidden="true"
            className="px-2 text-content-muted"
          >
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === page ? 'secondary' : 'ghost'}
            size="sm"
            aria-label={labels.page(item)}
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        ),
      )}

      <Button
        variant="ghost"
        size="sm"
        aria-label={labels.next}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <span aria-hidden="true">›</span>
      </Button>
    </nav>
  );
}
