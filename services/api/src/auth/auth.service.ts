import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { type Role } from '@barff/types';
import { AppConfigService } from '../common/config/app-config.service.js';
import { AuditAction, AuditService } from '../common/audit/audit.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { hashPassword, needsRehash, verifyPassword } from '../common/crypto/password.js';
import { RefreshTokenStore } from './refresh-token.store.js';
import { TokenService } from './token.service.js';
import { type AuthenticatedUser, type TokenPair } from './types.js';

export interface RequestMetadata {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface LoginResult extends TokenPair {
  user: AuthenticatedUser;
}

/** Shape returned by every user lookup that needs roles and permissions. */
const USER_WITH_ACCESS = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly refreshStore: RefreshTokenStore,
    private readonly audit: AuditService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Authenticates a set of credentials.
   *
   * Every failure path returns the same `UnauthorizedException` with the same
   * message. Distinguishing "no such account" from "wrong password" hands an
   * attacker a free user-enumeration oracle — they can confirm which of a
   * leaked email list are BARFF dealers without ever guessing a password.
   * The audit row records what really happened; the caller learns nothing.
   */
  async login(
    email: string,
    password: string,
    metadata: RequestMetadata = {},
  ): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: USER_WITH_ACCESS,
    });

    if (user === null) {
      await this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        entity: 'User',
        actorEmail: normalizedEmail,
        after: { reason: 'no_such_account' },
        ...metadata,
      });
      // Hash anyway so a missing account does not answer measurably faster
      // than a wrong password — otherwise response timing re-opens the
      // enumeration hole the identical message just closed.
      await hashPassword(password);
      throw new UnauthorizedException(this.invalidCredentials());
    }

    if (user.lockedUntil !== null && user.lockedUntil > new Date()) {
      await this.audit.record({
        action: AuditAction.LOGIN_BLOCKED,
        entity: 'User',
        entityId: user.id,
        actorUserId: user.id,
        actorEmail: user.email,
        after: { reason: 'account_locked', lockedUntil: user.lockedUntil.toISOString() },
        ...metadata,
      });
      throw new UnauthorizedException(this.invalidCredentials());
    }

    const passwordMatches = await verifyPassword(user.passwordHash, password);
    if (!passwordMatches) {
      await this.registerFailedAttempt(user.id, user.email, user.failedLoginAttempts, metadata);
      throw new UnauthorizedException(this.invalidCredentials());
    }

    // Checked only after the password is verified: answering "this account is
    // deactivated" to an unauthenticated caller would confirm the account
    // exists.
    if (!user.isActive || user.deletedAt !== null) {
      await this.audit.record({
        action: AuditAction.LOGIN_BLOCKED,
        entity: 'User',
        entityId: user.id,
        actorUserId: user.id,
        actorEmail: user.email,
        after: { reason: user.deletedAt === null ? 'account_inactive' : 'account_deleted' },
        ...metadata,
      });
      throw new UnauthorizedException(this.invalidCredentials());
    }

    // The password was right: clear the lockout counters and stamp the login.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    // Transparent upgrade if the hashing baseline was raised since this
    // password was set. The plaintext is only available here, at login.
    if (needsRehash(user.passwordHash)) {
      const upgraded = await hashPassword(password);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: upgraded },
      });
      this.logger.log(`Upgraded password hash parameters for user ${user.id}`);
    }

    const access = this.extractAccess(user);
    const issued = await this.tokens.issueTokenPair({
      userId: user.id,
      email: user.email,
      roles: access.roles,
      permissions: access.permissions,
    });

    await this.refreshStore.store({
      jti: issued.refreshTokenId,
      sessionId: issued.sessionId,
      token: issued.refreshToken,
      ttlSeconds: issued.refreshTokenExpiresIn,
    });

    await this.audit.record({
      action: AuditAction.LOGIN_SUCCEEDED,
      entity: 'User',
      entityId: user.id,
      actorUserId: user.id,
      actorEmail: user.email,
      after: { sessionId: issued.sessionId, roles: access.roles },
      ...metadata,
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      accessTokenExpiresIn: issued.accessTokenExpiresIn,
      refreshTokenExpiresIn: issued.refreshTokenExpiresIn,
      user: {
        id: user.id,
        email: user.email,
        roles: access.roles,
        permissions: access.permissions,
        sessionId: issued.sessionId,
      },
    };
  }

  /**
   * Rotates a refresh token.
   *
   * Rotation means the presented token is consumed and a new one issued. If a
   * token that was already rotated shows up again, the only explanations are a
   * stolen copy or a replay — and the server cannot tell the thief from the
   * user. So the entire session family is revoked and both parties have to log
   * in again. Losing a session is a far cheaper outcome than leaving a
   * live stolen credential in circulation.
   */
  async refresh(refreshToken: string, metadata: RequestMetadata = {}): Promise<LoginResult> {
    const payload = await this.tokens.verifyRefreshToken(refreshToken);
    if (payload === null) {
      throw new UnauthorizedException(this.invalidSession());
    }

    const isCurrent = await this.refreshStore.isCurrent(payload.jti, refreshToken);
    if (!isCurrent) {
      const revoked = await this.refreshStore.revokeSession(payload.sid);
      await this.audit.record({
        action: AuditAction.TOKEN_REUSE_DETECTED,
        entity: 'User',
        entityId: payload.sub,
        actorUserId: payload.sub,
        after: { sessionId: payload.sid, revokedTokens: revoked },
        ...metadata,
      });
      this.logger.warn(
        `Refresh token reuse detected for user ${payload.sub}; session ${payload.sid} revoked`,
      );
      throw new UnauthorizedException(this.invalidSession());
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: USER_WITH_ACCESS,
    });

    if (user === null || !user.isActive || user.deletedAt !== null) {
      // A user deactivated mid-session must not be able to extend it.
      await this.refreshStore.revokeSession(payload.sid);
      throw new UnauthorizedException(this.invalidSession());
    }

    await this.refreshStore.consume(payload.jti);

    // Roles and permissions are re-read from the database on every refresh, so
    // a permission change takes effect within one access-token lifetime rather
    // than lasting until the refresh token expires.
    const access = this.extractAccess(user);
    const issued = await this.tokens.issueTokenPair({
      userId: user.id,
      email: user.email,
      roles: access.roles,
      permissions: access.permissions,
      sessionId: payload.sid,
    });

    await this.refreshStore.store({
      jti: issued.refreshTokenId,
      sessionId: issued.sessionId,
      token: issued.refreshToken,
      ttlSeconds: issued.refreshTokenExpiresIn,
    });

    await this.audit.record({
      action: AuditAction.TOKEN_REFRESHED,
      entity: 'User',
      entityId: user.id,
      actorUserId: user.id,
      actorEmail: user.email,
      after: { sessionId: issued.sessionId },
      ...metadata,
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      accessTokenExpiresIn: issued.accessTokenExpiresIn,
      refreshTokenExpiresIn: issued.refreshTokenExpiresIn,
      user: {
        id: user.id,
        email: user.email,
        roles: access.roles,
        permissions: access.permissions,
        sessionId: issued.sessionId,
      },
    };
  }

  /** Revokes the whole session, so every device on that chain is signed out. */
  async logout(sessionId: string, userId: string, metadata: RequestMetadata = {}): Promise<void> {
    const revoked = await this.refreshStore.revokeSession(sessionId);
    await this.audit.record({
      action: AuditAction.LOGOUT,
      entity: 'User',
      entityId: userId,
      actorUserId: userId,
      after: { sessionId, revokedTokens: revoked },
      ...metadata,
    });
  }

  /**
   * Current identity, re-read from the database.
   *
   * Not served from the token: `/auth/me` is what a client calls to find out
   * whether its session is still good, so answering from the token it just
   * sent would make it unable to notice a deactivated account.
   */
  async me(userId: string): Promise<{
    id: string;
    email: string;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    locale: string;
    roles: Role[];
    permissions: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_WITH_ACCESS,
    });

    if (user === null || !user.isActive || user.deletedAt !== null) {
      throw new ForbiddenException({ message: 'Account is not active', code: 'ACCOUNT_INACTIVE' });
    }

    const access = this.extractAccess(user);
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      roles: access.roles,
      permissions: access.permissions,
    };
  }

  /**
   * Increments the failure counter and locks the account past the threshold.
   *
   * Per-account, on top of the per-IP throttler. IP-only throttling is beaten
   * by spreading an attack across a botnet; account-only is beaten by trying
   * one password against thousands of accounts. Both together close each
   * other's gap.
   */
  private async registerFailedAttempt(
    userId: string,
    email: string,
    currentAttempts: number,
    metadata: RequestMetadata,
  ): Promise<void> {
    const { maxAttempts, lockoutSeconds } = this.config.loginThrottle;
    const attempts = currentAttempts + 1;
    const shouldLock = attempts >= maxAttempts;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + lockoutSeconds * 1000) : null,
      },
    });

    await this.audit.record({
      action: AuditAction.LOGIN_FAILED,
      entity: 'User',
      entityId: userId,
      actorUserId: userId,
      actorEmail: email,
      after: { reason: 'wrong_password', attempts, locked: shouldLock },
      ...metadata,
    });
  }

  private extractAccess(user: {
    roles: { role: { key: string; permissions: { permission: { key: string } }[] } }[];
  }): { roles: Role[]; permissions: string[] } {
    const roles = user.roles.map((assignment) => assignment.role.key as Role);
    const permissions = new Set<string>();
    for (const assignment of user.roles) {
      for (const grant of assignment.role.permissions) {
        permissions.add(grant.permission.key);
      }
    }
    return { roles, permissions: [...permissions].sort() };
  }

  /** One message for every credential failure — see `login`. */
  private invalidCredentials(): { message: string; code: string } {
    return { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' };
  }

  private invalidSession(): { message: string; code: string } {
    return { message: 'Session is no longer valid', code: 'INVALID_SESSION' };
  }
}
