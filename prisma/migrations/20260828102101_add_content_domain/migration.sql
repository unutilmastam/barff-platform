-- CreateEnum
CREATE TYPE "gallery_category" AS ENUM ('FACTORY', 'PRODUCTION', 'PRODUCTS', 'WAREHOUSE', 'TEAM', 'EVENTS', 'OTHER');

-- CreateEnum
CREATE TYPE "public_document_kind" AS ENUM ('CATALOG', 'PRICE_LIST', 'PRESENTATION', 'CERTIFICATE', 'LEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "page_section_type" AS ENUM ('HERO', 'RICH_TEXT', 'STATS', 'MEDIA', 'CTA');

-- CreateTable
CREATE TABLE "news" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "excerpt" JSONB,
    "body" JSONB,
    "cover_image_id" UUID,
    "seo" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB,
    "issuer" TEXT,
    "certificate_number" TEXT,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "document_id" UUID,
    "image_id" UUID,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_items" (
    "id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "title" JSONB,
    "caption" JSONB,
    "category" "gallery_category" NOT NULL DEFAULT 'OTHER',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB,
    "kind" "public_document_kind" NOT NULL DEFAULT 'OTHER',
    "media_asset_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_sections" (
    "id" UUID NOT NULL,
    "page" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "page_section_type" NOT NULL DEFAULT 'RICH_TEXT',
    "heading" JSONB,
    "subheading" JSONB,
    "body" JSONB,
    "media_asset_id" UUID,
    "cta_label" JSONB,
    "cta_href" TEXT,
    "data" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_steps" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "media_asset_id" UUID,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_metadata" (
    "id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "title" JSONB,
    "description" JSONB,
    "og_image_id" UUID,
    "canonical_url" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_slug_key" ON "news"("slug");

-- CreateIndex
CREATE INDEX "news_is_active_published_at_idx" ON "news"("is_active", "published_at");

-- CreateIndex
CREATE INDEX "certificates_is_active_display_order_idx" ON "certificates"("is_active", "display_order");

-- CreateIndex
CREATE INDEX "gallery_items_is_active_category_display_order_idx" ON "gallery_items"("is_active", "category", "display_order");

-- CreateIndex
CREATE INDEX "documents_is_active_display_order_idx" ON "documents"("is_active", "display_order");

-- CreateIndex
CREATE INDEX "page_sections_page_is_active_display_order_idx" ON "page_sections"("page", "is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "page_sections_page_key_key" ON "page_sections"("page", "key");

-- CreateIndex
CREATE UNIQUE INDEX "production_steps_key_key" ON "production_steps"("key");

-- CreateIndex
CREATE INDEX "production_steps_is_active_display_order_idx" ON "production_steps"("is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "seo_metadata_path_key" ON "seo_metadata"("path");

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_cover_image_id_fkey" FOREIGN KEY ("cover_image_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_steps" ADD CONSTRAINT "production_steps_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_metadata" ADD CONSTRAINT "seo_metadata_og_image_id_fkey" FOREIGN KEY ("og_image_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
