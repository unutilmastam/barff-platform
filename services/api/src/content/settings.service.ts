import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { type UpdateSettingDto } from './dto/setting.dto.js';
import { type Actor, json } from './content.types.js';

/**
 * Runtime settings an admin can change without a deploy (`CLAUDE.md` §8).
 *
 * Two rules make this safe to expose:
 *
 * 1. **Keys are seeded, never created here.** A settings screen that accepts an
 *    arbitrary key produces settings nothing reads, and hides the fact that the
 *    feature behind the name does not exist.
 * 2. **Private by default.** Only rows explicitly flagged `isPublic` are
 *    readable without a token — and connection strings and API keys are not in
 *    this table at all (§12), they come from the environment.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The public website's view: flagged rows only, as a flat key → value map. */
  async listPublic(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { isPublic: true },
      orderBy: { key: 'asc' },
      select: { key: true, value: true },
    });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async listAdmin(): Promise<unknown[]> {
    const rows = await this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
    return rows.map((row) => ({
      key: row.key,
      value: row.value,
      description: row.description,
      isPublic: row.isPublic,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async update(key: string, dto: UpdateSettingDto, actor: Actor): Promise<unknown> {
    const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (existing === null) {
      throw new NotFoundException({ message: 'Unknown setting', code: 'SETTING_NOT_FOUND' });
    }

    const row = await this.prisma.systemSetting.update({
      where: { key },
      data: {
        value: json(dto.value),
        ...(dto.description === undefined ? {} : { description: dto.description }),
        ...(dto.isPublic === undefined ? {} : { isPublic: dto.isPublic }),
        updatedById: actor.userId ?? null,
      },
    });

    // A settings change alters how the system behaves for everyone, so §23
    // wants the before and the after, not just the fact that it happened.
    await this.audit.record({
      action: 'system_setting.updated',
      entity: 'SystemSetting',
      entityId: row.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { key: existing.key, value: existing.value, isPublic: existing.isPublic },
      after: { key: row.key, value: row.value, isPublic: row.isPublic },
    });

    return {
      key: row.key,
      value: row.value,
      description: row.description,
      isPublic: row.isPublic,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
