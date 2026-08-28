import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { type AuthenticatedUser } from '../auth/types.js';
import { ProductsService } from './products.service.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import {
  AdminListProductsDto,
  AttachDocumentDto,
  AttachImageDto,
  CreateProductDto,
  CreateVariantDto,
  ReorderDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/product.dto.js';

const actor = (user: AuthenticatedUser) => ({ userId: user.id, email: user.email });

/**
 * Admin product management.
 *
 * Every route carries a permission, and reads here need `products:read_all`
 * rather than `products:read`. The distinction matters: dealers hold
 * `products:read` so they can see the catalogue, and these endpoints return
 * unpublished drafts. Reusing the one permission would have let any dealer
 * account list products BARFF has not announced yet.
 *
 * Anything that changes what the public site shows needs `products:update`, and
 * the guard refuses regardless of what the admin UI chooses to display
 * (`CLAUDE.md` §3).
 */
@ApiTags('admin: products')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/products', version: '1' })
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Permissions('products:read_all')
  @ApiOperation({ summary: 'List products, including drafts' })
  list(@Query() query: AdminListProductsDto) {
    return this.products.listAdmin(query);
  }

  @Get(':id')
  @Permissions('products:read_all')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findAdmin(id);
  }

  @Post()
  @Permissions('products:create')
  @ApiOperation({
    summary: 'Create a product',
    description: 'Created as a draft unless `isActive` is explicitly true.',
  })
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.products.create(dto, actor(user));
  }

  @Patch(':id')
  @Permissions('products:update')
  @ApiOperation({
    summary: 'Update a product',
    description:
      'The slug cannot be changed here — it is the public URL, and renaming it breaks every existing link.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.update(id, dto, actor(user));
  }

  @Delete(':id')
  @Permissions('products:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product',
    description: 'Soft delete — order history references its variants.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.products.remove(id, actor(user));
  }

  @Post(':id/variants')
  @Permissions('products:update')
  addVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVariantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.addVariant(id, dto, actor(user));
  }

  @Patch(':id/variants/:variantId')
  @Permissions('products:update')
  updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateVariantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.updateVariant(id, variantId, dto, actor(user));
  }

  @Delete(':id/variants/:variantId')
  @Permissions('products:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.products.removeVariant(id, variantId, actor(user));
  }

  @Post(':id/images')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Attach an image from the media library' })
  attachImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.attachImage(id, dto, actor(user));
  }

  @Put(':id/images/order')
  @Permissions('products:update')
  reorderImages(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.reorderImages(id, dto, actor(user));
  }

  @Delete(':id/images/:imageId')
  @Permissions('products:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  async detachImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.products.detachImage(id, imageId, actor(user));
  }

  @Post(':id/documents')
  @Permissions('products:update')
  attachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.attachDocument(id, dto, actor(user));
  }

  @Delete(':id/documents/:documentId')
  @Permissions('products:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  async detachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.products.detachDocument(id, documentId, actor(user));
  }
}

@ApiTags('admin: product categories')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/product-categories', version: '1' })
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Permissions('products:read_all')
  list() {
    return this.categories.listAll();
  }

  @Post()
  @Permissions('products:create')
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categories.create(dto, actor(user));
  }

  @Patch(':id')
  @Permissions('products:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categories.update(id, dto, actor(user));
  }

  @Delete(':id')
  @Permissions('products:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a category',
    description: 'Refused while products still belong to it.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.categories.remove(id, actor(user));
  }
}
