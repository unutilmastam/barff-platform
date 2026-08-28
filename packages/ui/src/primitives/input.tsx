'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { useField } from './field';

export const inputClassName = [
  'h-10 w-full rounded border bg-surface-inset px-3 text-sm text-content-primary',
  // Placeholders must meet contrast — they are not disabled text.
  'placeholder:text-content-muted',
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, id, ...props },
  ref,
) {
  const field = useField();

  return (
    <input
      ref={ref}
      id={id ?? field?.inputId}
      // Inside a <Field> these come for free; outside one they can still be
      // passed explicitly.
      aria-invalid={props['aria-invalid'] ?? (field?.hasError === true ? true : undefined)}
      aria-describedby={props['aria-describedby'] ?? field?.describedBy}
      className={cn(
        inputClassName,
        field?.hasError === true ? 'border-state-danger' : 'border-border',
        className,
      )}
      {...props}
    />
  );
});
