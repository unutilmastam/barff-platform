/**
 * Pagination and sorting contracts.
 *
 * `CLAUDE.md` §11 requires pagination on every list endpoint. Keeping the
 * shapes here means the API DTOs (S02) and the data tables (S18) cannot drift.
 */
export const SortDirection = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface SortQuery<TField extends string = string> {
  sortBy?: TField;
  sortDir?: SortDirection;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** The envelope every paginated list endpoint returns. */
export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number,
): PaginationMeta {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / safePageSize);
  return {
    page,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
}
