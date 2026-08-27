import { type Role } from '@barff/types';

/** Claims carried by an access token. */
export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  email: string;
  roles: Role[];
  /** `resource:action` keys the guards check. */
  permissions: string[];
  /** Session family id — ties this token to a refresh chain. */
  sid: string;
  typ: 'access';
  iat?: number;
  exp?: number;
}

/**
 * Claims carried by a refresh token.
 *
 * Deliberately minimal: it carries no roles or permissions, so a stolen refresh
 * token cannot be replayed as an access token even if the signing keys were
 * somehow confused. `jti` is the row key in Redis.
 */
export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  jti: string;
  typ: 'refresh';
  iat?: number;
  exp?: number;
}

/** What the guards attach to `request.user`. Never contains the password hash. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: Role[];
  permissions: string[];
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}
