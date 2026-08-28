import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the §16 and §18 constraints that are easy to state and easy to erode.
 *
 * "No excessive rounding or gradients", "every interactive element keeps a
 * focus ring" and "no English in the design system" survive review once. They
 * do not survive twenty more components added over six months — so they are
 * asserted rather than trusted.
 */
const SRC = fileURLToPath(new URL('.', import.meta.url));

/**
 * Comments are stripped before scanning.
 *
 * Otherwise a comment explaining *why* a class is avoided reads as a use of it
 * — the first version of this file failed on GlassCard's own docstring saying
 * "rounded-lg, not rounded-2xl".
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const files = ['primitives', 'surfaces'].flatMap((dir) =>
  readdirSync(join(SRC, dir))
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => ({
      name: `${dir}/${file}`,
      source: stripComments(readFileSync(join(SRC, dir, file), 'utf8')),
    })),
);

describe('§16 visual restraint', () => {
  it('covers every component', () => {
    expect(files.length).toBeGreaterThanOrEqual(19);
  });

  it.each(files.map((f) => [f.name, f.source]))('%s avoids excessive rounding', (_n, source) => {
    // §16 rules out "excessive rounded cards". rounded-xl (14px) is the
    // ceiling; 2xl and 3xl give the pill-shaped look the brief does not want.
    // `rounded-full` stays allowed — it is right for dots and avatars.
    expect(source.match(/rounded-(2xl|3xl)/g) ?? []).toEqual([]);
  });

  it.each(files.map((f) => [f.name, f.source]))('%s uses gradients sparingly', (_n, source) => {
    // "Restrained gradients" — at most one per component, and only as a hint.
    expect((source.match(/bg-gradient-to-/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it.each(
    // Only components that render a natively focusable element themselves.
    // Pagination composes <Button>, so its focus ring is Button's to provide —
    // requiring it here would just push duplicate styling into every wrapper.
    files
      // Case-sensitive on purpose: JSX intrinsics are lowercase, components
      // are capitalised. Matching case-insensitively made `<Button>` look like
      // a native `<button>` and flagged every wrapper.
      .filter((f) => /<(button|a|input|textarea)[\s>]/.test(f.source))
      .map((f) => [f.name, f.source]),
  )('%s keeps a visible focus ring', (_n, source) => {
    expect(
      source.includes('focus-visible:outline') || source.includes('focus-visible:ring'),
      'renders a focusable element but defines no focus-visible style',
    ).toBe(true);
  });

  it.each(files.filter((f) => f.source.includes('outline-none')).map((f) => [f.name, f.source]))(
    '%s only removes the outline where another cue replaces it',
    (_n, source) => {
      // Radix listbox items are not DOM-focused — the roving highlight is
      // `data-[highlighted]`, so `outline-none` there is correct. Anywhere else
      // it is the most common accessibility regression there is.
      expect(
        source.includes('data-[highlighted]') || source.includes('data-[state='),
        'outline-none with no data-state or data-highlighted styling to replace it',
      ).toBe(true);
    },
  );
});

describe('§18 no user-facing copy in the design system', () => {
  it.each(files.map((f) => [f.name, f.source]))('%s ships no hard-coded text', (_n, source) => {
    // Requires a closing tag after the text. Matching a bare `<` instead
    // swallowed TypeScript generics — `ComponentPropsWithoutRef<typeof X>`
    // looked like JSX text and failed nearly every file for the wrong reason.
    const jsxText = [...source.matchAll(/>([^<>{}]+)<\//g)]
      .map((match) => (match[1] ?? '').trim())
      .filter((text) => /\p{L}{2,}/u.test(text));

    expect(jsxText, `hard-coded text: ${jsxText.join(' | ')}`).toEqual([]);
  });
});
