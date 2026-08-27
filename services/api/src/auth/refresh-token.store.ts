import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisService } from '../common/redis/redis.service.js';

/**
 * Refresh-token state in Redis.
 *
 * Two keys per session:
 *
 * - `barff:rt:{jti}` → the SHA-256 of the token, with the token's own TTL.
 *   Presence means "not yet used or revoked".
 * - `barff:sess:{sid}` → the set of `jti`s issued in this chain, so an entire
 *   session can be revoked in one step.
 *
 * The token itself is never stored, only its digest. Redis is a cache tier and
 * gets dumped, replicated and inspected far more casually than a database; a
 * dump containing live refresh tokens would be an account-takeover kit. A
 * digest is enough to answer "is this the token I issued?" and useless to
 * anyone who reads it.
 */
@Injectable()
export class RefreshTokenStore {
  constructor(private readonly redis: RedisService) {}

  private tokenKey(jti: string): string {
    return `barff:rt:${jti}`;
  }

  private sessionKey(sessionId: string): string {
    return `barff:sess:${sessionId}`;
  }

  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async store(input: {
    jti: string;
    sessionId: string;
    token: string;
    ttlSeconds: number;
  }): Promise<void> {
    await this.redis.setEx(this.tokenKey(input.jti), this.digest(input.token), input.ttlSeconds);
    await this.redis.sAdd(this.sessionKey(input.sessionId), input.jti, input.ttlSeconds);
  }

  /**
   * True when this exact token is the live one for `jti`.
   *
   * A miss means one of: already rotated, revoked, or expired. All three are
   * "reject", and the caller cannot tell them apart — which is intentional, as
   * distinguishing them leaks session state to whoever holds the token.
   */
  async isCurrent(jti: string, token: string): Promise<boolean> {
    const stored = await this.redis.get(this.tokenKey(jti));
    return stored !== null && stored === this.digest(token);
  }

  /** Consumes a token so it cannot be presented twice. */
  async consume(jti: string): Promise<void> {
    await this.redis.del(this.tokenKey(jti));
  }

  /**
   * Revokes every token in a session.
   *
   * Called on logout, and on reuse detection: a rotated refresh token being
   * presented a second time means the token leaked, and the holder of the copy
   * cannot be told apart from the legitimate user — so both are logged out and
   * the real user re-authenticates.
   */
  async revokeSession(sessionId: string): Promise<number> {
    const jtis = await this.redis.sMembers(this.sessionKey(sessionId));
    const keys = jtis.map((jti) => this.tokenKey(jti));
    const removed = await this.redis.del(...keys);
    await this.redis.del(this.sessionKey(sessionId));
    return removed;
  }
}
