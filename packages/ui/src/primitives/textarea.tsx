'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { useField } from './field';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, id, rows = 4, ...props },
  ref,
) {
  const field = useField();

  return (
    <textarea
      ref={ref}
      id={id ?? field?.inputId}
      rows={rows}
      aria-invalid={props['aria-invalid'] ?? (field?.hasError === true ? true : undefined)}
      aria-describedby={props['aria-describedby'] ?? field?.describedBy}
      className={cn(
        'w-full rounded border bg-surface-inset px-3 py-2 text-sm text-content-primary',
        // Placeholders must meet contrast — they are not disabled text.
        'placeholder:text-content-muted',
        'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        field?.hasError === true ? 'border-state-danger' : 'border-border',
        className,
      )}
      {...props}
    />
  );
});
