import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { MediaResolverService } from '../media/media-resolver.service.js';
import { assertMediaKind } from '../media/media-reference.js';
import {
  type AdminListSectionsDto,
  type CreatePageSectionDto,
  type PageKey,
  type UpdatePageSectionDto,
} from './dto/page-section.dto.js';
import { PUBLIC_FILTER_NO_DELETE, publishTransition } from './publishing.js';
import { type Actor, json } from './content.types.js';

type SectionRow = Prisma.PageSectionGetPayload<Record<string, never>>;

/**
 * Editable blocks of the public landing pages — the homepage hero and the
 * sections beneath it (`CLAUDE.md` §4), and the same for `/company`,
 * `/production`, `/quality` and `/partners`.
 *
 * Sections are configuration rather than content: they are created once per
 * page and then edited, so they are hard-deleted rather than soft-deleted. A
 * removed section leaves nothing behind to link to, which is the difference
 * from a news article or a product.
 */
@Injectable()
export class PageSectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mediaResolver: MediaResolverService,
  ) {}

  /** Everything the public page needs, in render order. */
  async listPublic(page: PageKey): Promise<unknown[]> {
    const rows = await this.prisma.pageSection.findMany({
      where: { page, ...PUBLIC_FILTER_NO_DELETE },
      orderBy: [{ displayOrder: 'asc' }, { key: 'asc' }],
    });

    const resolve = await this.mediaResolver.resolve(rows.map((row) => row.mediaAssetId));
    return rows.map((row) => ({
      key: row.key,
      type: row.type,
      heading: row.heading,
      subheading: row.subheading,
      body: row.body,
      ctaLabel: row.ctaLabel,
      ctaHref: row.ctaHref,
      data: row.data,
      media: resolve(row.mediaAssetId) ?? null,
    }));
  }

  async listAdmin(query: AdminListSectionsDto): Promise<unknown[]> {
    const rows = await this.prisma.pageSection.findMany({
      where: {
        ...(query.page === undefined ? {} : { page: query.page }),
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      },
      orderBy: [{ page: 'asc' }, { displayOrder: 'asc' }, { key: 'asc' }],
    });
    return rows.map((row) => this.toAdmin(row));
  }

  async create(dto: CreatePageSectionDto, actor: Actor): Promise<unknown> {
    const existing = await this.prisma.pageSection.findUnique({
      where: { page_key: { page: dto.page, key: dto.key } },
    });
    if (existing !== null) {
      // The frontend looks a section up by (page, key). Two rows sharing one
      // would make which of them renders depend on row order.
      throw new ConflictException({
        message: 'That page already has a section with this key',
        code: 'SECTION_KEY_TAKEN',
      });
    }
    if (dto.mediaAssetId !== undefined) {
      await assertMediaKind(this.prisma, dto.mediaAssetId, 'IMAGE');
    }

    const row = await this.prisma.pageSection.create({
      data: {
        page: dto.page,
        key: dto.key,
        type: dto.type,
        ...(dto.heading === undefined ? {} : { heading: json(dto.heading) }),
        ...(dto.subheading === undefined ? {} : { subheading: json(dto.subheading) }),
        ...(dto.body === undefined ? {} : { body: json(dto.body) }),
        ...(dto.ctaLabel === undefined ? {} : { ctaLabel: json(dto.ctaLabel) }),
        ...(dto.data === undefined ? {} : { data: json(dto.data) }),
        mediaAssetId: dto.mediaAssetId ?? null,
        ctaHref: dto.ctaHref ?? null,
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    await this.audit.record({
      action: 'page_section.created',
      entity: 'PageSection',
      entityId: row.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: { page: row.page, key: row.key, isActive: row.isActive },
    });

    return this.toAdmin(row);
  }

  async update(id: string, dto: UpdatePageSectionDto, actor: Actor): Promise<unknown> {
    const existing = await this.findOrThrow(id);
    if (dto.mediaAssetId !== undefined) {
      await assertMediaKind(this.prisma, dto.mediaAssetId, 'IMAGE');
    }

    const row = await this.prisma.pageSection.update({
      where: { id },
      data: {
        ...(dto.type === undefined ? {} : { type: dto.type }),
        ...(dto.heading === undefined ? {} : { heading: json(dto.heading) }),
        ...(dto.subheading === undefined ? {} : { subheading: json(dto.subheading) }),
        ...(dto.body === undefined ? {} : { body: json(dto.body) }),
        ...(dto.ctaLabel === undefined ? {} : { ctaLabel: json(dto.ctaLabel) }),
        ...(dto.ctaHref === undefined ? {} : { ctaHref: dto.ctaHref }),
        ...(dto.data === undefined ? {} : { data: json(dto.data) }),
        ...(dto.mediaAssetId === undefined ? {} : { mediaAssetId: dto.mediaAssetId }),
        ...(dto.displayOrder === undefined ? {} : { displayOrder: dto.displayOrder }),
      },
    });

    await this.audit.record({
      action: 'page_section.updated',
      entity: 'PageSection',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { page: existing.page, key: existing.key },
      after: { page: row.page, key: row.key },
    });

    return this.toAdmin(row);
  }

  /**
   * Shows or hides a section.
   *
   * The same `content:publish` gate as every other content type: putting a
   * block on the homepage is publishing, whatever the column is called.
   */
  async setPublished(id: string, isActive: boolean, actor: Actor): Promise<unknown> {
    const existing = await this.findOrThrow(id);
    const row = await this.prisma.pageSection.update({ where: { id }, data: { isActive } });

    await this.audit.record({
      action: `page_section.${publishTransition(isActive, existing.isActive)}`,
      entity: 'PageSection',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { key: existing.key, isActive: existing.isActive },
      after: { key: row.key, isActive: row.isActive },
    });

    return this.toAdmin(row);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const row = await this.findOrThrow(id);
    await this.prisma.pageSection.delete({ where: { id } });

    await this.audit.record({
      action: 'page_section.deleted',
      entity: 'PageSection',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { page: row.page, key: row.key },
    });
  }

  private async findOrThrow(id: string): Promise<SectionRow> {
    const row = await this.prisma.pageSection.findUnique({ where: { id } });
    if (row === null) {
      throw new NotFoundException({ message: 'Section not found', code: 'SECTION_NOT_FOUND' });
    }
    return row;
  }

  private toAdmin(row: SectionRow) {
    return {
      id: row.id,
      page: row.page,
      key: row.key,
      type: row.type,
      heading: row.heading,
      subheading: row.subheading,
      body: row.body,
      mediaAssetId: row.mediaAssetId,
      ctaLabel: row.ctaLabel,
      ctaHref: row.ctaHref,
      data: row.data,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
    };
  }
}
