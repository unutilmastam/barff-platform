import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { CacheNamespace, PublicCache } from '../common/cache/cache.constants.js';
import { ProductsService } from './products.service.js';
import { CategoriesService } from './categories.service.js';
import { PublicListProductsDto } from './dto/product.dto.js';

/**
 * Public catalogue — `GET /products`, `GET /products/:slug` (§11).
 *
 * Separate from the admin controller rather than sharing one with a flag. The
 * public listing has no parameter that could reveal a draft, because the DTO it
 * binds has no such field: a draft cannot be requested here even by someone who
 * knows the column exists.
 *
 * Cached by `HttpCacheInterceptor` and retired by `CacheNamespace.PRODUCTS`,
 * which every admin write in this module bumps.
 */
@ApiTags('products')
@Public()
@PublicCache({ namespace: CacheNamespace.PRODUCTS, ttlSeconds: 300 })
@Controller({ path: 'products', version: '1' })
export class PublicProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly categories: CategoriesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List published products',
    description: 'Only active, non-deleted products. Drafts are not reachable from here.',
  })
  @ApiOkResponse({ description: 'Paginated products with images and active variants.' })
  list(@Query() query: PublicListProductsDto) {
    return this.products.listPublic(query);
  }

  @Get('categories')
  @ApiOperation({
    summary: 'List categories that have published products',
    description: 'An empty category is omitted rather than shown as a dead end.',
  })
  listCategories() {
    return this.categories.listPublic();
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Product by slug',
    description: 'A draft returns 404, identical to a slug that does not exist.',
  })
  findOne(@Param('slug') slug: string) {
    return this.products.findPublicBySlug(slug);
  }
}
