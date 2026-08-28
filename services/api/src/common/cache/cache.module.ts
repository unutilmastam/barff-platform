import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service.js';

/**
 * Global because both the interceptor and every write path need it, and
 * threading it through eight feature modules would say nothing useful.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
