/**
 * Object storage behind one interface.
 *
 * Two implementations ship: S3 (which also covers MinIO, since MinIO speaks the
 * S3 API) and a filesystem provider for local work without any object store.
 * Nothing above this line knows which is in use — `MediaService` never imports
 * an SDK type, so swapping provider is a module wiring change, not a rewrite
 * (`ROADMAP.md` S08: "provider behind an adapter interface").
 */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface StoredObject {
  key: string;
  bucket: string;
  sizeBytes: number;
  checksum: string;
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  /**
   * `Cache-Control` for the stored object. Derived variants are addressed by a
   * content-derived key, so they can be immutable; originals cannot.
   */
  cacheControl?: string | undefined;
  /** Filename offered on download. Already sanitized by the caller. */
  downloadFilename?: string | undefined;
}

export interface SignedUrlOptions {
  expiresInSeconds: number;
  /** Forces a download instead of inline rendering. */
  downloadFilename?: string | undefined;
}

export interface StorageProvider {
  /** Human-readable name, for logs and the health payload. */
  readonly name: string;

  put(input: PutObjectInput): Promise<StoredObject>;

  get(key: string): Promise<Buffer>;

  /** Idempotent: deleting a key that is already gone is not an error. */
  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;

  /**
   * Time-limited URL for a private object.
   *
   * Private is the default and the bucket is never public (§12), so this is the
   * only way a private object reaches a browser. The TTL is deliberately short:
   * a signed URL is a bearer credential, and it will be pasted into chat
   * messages and forwarded in email.
   */
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;

  /**
   * Stable URL for an object deliberately marked public.
   *
   * Returns the CDN origin where one is configured, so published images are
   * served through Cloudflare rather than straight from the bucket (§13).
   */
  getPublicUrl(key: string): string;
}
