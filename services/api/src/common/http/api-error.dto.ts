import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type ApiError } from '@barff/types';

/**
 * The single error shape every endpoint returns.
 *
 * It implements `ApiError` from `@barff/types`, so the contract is declared
 * once and the browser clients type their error handling against the same
 * definition the server satisfies.
 */
export class ApiErrorDto implements ApiError {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: 'Cannot GET /api/v1/unknown' })
  message!: string;

  @ApiProperty({
    example: 'NOT_FOUND',
    description: 'Stable machine-readable code. Clients branch on this, not on the message.',
  })
  code!: string;

  @ApiProperty({
    example: '5f8d0a3e-2c1b-4a7e-9f3d-1b2c3d4e5f60',
    description: 'Correlates this response with the server logs.',
  })
  requestId!: string;

  @ApiPropertyOptional({
    description: 'Field-level validation failures, keyed by input path.',
    example: { email: ['validation.email.invalid'] },
    additionalProperties: { type: 'array', items: { type: 'string' } },
  })
  details?: Record<string, string[]>;
}
