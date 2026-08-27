import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'barff:isPublic';

/**
 * Marks a route as reachable without authentication.
 *
 * `JwtAuthGuard` is registered globally, so the API denies by default and a
 * route becomes public only by saying so out loud. The reverse — guarding each
 * controller individually — fails silently the first time someone forgets,
 * and an unguarded endpoint is not something a test suite notices unless
 * somebody thought to write that test.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
