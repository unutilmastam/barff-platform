import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { NewsService } from './news.service.js';
import { CertificatesService } from './certificates.service.js';
import { GalleryService } from './gallery.service.js';
import { DocumentsService } from './documents.service.js';
import { PageSectionsService } from './page-sections.service.js';
import { ProductionStepsService } from './production-steps.service.js';
import { SeoService } from './seo.service.js';
import { SettingsService } from './settings.service.js';
import { PublicListNewsDto } from './dto/news.dto.js';
import { PublicListGalleryDto } from './dto/gallery.dto.js';
import { PublicListDocumentsDto } from './dto/public-document.dto.js';
import { type PageKey, PAGE_KEYS } from './dto/page-section.dto.js';
import { SeoLookupDto } from './dto/seo.dto.js';
import { BadRequestException } from '@nestjs/common';

/**
 * Public news (`/news`, `/news/[slug]`).
 *
 * Separate classes from the admin controllers rather than one class with a
 * flag. Every query DTO here is missing the fields that could reveal a draft,
 * so an unpublished article is not merely filtered out — it cannot be asked
 * for. `forbidNonWhitelisted` turns the attempt into a 400.
 */
@ApiTags('news')
@Public()
@Controller({ path: 'news', version: '1' })
export class PublicNewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'List published articles, newest first' })
  @ApiOkResponse({ description: 'Paginated articles with their cover images.' })
  list(@Query() query: PublicListNewsDto) {
    return this.news.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Article by slug',
    description: 'A draft returns 404, identical to a slug that does not exist.',
  })
  findOne(@Param('slug') slug: string) {
    return this.news.findPublicBySlug(slug);
  }
}

/**
 * Everything else the public site reads from the CMS.
 *
 * Grouped under one controller because these are all small, unpaginated reads
 * that a page fetches alongside its main content. S11 wraps them in caching.
 */
@ApiTags('content')
@Public()
@Controller({ path: 'content', version: '1' })
export class PublicContentController {
  constructor(
    private readonly certificates: CertificatesService,
    private readonly gallery: GalleryService,
    private readonly documents: DocumentsService,
    private readonly sections: PageSectionsService,
    private readonly steps: ProductionStepsService,
    private readonly seo: SeoService,
    private readonly settings: SettingsService,
  ) {}

  @Get('certificates')
  @ApiOperation({ summary: 'Published certificates for /quality' })
  listCertificates() {
    return this.certificates.listPublic();
  }

  @Get('gallery')
  @ApiOperation({ summary: 'Published gallery items' })
  listGallery(@Query() query: PublicListGalleryDto) {
    return this.gallery.listPublic(query);
  }

  @Get('documents')
  @ApiOperation({
    summary: 'Published downloads',
    description:
      'Each file is served through a short-lived signed URL, never a public bucket path.',
  })
  listDocuments(@Query() query: PublicListDocumentsDto) {
    return this.documents.listPublic(query);
  }

  @Get('production-steps')
  @ApiOperation({ summary: 'The production process, in order' })
  listProductionSteps() {
    return this.steps.listPublic();
  }

  @Get('seo')
  @ApiOperation({
    summary: 'SEO override for a route',
    description:
      'Returns null when the route has no override — that is a normal answer, not a 404.',
  })
  findSeo(@Query() query: SeoLookupDto) {
    return this.seo.findPublic(query.path);
  }

  @Get('settings')
  @ApiOperation({
    summary: 'Settings flagged public',
    description: 'A flat key/value map. Private settings are never included.',
  })
  listSettings() {
    return this.settings.listPublic();
  }

  @Get('sections/:page')
  @ApiOperation({ summary: 'Published sections of a landing page, in render order' })
  listSections(@Param('page') page: string) {
    // Validated here rather than by a pipe so an unknown page reads as a client
    // error naming the allowed values, instead of an empty list that looks like
    // a page nobody has filled in yet.
    if (!(PAGE_KEYS as readonly string[]).includes(page)) {
      throw new BadRequestException({
        message: `Unknown page. Expected one of: ${PAGE_KEYS.join(', ')}`,
        code: 'UNKNOWN_PAGE',
      });
    }
    return this.sections.listPublic(page as PageKey);
  }
}
