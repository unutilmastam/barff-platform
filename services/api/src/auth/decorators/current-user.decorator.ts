import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type AuthenticatedUser } from '../types.js';

/**
 * Injects the authenticated user attached by `JwtAuthGuard`.
 *
 * Always present on a guarded route; `undefined` only on a `@Public()` one, so
 * public handlers must treat it as optional.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (user === undefined) return undefined;
    return field === undefined ? user : user[field];
  },
);
