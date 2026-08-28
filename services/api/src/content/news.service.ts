import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { buildPaginationMeta, type PaginatedResult } from '@barff/types';
import { type Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { MediaResolverService } from '../media/media-resolver.service.js';
import { assertMediaKind } from '../media/media-reference.js';
import {
  type AdminListNewsDto,
  type CreateNewsDto,
  type PublicListNewsDto,
  type UpdateNewsDto,
} from './dto/news.dto.js';
import { PUBLIC_FILTER, publishPatch, publishTransition } from './publishing.js';
import { type Actor, json } from './content.types.js';

type NewsRow = Prisma.NewsArticleGetPayload<Record<string, never>>;

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mediaResolver: MediaResolverService,
  ) {}

  // --- public --------------------------------------------------------------

  /**
   * Public listing.
   *
   * `isActive` and `deletedAt` are pinned here and cannot be influenced by any
   * query parameter, because `PublicListNewsDto` has no field for them.
   */
  async listPublic(query: PublicListNewsDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.NewsArticleWhereInput = PUBLIC_FILTER;

    const [articles, totalItems] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        orderBy: query.orderBy ?? { publishedAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.newsArticle.count({ where }),
    ]);

    const resolve = await this.mediaResolver.resolve(articles.map((a) => a.coverImageId));
    return {
      items: articles.map((article) => this.toPublic(article, resolve(article.coverImageId))),
      meta: buildPaginationMeta(query.page, query.pageSize, totalItems),
    };
  }

  async findPublicBySlug(slug: string): Promise<unknown> {
    const article = await this.prisma.newsArticle.findFirst({
      where: { slug, ...PUBLIC_FILTER },
    });
    // Identical 404 for a draft and for a slug that never existed — otherwise
    // the difference tells anyone guessing which announcements are queued up.
    if (article === null) throw new NotFoundException(this.notFound());

    const resolve = await this.mediaResolver.resolve([article.coverImageId]);
    return this.toPublic(article, resolve(article.coverImageId));
  }

  // --- admin ---------------------------------------------------------------

  async listAdmin(query: AdminListNewsDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.NewsArticleWhereInput = {
      deletedAt: null,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.q === undefined ? {} : { slug: { contains: query.q, mode: 'insensitive' } }),
    };

    const [articles, totalItems] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        orderBy: query.orderBy ?? { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.newsArticle.count({ where }),
    ]);

    return {
      items: articles.map((article) => this.toAdmin(article)),
      meta: buildPaginationMeta(query.page, query.pageSize, totalItems),
    };
  }

  async findAdmin(id: string): Promise<unknown> {
    return this.toAdmin(await this.findOrThrow(id));
  }

  async create(dto: CreateNewsDto, actor: Actor): Promise<unknown> {
    await this.assertSlugAvailable(dto.slug);
    if (dto.coverImageId !== undefined) {
      await assertMediaKind(this.prisma, dto.coverImageId, 'IMAGE');
    }

    const article = await this.prisma.newsArticle.create({
      data: {
        slug: dto.slug,
        title: json(dto.title),
        ...(dto.excerpt === undefined ? {} : { excerpt: json(dto.excerpt) }),
        ...(dto.body === undefined ? {} : { body: json(dto.body) }),
        ...(dto.seo === undefined ? {} : { seo: json(dto.seo) }),
        coverImageId: dto.coverImageId ?? null,
      },
    });

    await this.audit.record({
      action: 'news.created',
      entity: 'NewsArticle',
      entityId: article.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: { slug: article.slug, isActive: article.isActive },
    });

    return this.toAdmin(article);
  }

  async update(id: string, dto: UpdateNewsDto, actor: Actor): Promise<unknown> {
    const existing = await this.findOrThrow(id);
    if (dto.coverImageId !== undefined) {
      await assertMediaKind(this.prisma, dto.coverImageId, 'IMAGE');
    }

    const article = await this.prisma.newsArticle.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: json(dto.title) }),
        ...(dto.excerpt === undefined ? {} : { excerpt: json(dto.excerpt) }),
        ...(dto.body === undefined ? {} : { body: json(dto.body) }),
        ...(dto.seo === undefined ? {} : { seo: json(dto.seo) }),
        ...(dto.coverImageId === undefined ? {} : { coverImageId: dto.coverImageId }),
      },
    });

    await this.audit.record({
      action: 'news.updated',
      entity: 'NewsArticle',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { slug: existing.slug, isActive: existing.isActive },
      after: { slug: article.slug, isActive: article.isActive },
    });

    return this.toAdmin(article);
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
    const article = await this.prisma.newsArticle.update({
      where: { id },
      data: publishPatch(isActive, existing.isActive),
    });

    await this.audit.record({
      action: `news.${publishTransition(isActive, existing.isActive)}`,
      entity: 'NewsArticle',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { slug: existing.slug, isActive: existing.isActive },
      after: { slug: article.slug, isActive: article.isActive },
    });

    return this.toAdmin(article);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const article = await this.findOrThrow(id);

    await this.prisma.newsArticle.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.record({
      action: 'news.deleted',
      entity: 'NewsArticle',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { slug: article.slug },
    });
  }

  // -------------------------------------------------------------------------

  private async findOrThrow(id: string): Promise<NewsRow> {
    const article = await this.prisma.newsArticle.findFirst({ where: { id, deletedAt: null } });
    if (article === null) throw new NotFoundException(this.notFound());
    return article;
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    // Soft-deleted rows count. The slug is a URL that has been published; giving
    // it to a different article would resurrect a dead link.
    const existing = await this.prisma.newsArticle.findUnique({ where: { slug } });
    if (existing !== null) {
      throw new ConflictException({ message: 'Slug is already taken', code: 'SLUG_TAKEN' });
    }
  }

  private toPublic(article: NewsRow, coverImage: unknown) {
    return {
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      body: article.body,
      seo: article.seo,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      coverImage: coverImage ?? null,
    };
  }

  private toAdmin(article: NewsRow) {
    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      body: article.body,
      seo: article.seo,
      coverImageId: article.coverImageId,
      isActive: article.isActive,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    };
  }

  private notFound(): { message: string; code: string } {
    return { message: 'Article not found', code: 'NEWS_NOT_FOUND' };
  }
}
