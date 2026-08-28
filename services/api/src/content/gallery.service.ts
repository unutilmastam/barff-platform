import { Injectable, NotFoundException } from '@nestjs/common';
import { buildPaginationMeta, type PaginatedResult } from '@barff/types';
import { type Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { MediaResolverService } from '../media/media-resolver.service.js';
import { assertMediaKind } from '../media/media-reference.js';
import {
  type AdminListGalleryDto,
  type CreateGalleryItemDto,
  type PublicListGalleryDto,
  type UpdateGalleryItemDto,
} from './dto/gallery.dto.js';
import { PUBLIC_FILTER, publishPatch, publishTransition } from './publishing.js';
import { type Actor, json } from './content.types.js';

type GalleryRow = Prisma.GalleryItemGetPayload<{ include: { mediaAsset: true } }>;

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mediaResolver: MediaResolverService,
  ) {}

  async listPublic(query: PublicListGalleryDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.GalleryItemWhereInput = {
      ...PUBLIC_FILTER,
      ...(query.category === undefined ? {} : { category: query.category }),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.galleryItem.findMany({
        where,
        include: { mediaAsset: true },
        orderBy: query.orderBy ?? { displayOrder: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.galleryItem.count({ where }),
    ]);

    const resolve = await this.mediaResolver.resolve(rows.map((row) => row.mediaAssetId));
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        caption: row.caption,
        category: row.category,
        // The item's own caption wins; the library's alt text is the fallback,
        // so a photo is never published without something for a screen reader.
        altText: row.title ?? row.mediaAsset.altText,
        image: resolve(row.mediaAssetId) ?? null,
      })),
      meta: buildPaginationMeta(query.page, query.pageSize, totalItems),
    };
  }

  async listAdmin(query: AdminListGalleryDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.GalleryItemWhereInput = {
      deletedAt: null,
      ...(query.category === undefined ? {} : { category: query.category }),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.galleryItem.findMany({
        where,
        include: { mediaAsset: true },
        orderBy: query.orderBy ?? { displayOrder: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.galleryItem.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toAdmin(row)),
      meta: buildPaginationMeta(query.page, query.pageSize, totalItems),
    };
  }

  async create(dto: CreateGalleryItemDto, actor: Actor): Promise<unknown> {
    await assertMediaKind(this.prisma, dto.mediaAssetId, 'IMAGE');

    const row = await this.prisma.galleryItem.create({
      data: {
        mediaAssetId: dto.mediaAssetId,
        ...(dto.title === undefined ? {} : { title: json(dto.title) }),
        ...(dto.caption === undefined ? {} : { caption: json(dto.caption) }),
        category: dto.category ?? 'OTHER',
        displayOrder: dto.displayOrder ?? 0,
      },
      include: { mediaAsset: true },
    });

    await this.audit.record({
      action: 'gallery_item.created',
      entity: 'GalleryItem',
      entityId: row.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: { mediaAssetId: row.mediaAssetId, category: row.category },
    });

    return this.toAdmin(row);
  }

  async update(id: string, dto: UpdateGalleryItemDto, actor: Actor): Promise<unknown> {
    const existing = await this.findOrThrow(id);

    const row = await this.prisma.galleryItem.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: json(dto.title) }),
        ...(dto.caption === undefined ? {} : { caption: json(dto.caption) }),
        ...(dto.category === undefined ? {} : { category: dto.category }),
        ...(dto.displayOrder === undefined ? {} : { displayOrder: dto.displayOrder }),
      },
      include: { mediaAsset: true },
    });

    await this.audit.record({
      action: 'gallery_item.updated',
      entity: 'GalleryItem',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { isActive: existing.isActive },
      after: { isActive: row.isActive },
    });

    return this.toAdmin(row);
  }

  /**
   * Publishes or retires a row.
   *
   * Separate from `update`, and separately permissioned: `content:publish`
   * exists in the grant set precisely so editing and going live can be
   * different privileges.
   */
  async setPublished(id: string, isActive: boolean, actor: Actor): Promise<unknown> {
    const existing = await this.findOrThrow(id);
    const row = await this.prisma.galleryItem.update({
      where: { id },
      data: publishPatch(isActive, existing.isActive),
      include: { mediaAsset: true },
    });

    await this.audit.record({
      action: `gallery_item.${publishTransition(isActive, existing.isActive)}`,
      entity: 'GalleryItem',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { isActive: existing.isActive },
      after: { isActive: row.isActive },
    });

    return this.toAdmin(row);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.galleryItem.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.record({
      action: 'gallery_item.deleted',
      entity: 'GalleryItem',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
    });
  }

  private async findOrThrow(id: string): Promise<GalleryRow> {
    const row = await this.prisma.galleryItem.findFirst({
      where: { id, deletedAt: null },
      include: { mediaAsset: true },
    });
    if (row === null) {
      throw new NotFoundException({
        message: 'Gallery item not found',
        code: 'GALLERY_ITEM_NOT_FOUND',
      });
    }
    return row;
  }

  private toAdmin(row: GalleryRow) {
    return {
      id: row.id,
      mediaAssetId: row.mediaAssetId,
      filename: row.mediaAsset.originalFilename,
      title: row.title,
      caption: row.caption,
      category: row.category,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }
}
