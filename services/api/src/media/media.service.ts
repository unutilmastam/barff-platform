import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { type Prisma } from '../../generated/prisma/index.js';
import { AppConfigService } from '../common/config/app-config.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta, type PaginatedResult } from '@barff/types';
import { STORAGE_PROVIDER, type StorageProvider } from './storage/storage-provider.interface.js';
import { ImageProcessorService } from './processing/image-processor.service.js';
import {
  DetectedKind,
  detectFileType,
  isTypeMismatch,
  sanitizeFilename,
} from './processing/file-signature.js';
import { type ListMediaDto, type MediaAssetDto, type UploadMediaDto } from './dto/media.dto.js';

export const MediaAuditAction = {
  UPLOADED: 'media.uploaded',
  REPLACED: 'media.replaced',
  DELETED: 'media.deleted',
  REJECTED: 'media.rejected',
} as const;

interface StoredVariant {
  label: string;
  key: string;
  format: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ActorContext {
  userId?: string | undefined;
  email?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly images: ImageProcessorService,
    private readonly audit: AuditService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * `Upload → validate → process → store → record` (§20), in that order.
   *
   * Validation happens on the bytes before anything is written, and the
   * database row is written last. An object with no row is a stray file a
   * sweep can find; a row with no object is a broken page.
   */
  async upload(
    file: UploadedFile,
    dto: UploadMediaDto,
    actor: ActorContext,
  ): Promise<MediaAssetDto> {
    const detected = await this.validate(file, actor);

    const assetId = randomUUID();
    // The key is built here and never from the uploaded filename. A
    // client-supplied name is a path-traversal vector, and two people
    // uploading "photo.jpg" must not collide.
    const prefix = `${detected.kind.toLowerCase()}/${assetId}`;
    const safeFilename = sanitizeFilename(file.originalname, detected.extension);

    const variants: StoredVariant[] = [];
    let width: number | null = null;
    let height: number | null = null;
    let blurDataUrl: string | null = null;
    let storedMimeType = detected.mimeType;
    let body = file.buffer;

    if (detected.kind === DetectedKind.IMAGE) {
      const processed = await this.images.process(file.buffer);
      // The re-encoded image replaces the upload: that is what strips EXIF and
      // neutralises a file crafted to be both an image and a script.
      body = processed.normalized;
      storedMimeType = processed.normalizedMimeType;
      width = processed.width;
      height = processed.height;
      blurDataUrl = processed.blurDataUrl;

      for (const variant of processed.variants) {
        const key = `${prefix}/${variant.label}`;
        await this.storage.put({
          key,
          body: variant.body,
          contentType: `image/${variant.format}`,
          // A variant key never changes content, so it can be cached forever.
          cacheControl: 'public, max-age=31536000, immutable',
        });
        variants.push({
          label: variant.label,
          key,
          format: variant.format,
          width: variant.width,
          height: variant.height,
          sizeBytes: variant.sizeBytes,
        });
      }
    }

    const originalKey = `${prefix}/original`;
    const stored = await this.storage.put({
      key: originalKey,
      body,
      contentType: storedMimeType,
      ...(detected.kind === DetectedKind.DOCUMENT ? { downloadFilename: safeFilename } : {}),
    });

    const asset = await this.prisma.mediaAsset.create({
      data: {
        id: assetId,
        storageKey: originalKey,
        bucket: stored.bucket,
        originalFilename: safeFilename,
        mimeType: storedMimeType,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        kind: detected.kind,
        visibility: dto.visibility ?? 'PRIVATE',
        width,
        height,
        blurDataUrl,
        variants: variants as unknown as Prisma.InputJsonValue,
        ...(dto.altText === undefined ? {} : { altText: this.parseJson(dto.altText, 'altText') }),
        ...(dto.title === undefined ? {} : { title: this.parseJson(dto.title, 'title') }),
        uploadedById: actor.userId ?? null,
      },
    });

    await this.audit.record({
      action: MediaAuditAction.UPLOADED,
      entity: 'MediaAsset',
      entityId: asset.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: {
        filename: safeFilename,
        mimeType: storedMimeType,
        sizeBytes: stored.sizeBytes,
        kind: detected.kind,
        visibility: asset.visibility,
        variants: variants.length,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.toDto(asset);
  }

  /**
   * Replaces the bytes of an existing asset, keeping its id.
   *
   * The id is what products and news articles reference, so replacing rather
   * than re-uploading is what lets the client swap a photo without every page
   * that points at it needing an edit.
   */
  async replace(id: string, file: UploadedFile, actor: ActorContext): Promise<MediaAssetDto> {
    const existing = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (existing === null) throw new NotFoundException(this.notFound());

    const detected = await this.validate(file, actor);
    if (detected.kind !== existing.kind) {
      // Swapping a PDF for a video would leave every consumer rendering the
      // wrong element for the same id.
      throw new BadRequestException({
        message: 'Replacement must be the same kind of media',
        code: 'MEDIA_KIND_MISMATCH',
      });
    }

    // The old objects are removed only after the new ones are written, so a
    // failure part-way leaves the asset serving its previous content rather
    // than nothing.
    const oldKeys = [existing.storageKey, ...this.variantKeys(existing.variants)];

    const prefix = `${detected.kind.toLowerCase()}/${existing.id}/${Date.now()}`;
    const safeFilename = sanitizeFilename(file.originalname, detected.extension);

    const variants: StoredVariant[] = [];
    let width: number | null = null;
    let height: number | null = null;
    let blurDataUrl: string | null = null;
    let storedMimeType = detected.mimeType;
    let body = file.buffer;

    if (detected.kind === DetectedKind.IMAGE) {
      const processed = await this.images.process(file.buffer);
      body = processed.normalized;
      storedMimeType = processed.normalizedMimeType;
      width = processed.width;
      height = processed.height;
      blurDataUrl = processed.blurDataUrl;

      for (const variant of processed.variants) {
        const key = `${prefix}/${variant.label}`;
        await this.storage.put({
          key,
          body: variant.body,
          contentType: `image/${variant.format}`,
          cacheControl: 'public, max-age=31536000, immutable',
        });
        variants.push({
          label: variant.label,
          key,
          format: variant.format,
          width: variant.width,
          height: variant.height,
          sizeBytes: variant.sizeBytes,
        });
      }
    }

    const newKey = `${prefix}/original`;
    const stored = await this.storage.put({
      key: newKey,
      body,
      contentType: storedMimeType,
      ...(detected.kind === DetectedKind.DOCUMENT ? { downloadFilename: safeFilename } : {}),
    });

    const updated = await this.prisma.mediaAsset.update({
      where: { id: existing.id },
      data: {
        storageKey: newKey,
        originalFilename: safeFilename,
        mimeType: storedMimeType,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        width,
        height,
        blurDataUrl,
        variants: variants as unknown as Prisma.InputJsonValue,
      },
    });

    for (const key of oldKeys) {
      // Best-effort: a failed cleanup leaves a stray object, which costs
      // storage. Failing the request would leave the client thinking the
      // replacement did not happen, which costs them a re-upload.
      await this.storage.delete(key).catch((error: unknown) => {
        this.logger.warn(
          `Could not remove superseded object ${key}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }

    await this.audit.record({
      action: MediaAuditAction.REPLACED,
      entity: 'MediaAsset',
      entityId: updated.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { filename: existing.originalFilename, checksum: existing.checksum },
      after: { filename: safeFilename, checksum: stored.checksum },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.toDto(updated);
  }

  async findOne(id: string): Promise<MediaAssetDto> {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, deletedAt: null } });
    if (asset === null) throw new NotFoundException(this.notFound());
    return this.toDto(asset);
  }

  async list(query: ListMediaDto): Promise<PaginatedResult<MediaAssetDto>> {
    const where: Prisma.MediaAssetWhereInput = {
      deletedAt: null,
      ...(query.kind === undefined ? {} : { kind: query.kind }),
      ...(query.visibility === undefined ? {} : { visibility: query.visibility }),
      ...(query.q === undefined
        ? {}
        : { originalFilename: { contains: query.q, mode: 'insensitive' } }),
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: query.orderBy ?? { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    return {
      items: await Promise.all(items.map((asset) => this.toDto(asset))),
      meta: buildPaginationMeta(query.page, query.pageSize, totalItems),
    };
  }

  /**
   * Soft-deletes the row and removes the objects.
   *
   * The row is kept so a product still referencing this id resolves to
   * something explanatory rather than to nothing, and so the audit trail has an
   * entity to point at. The bytes go, because storage costs money and a deleted
   * certificate should stop being retrievable.
   */
  async remove(id: string, actor: ActorContext): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, deletedAt: null } });
    if (asset === null) throw new NotFoundException(this.notFound());

    for (const key of [asset.storageKey, ...this.variantKeys(asset.variants)]) {
      await this.storage.delete(key).catch((error: unknown) => {
        this.logger.warn(
          `Could not remove object ${key}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }

    await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      action: MediaAuditAction.DELETED,
      entity: 'MediaAsset',
      entityId: asset.id,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      before: { filename: asset.originalFilename, storageKey: asset.storageKey },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }

  /**
   * Size and type checks, on the bytes.
   *
   * Order matters: size first, because refusing a huge file is cheaper than
   * sniffing it, and type second on content rather than on anything the client
   * asserted.
   */
  private async validate(file: UploadedFile, actor: ActorContext) {
    const maxBytes = this.config.storage.maxUploadBytes;

    if (file.size > maxBytes || file.buffer.length > maxBytes) {
      await this.recordRejection(actor, file, 'too_large');
      throw new PayloadTooLargeException({
        message: `File exceeds the ${Math.floor(maxBytes / 1024 / 1024)}MB limit`,
        code: 'MEDIA_TOO_LARGE',
      });
    }

    if (file.buffer.length === 0) {
      await this.recordRejection(actor, file, 'empty');
      throw new BadRequestException({ message: 'File is empty', code: 'MEDIA_EMPTY' });
    }

    const detected = detectFileType(file.buffer);
    if (detected === null) {
      await this.recordRejection(actor, file, 'unsupported_type');
      throw new UnsupportedMediaTypeException({
        message: 'File type is not supported',
        code: 'MEDIA_UNSUPPORTED_TYPE',
      });
    }

    if (isTypeMismatch(file.mimetype, detected)) {
      // Not a rejection on its own — the bytes decide — but worth recording.
      // A `.png` that is really a PDF is usually a mistake; a `.png` that is
      // really something executable is not.
      this.logger.warn(
        `Upload content type mismatch: client claimed ${file.mimetype}, bytes are ${detected.mimeType}`,
      );
      await this.recordRejection(actor, file, `type_mismatch:${detected.mimeType}`);
    }

    return detected;
  }

  private async recordRejection(
    actor: ActorContext,
    file: UploadedFile,
    reason: string,
  ): Promise<void> {
    await this.audit.record({
      action: MediaAuditAction.REJECTED,
      entity: 'MediaAsset',
      actorUserId: actor.userId,
      actorEmail: actor.email,
      after: {
        reason,
        // The filename is attacker-controlled; it is sanitized before it is
        // written anywhere, including here.
        claimedFilename: sanitizeFilename(file.originalname, 'bin'),
        claimedMimeType: file.mimetype,
        sizeBytes: file.size,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }

  private variantKeys(variants: Prisma.JsonValue): string[] {
    if (!Array.isArray(variants)) return [];
    return variants
      .map((variant) =>
        typeof variant === 'object' && variant !== null && 'key' in variant
          ? String((variant as { key: unknown }).key)
          : null,
      )
      .filter((key): key is string => key !== null);
  }

  private parseJson(value: string, field: string): Prisma.InputJsonValue {
    try {
      return JSON.parse(value) as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException({
        message: `${field} must be valid JSON`,
        code: 'MEDIA_INVALID_JSON',
      });
    }
  }

  /**
   * Builds the response, resolving URLs according to visibility.
   *
   * A private asset never gets a stable URL — only a signed one that expires.
   * That is the whole reason the bucket stays private (§12).
   */
  private async toDto(asset: {
    id: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    kind: string;
    visibility: string;
    width: number | null;
    height: number | null;
    blurDataUrl: string | null;
    variants: Prisma.JsonValue;
    storageKey: string;
    createdAt: Date;
  }): Promise<MediaAssetDto> {
    const ttl = this.config.storage.signedUrlTtlSeconds;
    const isPublic = asset.visibility === 'PUBLIC';

    const urlFor = async (key: string): Promise<string> =>
      isPublic
        ? this.storage.getPublicUrl(key)
        : this.storage.getSignedUrl(key, { expiresInSeconds: ttl });

    // Prisma types this column as JsonValue, which cannot be narrowed
    // structurally. The shape is ours — written by `upload` and `replace` in
    // this same file — so the cast is safe, and it goes through `unknown` to
    // say that explicitly rather than pretending the types overlap.
    const rawVariants = Array.isArray(asset.variants)
      ? (asset.variants as unknown as StoredVariant[])
      : [];

    return {
      id: asset.id,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      kind: asset.kind,
      visibility: asset.visibility,
      width: asset.width,
      height: asset.height,
      blurDataUrl: asset.blurDataUrl,
      variants: await Promise.all(
        rawVariants.map(async (variant) => ({
          label: variant.label,
          format: variant.format,
          width: variant.width,
          height: variant.height,
          sizeBytes: variant.sizeBytes,
          url: await urlFor(variant.key),
        })),
      ),
      url: await urlFor(asset.storageKey),
      createdAt: asset.createdAt.toISOString(),
    };
  }

  private notFound(): { message: string; code: string } {
    return { message: 'Media asset not found', code: 'MEDIA_NOT_FOUND' };
  }
}
