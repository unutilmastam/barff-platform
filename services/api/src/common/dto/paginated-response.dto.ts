import { ApiProperty } from '@nestjs/swagger';
import { type Type as NestType, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { buildPaginationMeta, type PaginatedResult, type PaginationMeta } from '@barff/types';

export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 137 })
  totalItems!: number;

  @ApiProperty({ example: 7 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;
}

/**
 * Wraps rows and their count into the envelope every list endpoint returns.
 *
 * Returning a bare array from a list endpoint is the mistake that forces a
 * breaking change the first time the client needs a total — the envelope is
 * there from the start.
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
  totalItems: number,
): PaginatedResult<T> {
  return { items, meta: buildPaginationMeta(page, pageSize, totalItems) };
}

/**
 * Documents `PaginatedResult<Model>` in Swagger.
 *
 * Generics are erased at runtime, so the schema has to be composed by hand:
 * ```ts
 * @ApiPaginatedResponse(ProductDto)
 * ```
 */
export function ApiPaginatedResponse<TModel extends NestType<unknown>>(model: TModel) {
  return applyDecorators(
    ApiExtraModels(PaginationMetaDto, model),
    ApiOkResponse({
      schema: {
        type: 'object',
        required: ['items', 'meta'],
        properties: {
          items: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
}
