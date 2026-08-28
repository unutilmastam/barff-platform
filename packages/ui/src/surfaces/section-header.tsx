import { type ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface SectionHeaderProps {
  title: string;
  /** Small label above the title. Decorative — never the only place meaning lives. */
  eyebrow?: string;
  description?: string;
  /** Call to action or link, placed opposite the title on wide screens. */
  action?: ReactNode;
  /**
   * Heading level.
   *
   * Explicit rather than always `h2`: a page has exactly one `h1`, and heading
   * levels must not skip. A component that hard-codes its level produces a
   * broken document outline the moment it is reused somewhere else, and the
   * outline is how a screen-reader user navigates the page.
   */
  as?: 'h1' | 'h2' | 'h3';
  align?: 'start' | 'center';
  className?: string;
}

export function SectionHeader({
  title,
  eyebrow,
  description,
  action,
  as: Heading = 'h2',
  align = 'start',
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow !== undefined && (
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-500">
            {eyebrow}
          </p>
        )}
        <Heading className="text-3xl font-bold tracking-tight text-content-primary sm:text-4xl">
          {title}
        </Heading>
        {description !== undefined && (
          <p className="mt-3 text-base text-content-secondary sm:text-lg">{description}</p>
        )}
      </div>
      {action !== undefined && <div className="shrink-0">{action}</div>}
    </div>
  );
}
