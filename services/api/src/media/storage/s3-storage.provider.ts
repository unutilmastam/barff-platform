import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'node:crypto';
import { AppConfigService } from '../../common/config/app-config.service.js';
import {
  type PutObjectInput,
  type SignedUrlOptions,
  type StorageProvider,
  type StoredObject,
} from './storage-provider.interface.js';

/**
 * S3-backed storage. Also serves MinIO in local development, which speaks the
 * same API — `S3_FORCE_PATH_STYLE` switches addressing between them.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private client: S3Client | undefined;

  constructor(private readonly config: AppConfigService) {}

  private getClient(): S3Client {
    const storage = this.config.storage;
    this.client ??= new S3Client({
      region: storage.region,
      ...(storage.endpoint === undefined ? {} : { endpoint: storage.endpoint }),
      // MinIO and most S3-compatible servers need path-style addressing;
      // virtual-host style would require wildcard DNS they do not have.
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
    });
    return this.client;
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const storage = this.config.storage;
    const checksum = createHash('sha256').update(input.body).digest('hex');

    await this.getClient().send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ...(input.cacheControl === undefined ? {} : { CacheControl: input.cacheControl }),
        ...(input.downloadFilename === undefined
          ? {}
          : { ContentDisposition: `attachment; filename="${input.downloadFilename}"` }),
        // No ACL is sent, deliberately. The bucket blocks public access and
        // objects inherit that; passing `public-read` here is exactly how a
        // "private" bucket ends up serving everything (§12).
        Metadata: { checksum },
      }),
    );

    return { key: input.key, bucket: storage.bucket, sizeBytes: input.body.length, checksum };
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.getClient().send(
      new GetObjectCommand({ Bucket: this.config.storage.bucket, Key: key }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (bytes === undefined) throw new Error(`Object ${key} has no body`);
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    // S3 delete is already idempotent: a missing key returns 204.
    await this.getClient().send(
      new DeleteObjectCommand({ Bucket: this.config.storage.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.getClient().send(
        new HeadObjectCommand({ Bucket: this.config.storage.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.storage.bucket,
      Key: key,
      ...(options.downloadFilename === undefined
        ? {}
        : { ResponseContentDisposition: `attachment; filename="${options.downloadFilename}"` }),
    });

    return getSignedUrl(this.getClient(), command, { expiresIn: options.expiresInSeconds });
  }

  getPublicUrl(key: string): string {
    const storage = this.config.storage;
    // Prefer the CDN: serving straight from the bucket bypasses Cloudflare's
    // cache and WAF, and puts the bucket name in every page's HTML.
    if (storage.cdnUrl !== undefined) return `${storage.cdnUrl.replace(/\/$/, '')}/${key}`;
    if (storage.endpoint !== undefined) {
      return `${storage.endpoint.replace(/\/$/, '')}/${storage.bucket}/${key}`;
    }
    return `https://${storage.bucket}.s3.${storage.region}.amazonaws.com/${key}`;
  }
}
