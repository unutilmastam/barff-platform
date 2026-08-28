import { type Prisma } from '../../generated/prisma/index.js';

/** Who performed a write, for the audit trail. */
export interface Actor {
  userId?: string | undefined;
  email?: string | undefined;
}

/**
 * Narrows a validated DTO to Prisma's JSON input type.
 *
 * The values are localized objects that class-validator has already checked;
 * Prisma's `InputJsonValue` cannot express "an object with three string fields"
 * without a cast at some point, and one named helper is better than a cast
 * scattered through every service.
 */
export const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
