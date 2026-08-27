import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // The image pipeline lands in S08; AVIF/WebP are declared now so §26's image
  // budget is the default rather than something to remember later.
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Workspace packages ship TypeScript source, so Next must compile them.
  transpilePackages: ['@barff/types', '@barff/utils', '@barff/validation', '@barff/config'],

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
