import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AppConfigService } from '../common/config/app-config.service.js';
import { StorageModule } from './storage/storage.module.js';
import { ImageProcessorService } from './processing/image-processor.service.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { MediaResolverService } from './media-resolver.service.js';

@Module({
  imports: [
    StorageModule,
    MulterModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        // Memory, not disk: the bytes have to be sniffed and re-encoded before
        // anything is written, and a disk temp file would be a second place an
        // unvalidated upload exists.
        storage: memoryStorage(),
        limits: {
          fileSize: config.storage.maxUploadBytes,
          files: 1,
          // Bounds the multipart parser itself, so a request with thousands of
          // tiny fields cannot exhaust memory before any size check runs.
          fields: 10,
          parts: 12,
        },
      }),
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService, ImageProcessorService, MediaResolverService],
  exports: [MediaService, MediaResolverService],
})
export class MediaModule {}
