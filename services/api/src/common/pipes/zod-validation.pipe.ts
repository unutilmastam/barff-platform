import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { type ZodType } from 'zod';
import { VALIDATION_FAILED } from '../http/error-codes.js';

/**
 * Validates a payload against a Zod schema from `@barff/validation`.
 *
 * The global `ValidationPipe` (class-validator) handles DTO classes, which is
 * what Swagger introspects. This pipe exists for the endpoints where the
 * browser and the server must agree *exactly* — the public lead form, for
 * instance — so one schema drives both the React Hook Form resolver and the
 * server check, and they cannot drift apart.
 *
 * Server-side validation is never optional: passing in the browser is a
 * usability feature, not permission to skip this (`CLAUDE.md` §12).
 */
@Injectable()
export class ZodValidationPipe<TSchema extends ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : '_';
      (details[path] ??= []).push(issue.message);
    }

    throw new BadRequestException({
      message: 'Validation failed',
      code: VALIDATION_FAILED,
      details,
    });
  }
}

/** Sugar for `@Body(zodBody(schema))`. */
export function zodBody<TSchema extends ZodType>(schema: TSchema): ZodValidationPipe<TSchema> {
  return new ZodValidationPipe(schema);
}
