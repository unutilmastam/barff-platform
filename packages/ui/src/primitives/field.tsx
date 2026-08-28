'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface FieldContextValue {
  inputId: string;
  descriptionId: string;
  errorId: string;
  hasError: boolean;
  describedBy: string | undefined;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function useField(): FieldContextValue | null {
  return useContext(FieldContext);
}

export interface FieldProps {
  label: string;
  children: ReactNode;
  description?: string;
  /** Message shown and announced when validation fails. */
  error?: string;
  required?: boolean;
  /**
   * Announced after the label when the field is required, e.g. "majburiy".
   *
   * A prop rather than a built-in string: the asterisk is decorative and
   * reaches nobody using a screen reader, so the word has to be real text —
   * and real text in this package would be English on the Russian site (§18).
   */
  requiredLabel?: string;
  className?: string;
}

/**
 * Label, description and error wiring for a form control.
 *
 * The controls below read this context and pick up `id`, `aria-describedby`
 * and `aria-invalid` automatically. Doing it per call site is exactly the kind
 * of plumbing that gets skipped under deadline, and an input whose error text
 * is not linked to it is an error a screen reader never reads out.
 *
 * The error is `role="alert"`, so it is announced when it appears rather than
 * only when focus happens to land on the input.
 */
export function Field({
  label,
  children,
  description,
  error,
  required = false,
  requiredLabel,
  className,
}: FieldProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const hasError = error !== undefined && error.length > 0;

  const describedBy =
    [description !== undefined ? descriptionId : null, hasError ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ inputId, descriptionId, errorId, hasError, describedBy }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={inputId} className="text-sm font-medium text-content-secondary">
          {label}
          {required && (
            <>
              {/* The asterisk is decorative; the label is what gets announced. */}
              <span aria-hidden="true" className="ml-0.5 text-state-danger">
                *
              </span>
              {requiredLabel !== undefined && <span className="sr-only"> {requiredLabel}</span>}
            </>
          )}
        </label>

        {children}

        {description !== undefined && (
          <p id={descriptionId} className="text-xs text-content-muted">
            {description}
          </p>
        )}

        {hasError && (
          <p id={errorId} role="alert" className="text-xs text-state-danger">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
