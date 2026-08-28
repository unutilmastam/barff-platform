import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('supports conditional objects and arrays', () => {
    expect(cn({ a: true, b: false }, ['c'])).toBe('a c');
  });

  it('lets the caller override a component default', () => {
    // The whole point: the last conflicting utility wins deterministically,
    // rather than depending on stylesheet order.
    expect(cn('bg-brand-500', 'bg-surface-raised')).toBe('bg-surface-raised');
    expect(cn('px-4 py-2', 'px-8')).toBe('py-2 px-8');
  });

  it('keeps non-conflicting utilities from both sides', () => {
    expect(cn('rounded border', 'text-sm')).toBe('rounded border text-sm');
  });

  it('resolves conflicts across responsive variants independently', () => {
    // `md:px-8` does not conflict with the base `px-4`.
    expect(cn('px-4', 'md:px-8')).toBe('px-4 md:px-8');
    expect(cn('md:px-4', 'md:px-8')).toBe('md:px-8');
  });

  it('returns an empty string for no input', () => {
    expect(cn()).toBe('');
  });
});
