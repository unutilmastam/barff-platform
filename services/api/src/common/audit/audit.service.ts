import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getRequestId } from '../http/request-context.js';
import { redact } from '../logger/redact.js';

/**
 * Actions worth auditing (`CLAUDE.md` §23).
 *
 * Kept as constants rather than free strings so the S38 viewer can filter on a
 * known set, and so a typo does not create a silent second category.
 */
export const AuditAction = {
  LOGIN_SUCCEEDED: 'user.login_succeeded',
  LOGIN_FAILED: 'user.login_failed',
  LOGIN_BLOCKED: 'user.login_blocked',
  LOGOUT: 'user.logout',
  TOKEN_REFRESHED: 'user.token_refreshed',
  TOKEN_REUSE_DETECTED: 'user.token_reuse_detected',
  ROLE_ASSIGNED: 'user.role_assigned',
  ROLE_REVOKED: 'user.role_revoked',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | undefined;
  actorUserId?: string | undefined;
  actorEmail?: string | undefined;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes one audit row.
   *
   * Two rules, both from §23:
   *
   * 1. **Never records a secret.** `before`/`after` go through the same
   *    redaction the logger uses. An audit table is the place a leaked
   *    credential would survive longest — it is append-only and retained for
   *    years — so a password hash reaching it is worse than one in a log.
   * 2. **Never fails the request it describes.** A broken audit write must not
   *    turn a successful login into a 500. The failure is logged loudly instead;
   *    if audit rows must be guaranteed, that is a transactional concern for the
   *    caller, not a reason to reject the user's action here.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      // `before`/`after` are omitted entirely rather than set to `undefined`:
      // under `exactOptionalPropertyTypes` Prisma's Json inputs do not accept
      // an explicit undefined, and omitting is what "no snapshot" means anyway.
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          actorUserId: entry.actorUserId ?? null,
          actorEmail: entry.actorEmail ?? null,
          ...(entry.before === undefined ? {} : { before: redact(entry.before) as never }),
          ...(entry.after === undefined ? {} : { after: redact(entry.after) as never }),
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent?.slice(0, 512) ?? null,
          requestId: getRequestId() ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit entry for ${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
