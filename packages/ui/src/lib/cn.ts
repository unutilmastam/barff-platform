import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names, letting a caller's class win over a component default.
 *
 * `clsx` handles conditionals; `tailwind-merge` resolves conflicts. Without the
 * second half, `<Button className="bg-red-500">` produces
 * `"bg-brand-500 bg-red-500"` and the winner depends on stylesheet order rather
 * than on what the caller asked for — the classic reason a design system's
 * escape hatch appears not to work.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
