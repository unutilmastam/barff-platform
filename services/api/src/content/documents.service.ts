import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { MediaResolverService } from '../media/media-resolver.service.js';
import { assertMediaKind } from '../media/media-reference.js';
import {
  type AdminListDocumentsDto,
  type CreatePublicDocumentDto,
  type PublicListDocumentsDto,
  type UpdatePublicDocumentDto,
} from './dto/public-document.dto.js';
import { PUBLIC_FILTER, publishPatch, publishTransition } from './publishing.js';
import { type Actor, json } from './content.types.js';

type DocumentRow = Prisma.PublicDocumentGetPayload<{ include: { mediaAsset: true } }>;

/**
 * Public downloads — the catalogue, a presentation, legal documents.
 *
 * Every file is served through a signed URL from the media layer rather than a
 * public bucket path, so unpublishing a document actually stops the download
 * instead of leaving a URL that still works.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mediaResolver: MediaResolverService,
  ) {}

  async listPublic(query: PublicListDocumentsDto): Promise<unknown[]> {
    const rows = await this.prisma.publicDocument.findMany({
      where: { ...PUBLIC_FILTER, ...(query.kind === undefined ? {} : { kind: query.kind }) },
      include: { mediaAsset: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const resolve = await this.mediaResolver.resolve(rows.map((row) => row.mediaAssetId));
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      kind: row.kind,
      filename: row.mediaAsset.originalFilename,
      mimeType: row.mediaAsset.mimeType,
      sizeBytes: row.mediaAsset.sizeBytes,
      url: resolve(row.mediaAssetId)?.url ?? null,
    }));
  }

  async listAdmin(query: AdminListDocumentsDto): Promise<unknown[]> {
    const rows = await this.prisma.publicDocument.findMany({
      where: {
        deletedAt: null,
        ...(query.kind === undefined ? {} : { kind: query.kind }),
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      },
      include: { mediaAsset: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toAdmin(row));
  }

  async create(dto: CreatePublicDocumentDto, actor: Actor): Promise<unknown> {
    await assertMediaKind(this.prisma, dto.mediaAssetId, 'DOCUMENT');

    const row = await this.prisma.publicDocument.create({
      data: {
        title: json(dto.title),
        ...(dto.description === undefined ? {} : { description: json(dto.description) }),
        kind: dto.kind,
        mediaAssetId: dto.mediaAssetId,
        displayOrder: dto.displayOrder ?? 0,
      },
      include: { mediaAsset: true },
    });

    await this.audit.record({
      action: 'document.created',
      entity: 'PublicDocument',
      entityId: row.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: { kind: row.kind, isActive: row.isActive },
    });

    return this.toAdmin(row);
  }

  async update(id: string, dto: UpdatePublicDocumentDto, actor: Actor): Promise<unknown> {
    const existing = await this.findOrThrow(id);

    const row = await this.prisma.publicDocument.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: json(dto.title) }),
        ...(dto.description === undefined ? {} : { description: json(dto.description) }),
        ...(dto.kind === undefined ? {} : { kind: dto.kind }),
        ...(dto.displayOrder === undefined ? {} : { displayOrder: dto.displayOrder }),
      },
      include: { mediaAsset: true },
    });

    await this.audit.record({
      action: 'document.updated',
      entity: 'PublicDocument',
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
    const row = await this.prisma.publicDocument.update({
      where: { id },
      data: publishPatch(isActive, existing.isActive),
      include: { mediaAsset: true },
    });

    await this.audit.record({
      action: `document.${publishTransition(isActive, existing.isActive)}`,
      entity: 'PublicDocument',
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
    await this.prisma.publicDocument.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.record({
      action: 'document.deleted',
      entity: 'PublicDocument',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
    });
  }

  private async findOrThrow(id: string): Promise<DocumentRow> {
    const row = await this.prisma.publicDocument.findFirst({
      where: { id, deletedAt: null },
      include: { mediaAsset: true },
    });
    if (row === null) {
      throw new NotFoundException({ message: 'Document not found', code: 'DOCUMENT_NOT_FOUND' });
    }
    return row;
  }

  private toAdmin(row: DocumentRow) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      kind: row.kind,
      mediaAssetId: row.mediaAssetId,
      filename: row.mediaAsset.originalFilename,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }
}
