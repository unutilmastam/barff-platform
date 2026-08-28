import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { MediaResolverService } from '../media/media-resolver.service.js';
import { assertMediaKind } from '../media/media-reference.js';
import { type UpdateProductionStepDto } from './dto/production-step.dto.js';
import { PUBLIC_FILTER_NO_DELETE, publishTransition } from './publishing.js';
import { type Actor, json } from './content.types.js';

type StepRow = Prisma.ProductionStepGetPayload<Record<string, never>>;

/**
 * The eight stages of `CLAUDE.md` §4's production process.
 *
 * Edit-only: the stages and their order are part of the specification, not
 * something the CMS invents. There is no create and no delete, so nobody can
 * publish a production process BARFF does not run.
 */
@Injectable()
export class ProductionStepsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mediaResolver: MediaResolverService,
  ) {}

  async listPublic(): Promise<unknown[]> {
    const rows = await this.prisma.productionStep.findMany({
      where: PUBLIC_FILTER_NO_DELETE,
      orderBy: { displayOrder: 'asc' },
    });

    const resolve = await this.mediaResolver.resolve(rows.map((row) => row.mediaAssetId));
    return rows.map((row) => ({
      key: row.key,
      name: row.name,
      description: row.description,
      displayOrder: row.displayOrder,
      image: resolve(row.mediaAssetId) ?? null,
    }));
  }

  async listAdmin(): Promise<unknown[]> {
    const rows = await this.prisma.productionStep.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    return rows.map((row) => this.toAdmin(row));
  }

  async update(id: string, dto: UpdateProductionStepDto, actor: Actor): Promise<unknown> {
    const existing = await this.findOrThrow(id);
    if (dto.mediaAssetId !== undefined) {
      await assertMediaKind(this.prisma, dto.mediaAssetId, 'IMAGE');
    }

    const row = await this.prisma.productionStep.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: json(dto.name) }),
        ...(dto.description === undefined ? {} : { description: json(dto.description) }),
        ...(dto.mediaAssetId === undefined ? {} : { mediaAssetId: dto.mediaAssetId }),
        ...(dto.displayOrder === undefined ? {} : { displayOrder: dto.displayOrder }),
      },
    });

    await this.audit.record({
      action: 'production_step.updated',
      entity: 'ProductionStep',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { key: existing.key },
      after: { key: row.key },
    });

    return this.toAdmin(row);
  }

  /** Shows or hides a stage, behind `content:publish` like everything else. */
  async setPublished(id: string, isActive: boolean, actor: Actor): Promise<unknown> {
    const existing = await this.findOrThrow(id);
    const row = await this.prisma.productionStep.update({ where: { id }, data: { isActive } });

    await this.audit.record({
      action: `production_step.${publishTransition(isActive, existing.isActive)}`,
      entity: 'ProductionStep',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { key: existing.key, isActive: existing.isActive },
      after: { key: row.key, isActive: row.isActive },
    });

    return this.toAdmin(row);
  }

  private async findOrThrow(id: string): Promise<StepRow> {
    const row = await this.prisma.productionStep.findUnique({ where: { id } });
    if (row === null) {
      throw new NotFoundException({
        message: 'Production step not found',
        code: 'PRODUCTION_STEP_NOT_FOUND',
      });
    }
    return row;
  }

  private toAdmin(row: StepRow) {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      mediaAssetId: row.mediaAssetId,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
    };
  }
}
