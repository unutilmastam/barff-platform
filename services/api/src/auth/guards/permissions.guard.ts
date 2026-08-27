import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { type AuthenticatedUser } from '../types.js';

/**
 * Enforces `@Permissions()` — every listed permission must be held.
 *
 * The permissions come from the access token, which the server signed, so this
 * is still a server-side decision. The trade-off is staleness: a permission
 * revoked by an admin remains usable until the current access token expires
 * (15 minutes by default), because the token is not re-checked against the
 * database on every request. Refreshing re-reads them, and revoking the session
 * cuts it short immediately.
 *
 * The alternative — a database or Redis lookup per request — buys instant
 * revocation at the cost of making every authenticated request depend on
 * another service being up. For this platform a bounded 15-minute window is the
 * better trade; if an endpoint ever needs stricter, it should check the
 * database itself rather than change this for everyone.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (user === undefined) {
      throw new ForbiddenException({ message: 'Access denied', code: 'FORBIDDEN' });
    }

    const held = new Set(user.permissions);
    const missing = required.filter((permission) => !held.has(permission));

    if (missing.length > 0) {
      // The missing keys are not returned: an attacker probing endpoints would
      // otherwise be handed a map of the permission model.
      throw new ForbiddenException({
        message: 'Access denied',
        code: 'FORBIDDEN_PERMISSION',
      });
    }

    return true;
  }
}
