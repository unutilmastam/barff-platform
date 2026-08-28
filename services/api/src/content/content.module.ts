import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import {
  AdminCertificatesController,
  AdminDocumentsController,
  AdminGalleryController,
  AdminNewsController,
  AdminPageSectionsController,
  AdminProductionStepsController,
  AdminSeoController,
  AdminSettingsController,
} from './admin-content.controller.js';
import { PublicContentController, PublicNewsController } from './public-content.controller.js';
import { CertificatesService } from './certificates.service.js';
import { DocumentsService } from './documents.service.js';
import { GalleryService } from './gallery.service.js';
import { NewsService } from './news.service.js';
import { PageSectionsService } from './page-sections.service.js';
import { ProductionStepsService } from './production-steps.service.js';
import { SeoService } from './seo.service.js';
import { SettingsService } from './settings.service.js';

/**
 * The CMS behind `admin.barff.uz` and the public reads of `barff.uz`.
 *
 * One module rather than eight: every part shares the same publish/draft rules,
 * the same media resolution and the same permission set, and splitting them
 * would mean eight modules importing each other to say so.
 */
@Module({
  // For signed media URLs. Content never talks to storage directly.
  imports: [MediaModule],
  controllers: [
    PublicNewsController,
    PublicContentController,
    AdminNewsController,
    AdminCertificatesController,
    AdminGalleryController,
    AdminDocumentsController,
    AdminPageSectionsController,
    AdminProductionStepsController,
    AdminSeoController,
    AdminSettingsController,
  ],
  providers: [
    NewsService,
    CertificatesService,
    GalleryService,
    DocumentsService,
    PageSectionsService,
    ProductionStepsService,
    SeoService,
    SettingsService,
  ],
  exports: [SettingsService],
})
export class ContentModule {}
