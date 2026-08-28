import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import S3rver from 's3rver';
import { S3Client } from '@aws-sdk/client-s3';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { S3StorageProvider } from '../src/media/storage/s3-storage.provider.js';
import { type AppConfigService } from '../src/common/config/app-config.service.js';

/**
 * The S3 adapter against a real S3-compatible server.
 *
 * s3rver rather than a mocked SDK: a mock proves the code calls the functions
 * it was written to call, which is exactly the thing that was never in doubt.
 * Signature construction, path-style addressing and presigned-URL generation
 * only fail against something that actually parses the request — and those are
 * the parts that differ between AWS and MinIO.
 */
const PORT = 4569;
const BUCKET = 'barff-media-test';

function configFor(endpoint: string): AppConfigService {
  return {
    storage: {
      provider: 's3',
      endpoint,
      region: 'us-east-1',
      bucket: BUCKET,
      accessKeyId: 'S3RVER',
      secretAccessKey: 'S3RVER',
      forcePathStyle: true,
      signedUrlTtlSeconds: 900,
      cdnUrl: undefined,
      filesystemRoot: '.media-storage',
      publicBaseUrl: `${endpoint}/${BUCKET}`,
      maxUploadBytes: 25 * 1024 * 1024,
    },
  } as unknown as AppConfigService;
}

describe('S3StorageProvider against a real S3 server', () => {
  let server: S3rver;
  let directory: string;
  let provider: S3StorageProvider;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 's3rver-'));
    server = new S3rver({
      port: PORT,
      address: '127.0.0.1',
      silent: true,
      directory,
      configureBuckets: [{ name: BUCKET, configs: [] }],
    });
    await server.run();
    provider = new S3StorageProvider(configFor(`http://127.0.0.1:${PORT}`));
  }, 30_000);

  afterAll(async () => {
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('round-trips an object', async () => {
    const body = Buffer.from('BARFF product render', 'utf8');
    const stored = await provider.put({
      key: 'image/test/original',
      body,
      contentType: 'image/webp',
    });

    expect(stored.bucket).toBe(BUCKET);
    expect(stored.sizeBytes).toBe(body.length);
    expect(stored.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(await provider.get('image/test/original')).toEqual(body);
  });

  it('reports existence correctly', async () => {
    await provider.put({
      key: 'image/exists/original',
      body: Buffer.from('x'),
      contentType: 'image/webp',
    });
    expect(await provider.exists('image/exists/original')).toBe(true);
    expect(await provider.exists('image/nothing/here')).toBe(false);
  });

  it('deletes, and deleting again is not an error', async () => {
    await provider.put({
      key: 'image/gone/original',
      body: Buffer.from('x'),
      contentType: 'image/webp',
    });
    await provider.delete('image/gone/original');
    expect(await provider.exists('image/gone/original')).toBe(false);
    // Idempotent, matching the interface contract.
    await expect(provider.delete('image/gone/original')).resolves.toBeUndefined();
  });

  it('signs a URL that actually fetches the object', async () => {
    const body = Buffer.from('signed content', 'utf8');
    await provider.put({ key: 'doc/signed/original', body, contentType: 'application/pdf' });

    const url = await provider.getSignedUrl('doc/signed/original', { expiresInSeconds: 300 });
    expect(url).toContain('X-Amz-Signature');
    expect(url).toContain('X-Amz-Expires');

    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(body);
  });

  it('never sends an ACL, so an object cannot be made public by accident', async () => {
    // The one half of "no public bucket" that lives in application code.
    // Bucket-level public-access blocking is infrastructure (S40) and is
    // verified there; what this code must never do is ask for `public-read`.
    //
    // Deliberately not asserted by fetching an object unsigned from s3rver:
    // s3rver does not enforce auth at all, so such a test would pass or fail
    // on the test double's behaviour rather than on ours.
    const commands: { input: Record<string, unknown> }[] = [];
    const spy = vi.spyOn(S3Client.prototype, 'send').mockImplementation(((command: {
      input: Record<string, unknown>;
    }) => {
      commands.push(command);
      return Promise.resolve({});
    }) as never);

    await provider.put({
      key: 'image/acl/original',
      body: Buffer.from('x'),
      contentType: 'image/webp',
    });
    spy.mockRestore();

    expect(commands).toHaveLength(1);
    expect(commands[0]!.input['ACL']).toBeUndefined();
    expect(JSON.stringify(commands[0]!.input)).not.toContain('public-read');
  });

  it('builds a public URL from the endpoint when no CDN is configured', () => {
    expect(provider.getPublicUrl('image/a/original')).toBe(
      `http://127.0.0.1:${PORT}/${BUCKET}/image/a/original`,
    );
  });

  it('prefers the CDN origin when one is set', () => {
    const cdnProvider = new S3StorageProvider({
      storage: {
        ...configFor('http://127.0.0.1:1').storage,
        cdnUrl: 'https://cdn.barff.uz/',
      },
    } as unknown as AppConfigService);

    // Serving from the bucket would bypass Cloudflare's cache and WAF.
    expect(cdnProvider.getPublicUrl('image/a/original')).toBe(
      'https://cdn.barff.uz/image/a/original',
    );
  });
});

describe('local MinIO is configured private-by-default', () => {
  // `import.meta` is unavailable in this CommonJS build; vitest runs with the
  // service directory as cwd.
  const compose = readFileSync(resolve(process.cwd(), '../../docker-compose.yml'), 'utf8');

  it('only grants anonymous download to the explicitly public bucket', () => {
    // The media bucket holds certificates and unpublished product photography.
    // If local development serves it anonymously, code gets written that
    // assumes a stable URL and then breaks — or worse, works — in production.
    const anonymousLines = compose.split('\n').filter((line) => line.includes('mc anonymous set'));

    expect(anonymousLines.length).toBeGreaterThan(0);
    for (const line of anonymousLines) {
      expect(line, line.trim()).toContain('S3_BUCKET_PUBLIC');
      expect(line, line.trim()).not.toMatch(/S3_BUCKET(?!_PUBLIC)/);
    }
  });
});
