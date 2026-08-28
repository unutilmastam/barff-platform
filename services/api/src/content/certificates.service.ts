import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { MediaResolverService } from '../media/media-resolver.service.js';
import { assertMediaKind } from '../media/media-reference.js';
import {
  type AdminListCertificatesDto,
  type CreateCertificateDto,
  type UpdateCertificateDto,
} from './dto/certificate.dto.js';
import { PUBLIC_FILTER, publishPatch, publishTransition } from './publishing.js';
import { type Actor, json } from './content.types.js';

type CertificateRow = Prisma.CertificateGetPayload<Record<string, never>>;

/**
 * Certificates for `/quality`.
 *
 * Not paginated: a manufacturer has a handful of certifications, and the page
 * shows all of them. If that ever stops being true the listing gains a page
 * parameter; inventing one now would be a parameter nobody passes.
 */
@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mediaResolver: MediaResolverService,
  ) {}

  async listPublic(): Promise<unknown[]> {
    const rows = await this.prisma.certificate.findMany({
      where: PUBLIC_FILTER,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const resolve = await this.mediaResolver.resolve(
      rows.flatMap((row) => [row.imageId, row.documentId]),
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      issuer: row.issuer,
      certificateNumber: row.certificateNumber,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      image: resolve(row.imageId) ?? null,
      document: resolve(row.documentId) ?? null,
    }));
  }

  async listAdmin(query: AdminListCertificatesDto): Promise<unknown[]> {
    const rows = await this.prisma.certificate.findMany({
      where: {
        deletedAt: null,
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toAdmin(row));
  }

  async create(dto: CreateCertificateDto, actor: Actor): Promise<unknown> {
    await this.assertMedia(dto.documentId, dto.imageId);

    const row = await this.prisma.certificate.create({
      data: {
        title: json(dto.title),
        ...(dto.description === undefined ? {} : { description: json(dto.description) }),
        issuer: dto.issuer ?? null,
        certificateNumber: dto.certificateNumber ?? null,
        issuedAt: dto.issuedAt === undefined ? null : new Date(dto.issuedAt),
        expiresAt: dto.expiresAt === undefined ? null : new Date(dto.expiresAt),
        documentId: dto.documentId ?? null,
        imageId: dto.imageId ?? null,
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    await this.audit.record({
      action: 'certificate.created',
      entity: 'Certificate',
      entityId: row.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: { issuer: row.issuer, isActive: row.isActive },
    });

    return this.toAdmin(row);
  }

  async update(id: string, dto: UpdateCertificateDto, actor: Actor): Promise<unknown> {
    const existing = await this.findOrThrow(id);
    await this.assertMedia(dto.documentId, dto.imageId);

    const row = await this.prisma.certificate.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: json(dto.title) }),
        ...(dto.description === undefined ? {} : { description: json(dto.description) }),
        ...(dto.issuer === undefined ? {} : { issuer: dto.issuer }),
        ...(dto.certificateNumber === undefined
          ? {}
          : { certificateNumber: dto.certificateNumber }),
        ...(dto.issuedAt === undefined ? {} : { issuedAt: new Date(dto.issuedAt) }),
        ...(dto.expiresAt === undefined ? {} : { expiresAt: new Date(dto.expiresAt) }),
        ...(dto.documentId === undefined ? {} : { documentId: dto.documentId }),
        ...(dto.imageId === undefined ? {} : { imageId: dto.imageId }),
        ...(dto.displayOrder === undefined ? {} : { displayOrder: dto.displayOrder }),
      },
    });

    await this.audit.record({
      action: 'certificate.updated',
      entity: 'Certificate',
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
   * A separate method, reached by a separately-permissioned endpoint, because
   * `content:publish` is a real permission in the seeded grant set and would
   * otherwise never be checked: folding `isActive` into the edit payload lets
   * anyone who can fix a typo also put a page live.
   */
  async setPublished(id: string, isActive: boolean, actor: Actor): Promise<unknown> {
    const existing = await this.findOrThrow(id);
    const row = await this.prisma.certificate.update({
      where: { id },
      data: publishPatch(isActive, existing.isActive),
    });

    await this.audit.record({
      action: `certificate.${publishTransition(isActive, existing.isActive)}`,
      entity: 'Certificate',
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
    await this.prisma.certificate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.record({
      action: 'certificate.deleted',
      entity: 'Certificate',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
    });
  }

  private async assertMedia(documentId?: string, imageId?: string): Promise<void> {
    if (documentId !== undefined) await assertMediaKind(this.prisma, documentId, 'DOCUMENT');
    if (imageId !== undefined) await assertMediaKind(this.prisma, imageId, 'IMAGE');
  }

  private async findOrThrow(id: string): Promise<CertificateRow> {
    const row = await this.prisma.certificate.findFirst({ where: { id, deletedAt: null } });
    if (row === null) {
      throw new NotFoundException({
        message: 'Certificate not found',
        code: 'CERTIFICATE_NOT_FOUND',
      });
    }
    return row;
  }

  private toAdmin(row: CertificateRow) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      issuer: row.issuer,
      certificateNumber: row.certificateNumber,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      documentId: row.documentId,
      imageId: row.imageId,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }
}
