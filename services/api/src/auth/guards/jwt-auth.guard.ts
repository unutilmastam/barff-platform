import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ACCESS_TOKEN_COOKIE } from '../cookies.js';
import { TokenService } from '../token.service.js';
import { type AuthenticatedUser } from '../types.js';

/**
 * Verifies the access token and attaches the caller to the request.
 *
 * Registered globally: the API denies by default and `@Public()` is the only
 * way through without a token.
 *
 * Two token sources, in order: the HttpOnly cookie browsers use, then the
 * `Authorization: Bearer` header for the driver PWA and any server-to-server
 * caller. Cookie first because a browser sending both is the normal case and
 * the cookie is the one the server controls.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = extractToken(request);

    if (token === null) {
      throw new UnauthorizedException({
        message: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
    }

    const payload = await this.tokens.verifyAccessToken(token);
    if (payload === null) {
      // Covers expired, tampered, wrong-secret and wrong-kind alike. The client
      // is told only that the token did not work; which of those it was is not
      // its business, and saying would help someone probing the signing setup.
      throw new UnauthorizedException({
        message: 'Access token is invalid or expired',
        code: 'INVALID_ACCESS_TOKEN',
      });
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      sessionId: payload.sid,
    };

    return true;
  }
}

function extractToken(request: Request): string | null {
  const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
  const fromCookie = cookies?.[ACCESS_TOKEN_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;

  const header = request.headers.authorization;
  if (typeof header === 'string') {
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && value !== undefined && value.length > 0) {
      return value;
    }
  }

  return null;
}
