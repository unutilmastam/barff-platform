-- CreateEnum
CREATE TYPE "media_kind" AS ENUM ('IMAGE', 'DOCUMENT', 'VIDEO');

-- CreateEnum
CREATE TYPE "media_visibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "kind" "media_kind" NOT NULL,
    "visibility" "media_visibility" NOT NULL DEFAULT 'PRIVATE',
    "width" INTEGER,
    "height" INTEGER,
    "blur_data_url" TEXT,
    "variants" JSONB,
    "alt_text" JSONB,
    "title" JSONB,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_kind_deleted_at_idx" ON "media_assets"("kind", "deleted_at");

-- CreateIndex
CREATE INDEX "media_assets_created_at_idx" ON "media_assets"("created_at");

-- CreateIndex
CREATE INDEX "media_assets_checksum_idx" ON "media_assets"("checksum");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
