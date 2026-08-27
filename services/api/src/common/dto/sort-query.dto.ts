import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SortDirection } from '@barff/types';
import { PaginationQueryDto } from './pagination-query.dto.js';

/**
 * Builds a sortable + paginated query DTO for an explicit column allow-list.
 *
 * Passing a client-supplied field straight to the ORM would let anyone order by
 * any column, including ones the endpoint does not expose — and on an
 * unindexed column it is a cheap way to make the database do expensive work.
 * Endpoints therefore declare what is sortable:
 *
 * ```ts
 * class ProductQueryDto extends SortableQueryDto(['name', 'createdAt'] as const) {}
 * ```
 */
export function SortableQueryDto<const TFields extends readonly string[]>(
  sortableFields: TFields,
  defaultField?: TFields[number],
) {
  class SortableQuery extends PaginationQueryDto {
    @ApiPropertyOptional({
      enum: sortableFields as unknown as string[],
      description: 'Column to sort by. Only the listed columns are accepted.',
      ...(defaultField === undefined ? {} : { default: defaultField }),
    })
    @IsOptional()
    @IsIn(sortableFields as unknown as string[])
    sortBy?: TFields[number] = defaultField;

    @ApiPropertyOptional({
      enum: Object.values(SortDirection),
      default: SortDirection.ASC,
    })
    @IsOptional()
    @IsIn(Object.values(SortDirection))
    sortDir: SortDirection = SortDirection.ASC;

    /** Prisma-shaped `orderBy`, or `undefined` when no column was chosen. */
    get orderBy(): Record<string, SortDirection> | undefined {
      return this.sortBy === undefined ? undefined : { [this.sortBy]: this.sortDir };
    }
  }

  return SortableQuery;
}
