import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Origins `next/image` may load media from.
 *
 * `MEDIA_ALLOWED_ORIGINS` is a comma-separated list of absolute origins. The
 * default covers a local MinIO and the API's own filesystem provider, which is
 * what `docker-compose` brings up; nothing else is allowed unless it is named.
 */
type RemotePatterns = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>;

function mediaPatterns(): RemotePatterns {
  const configured = process.env['MEDIA_ALLOWED_ORIGINS'];
  const origins = (configured ?? 'http://localhost:9000,http://localhost:4000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.flatMap((origin) => {
    try {
      const url = new URL(origin);
      return [
        {
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
          hostname: url.hostname,
          ...(url.port === '' ? {} : { port: url.port }),
        },
      ];
    } catch {
      // A malformed entry is dropped rather than failing the build: the worst
      // case is an image that does not render, and the list is operator input.
      return [];
    }
  });
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    formats: ['image/avif', 'image/webp'],
    // Media arrives as short-lived signed URLs from S3/MinIO, so the optimizer
    // has to be told which origins it may fetch from. An allow-list, never a
    // wildcard: `next/image` fetches whatever URL it is handed, and a page that
    // can be made to render an arbitrary remote image turns the optimizer into
    // a request proxy.
    //
    // Configured rather than hard-coded because the host differs per
    // environment — MinIO locally, S3 or the CDN in staging and production.
    remotePatterns: mediaPatterns(),
  },

  // Workspace packages ship TypeScript source, so Next must compile them.
  // @barff/ui ships TypeScript source rather than a bundle, because
  // 'use client' directives do not survive bundling reliably.
  transpilePackages: [
    '@barff/types',
    '@barff/ui',
    '@barff/utils',
    '@barff/validation',
    '@barff/config',
  ],

  // Standalone output is what infrastructure/docker/nextjs.Dockerfile copies.
  output: 'standalone',
  // The app lives in apps/web but the monorepo root is three levels up; without
  // this Next traces the wrong file set into the standalone bundle.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,

  eslint: {
    // Linting is a separate, already-required CI gate. Running it again inside
    // `next build` doubles the work and can fail the build for a lint rule.
    ignoreDuringBuilds: true,
  },
};

export default withNextIntl(nextConfig);
