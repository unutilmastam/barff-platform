import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/index.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { type CreateCategoryDto, type UpdateCategoryDto } from './dto/category.dto.js';

export const CategoryAuditAction = {
  CREATED: 'product_category.created',
  UPDATED: 'product_category.updated',
  DELETED: 'product_category.deleted',
} as const;

interface Actor {
  userId?: string | undefined;
  email?: string | undefined;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateCategoryDto, actor: Actor) {
    await this.assertSlugAvailable(dto.slug);
    if (dto.parentId !== undefined) await this.assertParentExists(dto.parentId);

    const category = await this.prisma.productCategory.create({
      data: {
        slug: dto.slug,
        name: dto.name as unknown as Prisma.InputJsonValue,
        ...(dto.description === undefined
          ? {}
          : { description: dto.description as unknown as Prisma.InputJsonValue }),
        parentId: dto.parentId ?? null,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.record({
      action: CategoryAuditAction.CREATED,
      entity: 'ProductCategory',
      entityId: category.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: { slug: category.slug },
    });

    return this.toDto(category, 0);
  }

  async update(id: string, dto: UpdateCategoryDto, actor: Actor) {
    const existing = await this.findOrThrow(id);

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        // A category that is its own parent makes the tree walk never terminate.
        throw new BadRequestException({
          message: 'A category cannot be its own parent',
          code: 'CATEGORY_CYCLE',
        });
      }
      await this.assertParentExists(dto.parentId);
      await this.assertNotDescendant(id, dto.parentId);
    }

    const category = await this.prisma.productCategory.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name as unknown as Prisma.InputJsonValue }),
        ...(dto.description === undefined
          ? {}
          : { description: dto.description as unknown as Prisma.InputJsonValue }),
        ...(dto.parentId === undefined ? {} : { parentId: dto.parentId }),
        ...(dto.displayOrder === undefined ? {} : { displayOrder: dto.displayOrder }),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      },
    });

    await this.audit.record({
      action: CategoryAuditAction.UPDATED,
      entity: 'ProductCategory',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { slug: existing.slug, isActive: existing.isActive },
      after: { slug: category.slug, isActive: category.isActive },
    });

    return this.toDto(category, await this.countProducts(id));
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const category = await this.findOrThrow(id);

    const productCount = await this.countProducts(id);
    if (productCount > 0) {
      // Deleting would orphan the products' category, silently dropping them
      // out of navigation with no indication why.
      throw new ConflictException({
        message: `Category still has ${productCount} product(s)`,
        code: 'CATEGORY_NOT_EMPTY',
      });
    }

    await this.prisma.productCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.record({
      action: CategoryAuditAction.DELETED,
      entity: 'ProductCategory',
      entityId: id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { slug: category.slug },
    });
  }

  /** Admin listing — includes inactive categories. */
  async listAll() {
    const categories = await this.prisma.productCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { slug: 'asc' }],
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
    return categories.map((category) => this.toDto(category, category._count.products));
  }

  /** Public listing — active only, and only categories that have something in them. */
  async listPublic() {
    const categories = await this.prisma.productCategory.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        products: { some: { isActive: true, deletedAt: null } },
      },
      orderBy: [{ displayOrder: 'asc' }, { slug: 'asc' }],
      include: {
        _count: { select: { products: { where: { isActive: true, deletedAt: null } } } },
      },
    });
    return categories.map((category) => this.toDto(category, category._count.products));
  }

  private async findOrThrow(id: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (category === null) {
      throw new NotFoundException({ message: 'Category not found', code: 'CATEGORY_NOT_FOUND' });
    }
    return category;
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    const existing = await this.prisma.productCategory.findUnique({ where: { slug } });
    if (existing !== null) {
      throw new ConflictException({ message: 'Slug is already taken', code: 'SLUG_TAKEN' });
    }
  }

  private async assertParentExists(parentId: string): Promise<void> {
    const parent = await this.prisma.productCategory.findFirst({
      where: { id: parentId, deletedAt: null },
    });
    if (parent === null) {
      throw new BadRequestException({
        message: 'Parent category not found',
        code: 'CATEGORY_PARENT_NOT_FOUND',
      });
    }
  }

  /**
   * Refuses a move that would put a category under one of its own descendants.
   *
   * Without this the tree becomes a ring: navigation recurses forever and the
   * only symptom is a hung request.
   */
  private async assertNotDescendant(id: string, candidateParentId: string): Promise<void> {
    let cursor: string | null = candidateParentId;
    const seen = new Set<string>();

    while (cursor !== null) {
      if (cursor === id) {
        throw new BadRequestException({
          message: 'A category cannot be moved under its own descendant',
          code: 'CATEGORY_CYCLE',
        });
      }
      if (seen.has(cursor)) break;
      seen.add(cursor);

      const parent: { parentId: string | null } | null =
        await this.prisma.productCategory.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
      cursor = parent?.parentId ?? null;
    }
  }

  private countProducts(categoryId: string): Promise<number> {
    return this.prisma.product.count({ where: { categoryId, deletedAt: null } });
  }

  private toDto(
    category: {
      id: string;
      slug: string;
      name: Prisma.JsonValue;
      description: Prisma.JsonValue;
      parentId: string | null;
      displayOrder: number;
      isActive: boolean;
    },
    productCount: number,
  ) {
    return {
      id: category.id,
      slug: category.slug,
      name: category.name as Record<string, string>,
      description: category.description as Record<string, string> | null,
      parentId: category.parentId,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      productCount,
    };
  }
}
