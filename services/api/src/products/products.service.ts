import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { buildPaginationMeta, type PaginatedResult } from '@barff/types';
import { type Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { MediaResolverService } from '../media/media-resolver.service.js';
import { assertMediaKind } from '../media/media-reference.js';
import { PRODUCT_INCLUDE, toAdminProduct, toPublicProduct } from './products.mapper.js';
import {
  type AdminListProductsDto,
  type AttachDocumentDto,
  type AttachImageDto,
  type CreateProductDto,
  type CreateVariantDto,
  type PublicListProductsDto,
  type ReorderDto,
  type UpdateProductDto,
  type UpdateVariantDto,
} from './dto/product.dto.js';

export const ProductAuditAction = {
  CREATED: 'product.created',
  UPDATED: 'product.updated',
  PUBLISHED: 'product.published',
  UNPUBLISHED: 'product.unpublished',
  DELETED: 'product.deleted',
  VARIANT_CREATED: 'product_variant.created',
  VARIANT_UPDATED: 'product_variant.updated',
  VARIANT_DELETED: 'product_variant.deleted',
  IMAGE_ATTACHED: 'product_image.attached',
  IMAGE_DETACHED: 'product_image.detached',
  DOCUMENT_ATTACHED: 'product_document.attached',
  DOCUMENT_DETACHED: 'product_document.detached',
} as const;

interface Actor {
  userId?: string | undefined;
  email?: string | undefined;
}

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mediaResolver: MediaResolverService,
  ) {}

  // -------------------------------------------------------------------------
  // Public reads
  // -------------------------------------------------------------------------

  /**
   * Public listing.
   *
   * `isActive` and `deletedAt` are applied here and are not overridable by any
   * query parameter — the DTO has no field for them. A draft must not be
   * reachable by guessing a URL (S09 DoD).
   */
  async listPublic(query: PublicListProductsDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      deletedAt: null,
      ...(query.category === undefined
        ? {}
        : { category: { slug: query.category, isActive: true, deletedAt: null } }),
      ...(query.flavor === undefined ? {} : { flavor: query.flavor }),
    };

    const [products, totalItems] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: query.orderBy ?? { displayOrder: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.product.count({ where }),
    ]);

    const resolve = await this.resolveImages(products);
    return {
      items: products.map((product) => toPublicProduct(product, resolve)),
      meta: buildPaginationMeta(query.page, query.pageSize, totalItems),
    };
  }

  async findPublicBySlug(slug: string): Promise<unknown> {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    // A draft and a nonexistent product return the same 404. Distinguishing
    // them would confirm which slugs are being worked on before launch.
    if (product === null) throw new NotFoundException(this.notFound());

    const resolve = await this.resolveImages([product]);
    return toPublicProduct(product, resolve);
  }

  // -------------------------------------------------------------------------
  // Admin reads
  // -------------------------------------------------------------------------

  async listAdmin(query: AdminListProductsDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.q === undefined ? {} : { slug: { contains: query.q, mode: 'insensitive' } }),
    };

    const [products, totalItems] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: query.orderBy ?? { displayOrder: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: products.map(toAdminProduct),
      meta: buildPaginationMeta(query.page, query.pageSize, totalItems),
    };
  }

  async findAdmin(id: string): Promise<unknown> {
    return toAdminProduct(await this.findOrThrow(id));
  }

  // -------------------------------------------------------------------------
  // Admin writes
  // -------------------------------------------------------------------------

  async create(dto: CreateProductDto, actor: Actor): Promise<unknown> {
    await this.assertSlugAvailable(dto.slug);
    if (dto.categoryId !== undefined) await this.assertCategoryExists(dto.categoryId);

    const isActive = dto.isActive ?? false;
    const product = await this.prisma.product.create({
      data: {
        slug: dto.slug,
        name: json(dto.name),
        categoryId: dto.categoryId ?? null,
        ...(dto.shortDescription === undefined
          ? {}
          : { shortDescription: json(dto.shortDescription) }),
        ...(dto.description === undefined ? {} : { description: json(dto.description) }),
        ...(dto.ingredients === undefined ? {} : { ingredients: json(dto.ingredients) }),
        ...(dto.storage === undefined ? {} : { storage: json(dto.storage) }),
        ...(dto.seo === undefined ? {} : { seo: json(dto.seo) }),
        flavor: dto.flavor ?? null,
        shelfLifeDays: dto.shelfLifeDays ?? null,
        isActive,
        publishedAt: isActive ? new Date() : null,
        displayOrder: dto.displayOrder ?? 0,
      },
      include: PRODUCT_INCLUDE,
    });

    await this.audit.record({
      action: ProductAuditAction.CREATED,
      entity: 'Product',
      entityId: product.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: { slug: product.slug, isActive: product.isActive },
    });

    return toAdminProduct(product);
  }

  async update(id: string, dto: UpdateProductDto, actor: Actor): Promise<unknown> {
    const existing = await this.findOrThrow(id);
    if (dto.categoryId !== undefined) await this.assertCategoryExists(dto.categoryId);

    // Publishing is stamped once, on the transition. Re-saving a published
    // product must not move its publication date.
    const becomingActive = dto.isActive === true && !existing.isActive;

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: json(dto.name) }),
        ...(dto.categoryId === undefined ? {} : { categoryId: dto.categoryId }),
        ...(dto.shortDescription === undefined
          ? {}
          : { shortDescription: json(dto.shortDescription) }),
        ...(dto.description === undefined ? {} : { description: json(dto.description) }),
        ...(dto.ingredients === undefined ? {} : { ingredients: json(dto.ingredients) }),
        ...(dto.storage === undefined ? {} : { storage: json(dto.storage) }),
        ...(dto.seo === undefined ? {} : { seo: json(dto.seo) }),
        ...(dto.flavor === undefined ? {} : { flavor: dto.flavor }),
        ...(dto.shelfLifeDays === undefined ? {} : { shelfLifeDays: dto.shelfLifeDays }),
        ...(dto.displayOrder === undefined ? {} : { displayOrder: dto.displayOrder }),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
        ...(becomingActive ? { publishedAt: new Date() } : {}),
      },
      include: PRODUCT_INCLUDE,
    });

    const action =
      dto.isActive === true && !existing.isActive
        ? ProductAuditAction.PUBLISHED
        : dto.isActive === false && existing.isActive
          ? ProductAuditAction.UNPUBLISHED
          : ProductAuditAction.UPDATED;

    await this.audit.record({
      action,
      entity: 'Product',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { slug: existing.slug, isActive: existing.isActive },
      after: { slug: product.slug, isActive: product.isActive },
    });

    return toAdminProduct(product);
  }

  /**
   * Soft-deletes a product.
   *
   * Orders reference variants, so the rows have to survive — a hard delete
   * would orphan order history. The public API filters on `deletedAt`, so the
   * page disappears immediately regardless.
   */
  async remove(id: string, actor: Actor): Promise<void> {
    const product = await this.findOrThrow(id);

    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
      this.prisma.productVariant.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      }),
    ]);

    await this.audit.record({
      action: ProductAuditAction.DELETED,
      entity: 'Product',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { slug: product.slug },
    });
  }

  // --- variants ------------------------------------------------------------

  async addVariant(productId: string, dto: CreateVariantDto, actor: Actor): Promise<unknown> {
    await this.findOrThrow(productId);
    await this.assertVariantCodesAvailable(dto.sku, dto.barcode);

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        volumeMl: dto.volumeMl,
        sku: dto.sku ?? null,
        barcode: dto.barcode ?? null,
        packSize: dto.packSize ?? null,
        ...(dto.nutrition === undefined ? {} : { nutrition: json(dto.nutrition) }),
        isActive: dto.isActive ?? true,
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    await this.audit.record({
      action: ProductAuditAction.VARIANT_CREATED,
      entity: 'ProductVariant',
      entityId: variant.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: { productId, volumeMl: variant.volumeMl, sku: variant.sku },
    });

    return toAdminProduct(await this.findOrThrow(productId));
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
    actor: Actor,
  ): Promise<unknown> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, deletedAt: null },
    });
    if (variant === null) {
      throw new NotFoundException({ message: 'Variant not found', code: 'VARIANT_NOT_FOUND' });
    }
    await this.assertVariantCodesAvailable(dto.sku, dto.barcode, variantId);

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(dto.volumeMl === undefined ? {} : { volumeMl: dto.volumeMl }),
        ...(dto.sku === undefined ? {} : { sku: dto.sku }),
        ...(dto.barcode === undefined ? {} : { barcode: dto.barcode }),
        ...(dto.packSize === undefined ? {} : { packSize: dto.packSize }),
        ...(dto.nutrition === undefined ? {} : { nutrition: json(dto.nutrition) }),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
        ...(dto.displayOrder === undefined ? {} : { displayOrder: dto.displayOrder }),
      },
    });

    await this.audit.record({
      action: ProductAuditAction.VARIANT_UPDATED,
      entity: 'ProductVariant',
      entityId: variantId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { sku: variant.sku, isActive: variant.isActive },
      after: { sku: dto.sku ?? variant.sku, isActive: dto.isActive ?? variant.isActive },
    });

    return toAdminProduct(await this.findOrThrow(productId));
  }

  async removeVariant(productId: string, variantId: string, actor: Actor): Promise<void> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, deletedAt: null },
    });
    if (variant === null) {
      throw new NotFoundException({ message: 'Variant not found', code: 'VARIANT_NOT_FOUND' });
    }

    // Soft-deleted for the same reason products are: order items point at it.
    // The unique SKU is released so the code can be reused on a replacement.
    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { deletedAt: new Date(), isActive: false, sku: null, barcode: null },
    });

    await this.audit.record({
      action: ProductAuditAction.VARIANT_DELETED,
      entity: 'ProductVariant',
      entityId: variantId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { productId, sku: variant.sku, volumeMl: variant.volumeMl },
    });
  }

  // --- images and documents ------------------------------------------------

  async attachImage(productId: string, dto: AttachImageDto, actor: Actor): Promise<unknown> {
    await this.findOrThrow(productId);
    await assertMediaKind(this.prisma, dto.mediaAssetId, 'IMAGE');

    const isPrimary = dto.isPrimary ?? false;
    await this.prisma.$transaction(async (tx) => {
      if (isPrimary) {
        // Exactly one primary. Without this a gallery can end up with two and
        // the "main image" becomes whichever the query returns first.
        await tx.productImage.updateMany({
          where: { productId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      await tx.productImage.create({
        data: {
          productId,
          mediaAssetId: dto.mediaAssetId,
          ...(dto.altText === undefined ? {} : { altText: json(dto.altText) }),
          isPrimary,
          displayOrder: dto.displayOrder ?? 0,
        },
      });
    });

    await this.audit.record({
      action: ProductAuditAction.IMAGE_ATTACHED,
      entity: 'Product',
      entityId: productId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: { mediaAssetId: dto.mediaAssetId, isPrimary },
    });

    return toAdminProduct(await this.findOrThrow(productId));
  }

  async detachImage(productId: string, imageId: string, actor: Actor): Promise<void> {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (image === null) {
      throw new NotFoundException({ message: 'Image not found', code: 'PRODUCT_IMAGE_NOT_FOUND' });
    }
    await this.prisma.productImage.delete({ where: { id: imageId } });

    await this.audit.record({
      action: ProductAuditAction.IMAGE_DETACHED,
      entity: 'Product',
      entityId: productId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { mediaAssetId: image.mediaAssetId },
    });
  }

  async reorderImages(productId: string, dto: ReorderDto, _actor: Actor): Promise<unknown> {
    await this.findOrThrow(productId);
    const images = await this.prisma.productImage.findMany({ where: { productId } });
    const known = new Set(images.map((image) => image.id));

    // Reordering a list that does not match what the client saw would silently
    // drop entries, so a mismatch is refused rather than partially applied.
    if (dto.ids.length !== images.length || dto.ids.some((id) => !known.has(id))) {
      throw new BadRequestException({
        message: 'Reorder must list exactly the images of this product',
        code: 'REORDER_MISMATCH',
      });
    }

    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.productImage.update({ where: { id }, data: { displayOrder: index } }),
      ),
    );

    return toAdminProduct(await this.findOrThrow(productId));
  }

  async attachDocument(productId: string, dto: AttachDocumentDto, actor: Actor): Promise<unknown> {
    await this.findOrThrow(productId);
    await assertMediaKind(this.prisma, dto.mediaAssetId, 'DOCUMENT');

    await this.prisma.productDocument.create({
      data: {
        productId,
        mediaAssetId: dto.mediaAssetId,
        kind: dto.kind,
        title: json(dto.title),
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    await this.audit.record({
      action: ProductAuditAction.DOCUMENT_ATTACHED,
      entity: 'Product',
      entityId: productId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: { mediaAssetId: dto.mediaAssetId, kind: dto.kind },
    });

    return toAdminProduct(await this.findOrThrow(productId));
  }

  async detachDocument(productId: string, documentId: string, actor: Actor): Promise<void> {
    const document = await this.prisma.productDocument.findFirst({
      where: { id: documentId, productId },
    });
    if (document === null) {
      throw new NotFoundException({
        message: 'Document not found',
        code: 'PRODUCT_DOCUMENT_NOT_FOUND',
      });
    }
    await this.prisma.productDocument.delete({ where: { id: documentId } });

    await this.audit.record({
      action: ProductAuditAction.DOCUMENT_DETACHED,
      entity: 'Product',
      entityId: productId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { mediaAssetId: document.mediaAssetId },
    });
  }

  // -------------------------------------------------------------------------

  private async findOrThrow(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (product === null) throw new NotFoundException(this.notFound());
    return product;
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    // Includes soft-deleted rows: the slug is the public URL, and reusing one
    // would resurrect a dead link pointing at different content.
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing !== null) {
      throw new ConflictException({ message: 'Slug is already taken', code: 'SLUG_TAKEN' });
    }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
    });
    if (category === null) {
      throw new BadRequestException({
        message: 'Category not found',
        code: 'CATEGORY_NOT_FOUND',
      });
    }
  }

  private async assertVariantCodesAvailable(
    sku: string | undefined,
    barcode: string | undefined,
    excludeVariantId?: string,
  ): Promise<void> {
    for (const [field, value] of [
      ['sku', sku],
      ['barcode', barcode],
    ] as const) {
      if (value === undefined) continue;
      const existing = await this.prisma.productVariant.findFirst({
        where: {
          [field]: value,
          ...(excludeVariantId === undefined ? {} : { id: { not: excludeVariantId } }),
        },
      });
      if (existing !== null) {
        throw new ConflictException({
          message: `${field} is already in use`,
          code: field === 'sku' ? 'SKU_TAKEN' : 'BARCODE_TAKEN',
        });
      }
    }
  }

  private resolveImages(products: { images: { mediaAssetId: string }[] }[]) {
    return this.mediaResolver.resolve(products.flatMap((p) => p.images.map((i) => i.mediaAssetId)));
  }

  private notFound(): { message: string; code: string } {
    return { message: 'Product not found', code: 'PRODUCT_NOT_FOUND' };
  }
}
