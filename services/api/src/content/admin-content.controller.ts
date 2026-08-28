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
import { NewsService } from './news.service.js';
import { CertificatesService } from './certificates.service.js';
import { GalleryService } from './gallery.service.js';
import { DocumentsService } from './documents.service.js';
import { PageSectionsService } from './page-sections.service.js';
import { ProductionStepsService } from './production-steps.service.js';
import { SeoService } from './seo.service.js';
import { SettingsService } from './settings.service.js';
import { AdminListNewsDto, CreateNewsDto, UpdateNewsDto } from './dto/news.dto.js';
import {
  AdminListCertificatesDto,
  CreateCertificateDto,
  UpdateCertificateDto,
} from './dto/certificate.dto.js';
import {
  AdminListGalleryDto,
  CreateGalleryItemDto,
  UpdateGalleryItemDto,
} from './dto/gallery.dto.js';
import {
  AdminListDocumentsDto,
  CreatePublicDocumentDto,
  UpdatePublicDocumentDto,
} from './dto/public-document.dto.js';
import {
  AdminListSectionsDto,
  CreatePageSectionDto,
  UpdatePageSectionDto,
} from './dto/page-section.dto.js';
import { UpdateProductionStepDto } from './dto/production-step.dto.js';
import { UpsertSeoDto } from './dto/seo.dto.js';
import { UpdateSettingDto } from './dto/setting.dto.js';

const actor = (user: AuthenticatedUser) => ({ userId: user.id, email: user.email });

/**
 * Admin CMS (`CLAUDE.md` §8).
 *
 * Three permissions, deliberately distinct:
 *
 * - `content:read` — see everything, drafts included. Held only by ADMIN, so
 *   unlike `products:read` there is no role that legitimately needs a narrower
 *   view of the same endpoint.
 * - `content:update` — create, edit and remove. Editing never changes whether
 *   something is live.
 * - `content:publish` — put a page in front of visitors, or take it down.
 *
 * Publishing is its own endpoint for exactly that reason. Folding `isActive`
 * into the edit payload would make the third permission unreachable: anyone who
 * could fix a typo could also publish an unfinished announcement.
 */
@ApiTags('admin: news')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/news', version: '1' })
export class AdminNewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @Permissions('content:read')
  @ApiOperation({ summary: 'List articles, including drafts' })
  list(@Query() query: AdminListNewsDto) {
    return this.news.listAdmin(query);
  }

  @Get(':id')
  @Permissions('content:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.news.findAdmin(id);
  }

  @Post()
  @Permissions('content:update')
  @ApiOperation({ summary: 'Create an article', description: 'Always created as a draft.' })
  create(@Body() dto: CreateNewsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.news.create(dto, actor(user));
  }

  @Patch(':id')
  @Permissions('content:update')
  @ApiOperation({
    summary: 'Edit an article',
    description:
      'The slug cannot be changed — it is the public URL. Publishing is a separate endpoint.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNewsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.news.update(id, dto, actor(user));
  }

  @Post(':id/publish')
  @Permissions('content:publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.news.setPublished(id, true, actor(user));
  }

  @Post(':id/unpublish')
  @Permissions('content:publish')
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.news.setPublished(id, false, actor(user));
  }

  @Delete(':id')
  @Permissions('content:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an article',
    description: 'Soft delete — the slug stays taken.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.news.remove(id, actor(user));
  }
}

@ApiTags('admin: certificates')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/certificates', version: '1' })
export class AdminCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  @Permissions('content:read')
  list(@Query() query: AdminListCertificatesDto) {
    return this.certificates.listAdmin(query);
  }

  @Post()
  @Permissions('content:update')
  create(@Body() dto: CreateCertificateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.certificates.create(dto, actor(user));
  }

  @Patch(':id')
  @Permissions('content:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificates.update(id, dto, actor(user));
  }

  @Post(':id/publish')
  @Permissions('content:publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.certificates.setPublished(id, true, actor(user));
  }

  @Post(':id/unpublish')
  @Permissions('content:publish')
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.certificates.setPublished(id, false, actor(user));
  }

  @Delete(':id')
  @Permissions('content:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.certificates.remove(id, actor(user));
  }
}

@ApiTags('admin: gallery')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/gallery', version: '1' })
export class AdminGalleryController {
  constructor(private readonly gallery: GalleryService) {}

  @Get()
  @Permissions('content:read')
  list(@Query() query: AdminListGalleryDto) {
    return this.gallery.listAdmin(query);
  }

  @Post()
  @Permissions('content:update')
  create(@Body() dto: CreateGalleryItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.gallery.create(dto, actor(user));
  }

  @Patch(':id')
  @Permissions('content:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGalleryItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gallery.update(id, dto, actor(user));
  }

  @Post(':id/publish')
  @Permissions('content:publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.gallery.setPublished(id, true, actor(user));
  }

  @Post(':id/unpublish')
  @Permissions('content:publish')
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.gallery.setPublished(id, false, actor(user));
  }

  @Delete(':id')
  @Permissions('content:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.gallery.remove(id, actor(user));
  }
}

@ApiTags('admin: documents')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/documents', version: '1' })
export class AdminDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @Permissions('content:read')
  list(@Query() query: AdminListDocumentsDto) {
    return this.documents.listAdmin(query);
  }

  @Post()
  @Permissions('content:update')
  create(@Body() dto: CreatePublicDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.create(dto, actor(user));
  }

  @Patch(':id')
  @Permissions('content:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePublicDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.update(id, dto, actor(user));
  }

  @Post(':id/publish')
  @Permissions('content:publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.setPublished(id, true, actor(user));
  }

  @Post(':id/unpublish')
  @Permissions('content:publish')
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.setPublished(id, false, actor(user));
  }

  @Delete(':id')
  @Permissions('content:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.documents.remove(id, actor(user));
  }
}

@ApiTags('admin: page sections')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/page-sections', version: '1' })
export class AdminPageSectionsController {
  constructor(private readonly sections: PageSectionsService) {}

  @Get()
  @Permissions('content:read')
  @ApiOperation({ summary: 'List sections of every landing page, drafts included' })
  list(@Query() query: AdminListSectionsDto) {
    return this.sections.listAdmin(query);
  }

  @Post()
  @Permissions('content:update')
  create(@Body() dto: CreatePageSectionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sections.create(dto, actor(user));
  }

  @Patch(':id')
  @Permissions('content:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePageSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sections.update(id, dto, actor(user));
  }

  @Post(':id/publish')
  @Permissions('content:publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sections.setPublished(id, true, actor(user));
  }

  @Post(':id/unpublish')
  @Permissions('content:publish')
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sections.setPublished(id, false, actor(user));
  }

  @Delete(':id')
  @Permissions('content:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.sections.remove(id, actor(user));
  }
}

@ApiTags('admin: production steps')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/production-steps', version: '1' })
export class AdminProductionStepsController {
  constructor(private readonly steps: ProductionStepsService) {}

  @Get()
  @Permissions('content:read')
  @ApiOperation({
    summary: 'The eight production stages',
    description:
      'Edit-only. The stages and their order come from the specification, so there is no create and no delete.',
  })
  list() {
    return this.steps.listAdmin();
  }

  @Patch(':id')
  @Permissions('content:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductionStepDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.steps.update(id, dto, actor(user));
  }

  @Post(':id/publish')
  @Permissions('content:publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.steps.setPublished(id, true, actor(user));
  }

  @Post(':id/unpublish')
  @Permissions('content:publish')
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.steps.setPublished(id, false, actor(user));
  }
}

@ApiTags('admin: seo')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/seo', version: '1' })
export class AdminSeoController {
  constructor(private readonly seo: SeoService) {}

  @Get()
  @Permissions('content:read')
  list() {
    return this.seo.listAdmin();
  }

  @Put()
  @Permissions('content:update')
  @ApiOperation({
    summary: 'Create or replace the override for a route',
    description: 'Keyed by the normalized path, so there is one row per page and no duplicates.',
  })
  upsert(@Body() dto: UpsertSeoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.seo.upsert(dto, actor(user));
  }

  @Delete(':id')
  @Permissions('content:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an override', description: 'The route falls back to defaults.' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.seo.remove(id, actor(user));
  }
}

@ApiTags('admin: settings')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/settings', version: '1' })
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Permissions('settings:read')
  list() {
    return this.settings.listAdmin();
  }

  @Patch(':key')
  @Permissions('settings:update')
  @ApiOperation({
    summary: 'Change a setting',
    description:
      'Only keys that already exist. Settings are declared in the seed, not invented here.',
  })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.update(key, dto, actor(user));
  }
}
