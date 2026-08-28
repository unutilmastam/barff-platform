import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service.js';
import { FilesystemStorageProvider } from './filesystem-storage.provider.js';
import { S3StorageProvider } from './s3-storage.provider.js';
import { STORAGE_PROVIDER, type StorageProvider } from './storage-provider.interface.js';

/**
 * Chooses the provider once, at boot, from configuration.
 *
 * The decision is made here and nowhere else: no service branches on which
 * backend is in use, which is what keeps the adapter seam real rather than
 * decorative. Production is prevented from selecting `filesystem` by the env
 * schema, not by convention.
 */
@Global()
@Module({
  providers: [
    S3StorageProvider,
    FilesystemStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [AppConfigService, S3StorageProvider, FilesystemStorageProvider],
      useFactory: (
        config: AppConfigService,
        s3: S3StorageProvider,
        filesystem: FilesystemStorageProvider,
      ): StorageProvider => (config.storage.provider === 's3' ? s3 : filesystem),
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
