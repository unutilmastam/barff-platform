import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { MediaResolverService } from '../media/media-resolver.service.js';
import { assertMediaKind } from '../media/media-reference.js';
import { type UpsertSeoDto } from './dto/seo.dto.js';
import { type Actor, json } from './content.types.js';

type SeoRow = Prisma.SeoMetadataGetPayload<Record<string, never>>;

/**
 * Normalizes a route into the single form the table is keyed by.
 *
 * `/products`, `/products/`, `/Products` and `/uz/products` are one page as far
 * as metadata is concerned. Without normalization they would be four rows, and
 * whichever one the frontend happened to ask for would win.
 */
export function normalizeSeoPath(path: string): string {
  const withoutLocale = path.replace(/^\/(uz|ru|en)(?=\/|$)/i, '');
  const lowered = (withoutLocale === '' ? '/' : withoutLocale).toLowerCase();
  const trimmed = lowered.length > 1 ? lowered.replace(/\/+$/, '') : lowered;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Per-route SEO overrides (`CLAUDE.md` §19).
 *
 * Only routes that have no record of their own live here — a product and a news
 * article carry `seo` on the row itself. There is no create/delete pair: a path
 * either has an override or it does not, so one upsert is the whole write API.
 */
@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mediaResolver: MediaResolverService,
  ) {}

  /** Returns `null` rather than 404: "no override" is a normal answer. */
  async findPublic(path: string): Promise<unknown> {
    const row = await this.prisma.seoMetadata.findUnique({
      where: { path: normalizeSeoPath(path) },
    });
    if (row === null) return null;

    const resolve = await this.mediaResolver.resolve([row.ogImageId]);
    return {
      path: row.path,
      title: row.title,
      description: row.description,
      canonicalUrl: row.canonicalUrl,
      noindex: row.noindex,
      ogImage: resolve(row.ogImageId) ?? null,
    };
  }

  async listAdmin(): Promise<unknown[]> {
    const rows = await this.prisma.seoMetadata.findMany({ orderBy: { path: 'asc' } });
    return rows.map((row) => this.toAdmin(row));
  }

  async upsert(dto: UpsertSeoDto, actor: Actor): Promise<unknown> {
    const path = normalizeSeoPath(dto.path);
    if (dto.ogImageId !== undefined) {
      await assertMediaKind(this.prisma, dto.ogImageId, 'IMAGE');
    }

    const data = {
      ...(dto.title === undefined ? {} : { title: json(dto.title) }),
      ...(dto.description === undefined ? {} : { description: json(dto.description) }),
      ...(dto.ogImageId === undefined ? {} : { ogImageId: dto.ogImageId }),
      ...(dto.canonicalUrl === undefined ? {} : { canonicalUrl: dto.canonicalUrl }),
      ...(dto.noindex === undefined ? {} : { noindex: dto.noindex }),
    };

    const row = await this.prisma.seoMetadata.upsert({
      where: { path },
      update: data,
      create: { path, ...data },
    });

    await this.audit.record({
      action: 'seo_metadata.upserted',
      entity: 'SeoMetadata',
      entityId: row.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: { path: row.path, noindex: row.noindex },
    });

    return this.toAdmin(row);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const row = await this.prisma.seoMetadata.findUnique({ where: { id } });
    if (row === null) {
      throw new NotFoundException({ message: 'Override not found', code: 'SEO_NOT_FOUND' });
    }
    // Hard delete: removing an override restores the S15 defaults, which is
    // exactly what the editor asked for. Nothing links to this row.
    await this.prisma.seoMetadata.delete({ where: { id } });

    await this.audit.record({
      action: 'seo_metadata.deleted',
      entity: 'SeoMetadata',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { path: row.path },
    });
  }

  private toAdmin(row: SeoRow) {
    return {
      id: row.id,
      path: row.path,
      title: row.title,
      description: row.description,
      ogImageId: row.ogImageId,
      canonicalUrl: row.canonicalUrl,
      noindex: row.noindex,
    };
  }
}
