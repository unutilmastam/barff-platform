import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { AdminCategoriesController, AdminProductsController } from './products.controller.js';
import { PublicProductsController } from './public-products.controller.js';
import { CategoriesService } from './categories.service.js';
import { ProductsService } from './products.service.js';

@Module({
  // MediaModule for signed image URLs — products never talk to storage directly.
  imports: [MediaModule],
  controllers: [PublicProductsController, AdminProductsController, AdminCategoriesController],
  providers: [ProductsService, CategoriesService],
  exports: [ProductsService],
})
export class ProductsModule {}
