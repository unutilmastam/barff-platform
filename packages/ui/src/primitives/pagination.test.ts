import { describe, expect, it } from 'vitest';
import { buildPageItems } from './pagination';

/**
 * The page windowing is the part of Pagination with edge cases, so it is
 * exported and tested directly rather than asserted through rendered markup.
 */
describe('buildPageItems', () => {
  it('lists every page when they all fit', () => {
    expect(buildPageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('always includes the first and last page', () => {
    for (const page of [1, 10, 25, 50]) {
      const items = buildPageItems(page, 50);
      expect(items[0]).toBe(1);
      expect(items[items.length - 1]).toBe(50);
    }
  });

  it('collapses the far side into an ellipsis', () => {
    expect(buildPageItems(1, 20)).toEqual([1, 2, 'ellipsis', 20]);
    expect(buildPageItems(20, 20)).toEqual([1, 'ellipsis', 19, 20]);
  });

  it('keeps siblings either side of the current page', () => {
    expect(buildPageItems(10, 20)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
  });

  it('honours a wider sibling count', () => {
    expect(buildPageItems(10, 20, 2)).toEqual([1, 'ellipsis', 8, 9, 10, 11, 12, 'ellipsis', 20]);
  });

  it('shows the page rather than an ellipsis hiding exactly one', () => {
    // An "…" standing in for a single number is strictly worse than the number.
    const items = buildPageItems(4, 20);
    expect(items).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20]);
    expect(items).not.toContain('ellipsis-at-position-1');
  });

  it('never repeats a page', () => {
    for (let page = 1; page <= 20; page += 1) {
      const numbers = buildPageItems(page, 20).filter((item) => typeof item === 'number');
      expect(new Set(numbers).size).toBe(numbers.length);
    }
  });

  it('keeps the pages in ascending order', () => {
    for (let page = 1; page <= 30; page += 1) {
      const numbers = buildPageItems(page, 30).filter(
        (item): item is number => typeof item === 'number',
      );
      expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
    }
  });

  it('handles degenerate totals', () => {
    expect(buildPageItems(1, 0)).toEqual([]);
    expect(buildPageItems(1, 1)).toEqual([1]);
  });
});
