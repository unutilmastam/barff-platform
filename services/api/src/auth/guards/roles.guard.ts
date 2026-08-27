import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Role } from '@barff/types';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { type AuthenticatedUser } from '../types.js';

/**
 * Enforces `@Roles()`.
 *
 * This is the authorization decision, taken on the server. Hiding a button in
 * the admin UI is presentation; the endpoint must refuse the request on its own
 * even when called directly with a valid token (`CLAUDE.md` §3, §12).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (user === undefined) {
      // Only reachable if a route carries @Roles() and @Public() at once — a
      // contradiction worth failing closed on rather than quietly allowing.
      throw new ForbiddenException({ message: 'Access denied', code: 'FORBIDDEN' });
    }

    const hasRole = required.some((role) => user.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException({ message: 'Access denied', code: 'FORBIDDEN_ROLE' });
    }

    return true;
  }
}
