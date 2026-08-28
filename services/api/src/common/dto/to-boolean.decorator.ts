import { Transform } from 'class-transformer';

/**
 * Parses a boolean out of a query string.
 *
 * `@Type(() => Boolean)` cannot do this: it calls the `Boolean` constructor, and
 * `Boolean('false')` is `true`. A filter written that way accepts
 * `?isActive=false` and quietly returns the opposite set of rows — the failure
 * is invisible, because the response is a perfectly valid list.
 *
 * Anything that is not recognisably a boolean is passed through untouched so
 * `@IsBoolean()` reports it as invalid, rather than being coerced into a
 * silently wrong filter.
 */
export function ToBoolean(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  });
}
