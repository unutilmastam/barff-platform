import { Injectable } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { AppConfigService } from '../../common/config/app-config.service.js';
import {
  type PutObjectInput,
  type SignedUrlOptions,
  type StorageProvider,
  type StoredObject,
} from './storage-provider.interface.js';

/**
 * Filesystem-backed storage for local development and tests.
 *
 * Exists so the media pipeline can be worked on and tested without running
 * MinIO or reaching AWS — the S3 provider is the production path and is tested
 * against a real S3-compatible server. This one is never selected in
 * production: the config refuses that combination at boot.
 *
 * "Signed" URLs here carry a real HMAC so expiry and tampering behave the same
 * way as S3's, and code written against them cannot accidentally depend on a
 * URL being permanent.
 */
@Injectable()
export class FilesystemStorageProvider implements StorageProvider {
  readonly name = 'filesystem';

  constructor(private readonly config: AppConfigService) {}

  private get root(): string {
    return resolve(this.config.storage.filesystemRoot);
  }

  /**
   * Resolves a key to a path inside the root, and refuses anything that escapes.
   *
   * Keys are generated server-side, so this should be unreachable — which is
   * exactly why it is here. A traversal check that only exists where traversal
   * is expected is a check that was never needed.
   */
  private pathFor(key: string): string {
    const target = resolve(join(this.root, normalize(key)));
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new Error(`Storage key escapes the storage root: ${key}`);
    }
    return target;
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const path = this.pathFor(input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body);

    return {
      key: input.key,
      bucket: this.config.storage.bucket,
      sizeBytes: input.body.length,
      checksum: createHash('sha256').update(input.body).digest('hex'),
    };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    // `force` makes this idempotent, matching S3.
    await rm(this.pathFor(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + options.expiresInSeconds;
    // Signed with the access secret so a developer cannot hand-craft a URL and
    // then be surprised when the same trick fails against S3.
    const signature = createHmac('sha256', this.config.storage.secretAccessKey)
      .update(`${key}:${expiresAt}`)
      .digest('hex');

    const url = new URL(`${this.config.storage.publicBaseUrl}/${key}`);
    url.searchParams.set('expires', String(expiresAt));
    url.searchParams.set('signature', signature);
    if (options.downloadFilename !== undefined) {
      url.searchParams.set('filename', options.downloadFilename);
    }
    return Promise.resolve(url.toString());
  }

  getPublicUrl(key: string): string {
    return `${this.config.storage.publicBaseUrl}/${key}`;
  }

  /** Verifies a URL produced by `getSignedUrl`. Used by the local dev handler. */
  verifySignature(key: string, expiresAt: number, signature: string): boolean {
    if (expiresAt * 1000 < Date.now()) return false;
    const expected = createHmac('sha256', this.config.storage.secretAccessKey)
      .update(`${key}:${expiresAt}`)
      .digest('hex');
    return expected === signature;
  }
}
