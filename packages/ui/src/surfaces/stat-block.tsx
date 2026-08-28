import { cn } from '../lib/cn';

export interface StatBlockProps {
  /** The figure. Format it before passing — this component does not localize. */
  value: string;
  label: string;
  /** Unit or qualifier shown after the value, e.g. "litres/day". */
  unit?: string;
  /**
   * Marks the figure as not yet confirmed by BARFF.
   *
   * `CLAUDE.md` §1 forbids inventing company facts, and production capacity,
   * employee count and export countries are all open questions (Q-001). A
   * placeholder that looks identical to a verified figure is how invented data
   * reaches a live page — so unverified numbers are visibly marked, and the
   * marker is announced too, not just shown.
   */
  unverified?: boolean;
  /** Text for the unverified marker, supplied translated by the consumer. */
  unverifiedLabel?: string;
  className?: string;
}

export function StatBlock({
  value,
  label,
  unit,
  unverified = false,
  unverifiedLabel,
  className,
}: StatBlockProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'text-4xl font-bold tracking-tight tabular-nums sm:text-5xl',
            unverified ? 'text-content-muted' : 'text-content-primary',
          )}
        >
          {value}
        </span>
        {unit !== undefined && (
          <span className="text-lg font-medium text-content-muted">{unit}</span>
        )}
      </div>

      <span className="text-sm text-content-secondary">{label}</span>

      {unverified && unverifiedLabel !== undefined && (
        <span className="mt-1 inline-flex w-fit items-center rounded border border-state-warning/40 px-1.5 py-0.5 text-xs text-state-warning">
          {unverifiedLabel}
        </span>
      )}
    </div>
  );
}
