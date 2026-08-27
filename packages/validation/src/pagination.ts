/**
 * Pagination and sorting query schemas.
 *
 * `CLAUDE.md` §11 requires pagination on every list endpoint. Values arrive as
 * strings from query parameters, so they are coerced before being bounded.
 */
import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SortDirection } from '@barff/types';

export const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int({ error: 'validation.page.notInteger' })
    .min(1, { error: 'validation.page.tooSmall' })
    .default(DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int({ error: 'validation.pageSize.notInteger' })
    .min(1, { error: 'validation.pageSize.tooSmall' })
    // Capped so a client cannot ask for the whole table in one request.
    .max(MAX_PAGE_SIZE, { error: 'validation.pageSize.tooLarge' })
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;

export const sortDirectionSchema = z
  .enum([SortDirection.ASC, SortDirection.DESC], { error: 'validation.sortDir.invalid' })
  .default(SortDirection.ASC);

/**
 * Sorting restricted to an explicit allow-list of columns.
 *
 * Passing the field name straight through to the ORM would let a client sort by
 * any column, including ones that are not exposed. Endpoints declare what is
 * sortable.
 */
export function sortQuerySchema<const TFields extends readonly [string, ...string[]]>(
  sortableFields: TFields,
) {
  return z.object({
    sortBy: z.enum(sortableFields, { error: 'validation.sortBy.notSortable' }).optional(),
    sortDir: sortDirectionSchema,
  });
}

/** Free-text search box. Bounded so it cannot be used to push huge queries. */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120, { error: 'validation.search.tooLong' }).optional(),
});
