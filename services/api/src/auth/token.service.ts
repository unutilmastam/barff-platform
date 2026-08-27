import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../common/config/app-config.service.js';
import { type AccessTokenPayload, type RefreshTokenPayload, type TokenPair } from './types.js';

const ISSUER = 'barff-api';
const AUDIENCE = 'barff-platform';

/**
 * Signs and verifies JWTs.
 *
 * Access and refresh tokens are signed with **different secrets**. If they
 * shared one, a refresh token would verify as an access token and the short
 * access lifetime would buy nothing — the env schema enforces that they differ.
 *
 * `typ` is also checked on verification, so a token of the wrong kind is
 * rejected even in the presence of a future configuration mistake. Defence in
 * depth: either check alone would be enough, and neither is expensive.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async issueTokenPair(input: {
    userId: string;
    email: string;
    roles: AccessTokenPayload['roles'];
    permissions: string[];
    sessionId?: string;
  }): Promise<TokenPair & { sessionId: string; refreshTokenId: string }> {
    const { accessTtlSeconds, refreshTtlSeconds } = this.config.jwt;
    // A rotated token keeps the session id, so the whole chain can be revoked
    // together when reuse is detected.
    const sessionId = input.sessionId ?? randomUUID();
    const refreshTokenId = randomUUID();

    const accessToken = await this.jwt.signAsync(
      {
        sub: input.userId,
        email: input.email,
        roles: input.roles,
        permissions: input.permissions,
        sid: sessionId,
        typ: 'access',
      } satisfies Omit<AccessTokenPayload, 'iat' | 'exp'>,
      {
        secret: this.config.jwt.accessSecret,
        expiresIn: accessTtlSeconds,
        issuer: ISSUER,
        audience: AUDIENCE,
      },
    );

    const refreshToken = await this.jwt.signAsync(
      {
        sub: input.userId,
        sid: sessionId,
        jti: refreshTokenId,
        typ: 'refresh',
      } satisfies Omit<RefreshTokenPayload, 'iat' | 'exp'>,
      {
        secret: this.config.jwt.refreshSecret,
        expiresIn: refreshTtlSeconds,
        issuer: ISSUER,
        audience: AUDIENCE,
      },
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: accessTtlSeconds,
      refreshTokenExpiresIn: refreshTtlSeconds,
      sessionId,
      refreshTokenId,
    };
  }

  /** Returns `null` for anything invalid — expired, tampered, or wrong kind. */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      return payload.typ === 'access' ? payload : null;
    } catch {
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.jwt.refreshSecret,
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      return payload.typ === 'refresh' ? payload : null;
    } catch {
      return null;
    }
  }
}
