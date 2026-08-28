/**
 * Minimal type declaration for `s3rver`, which ships none.
 *
 * Test-only: `s3rver` is a development dependency used to exercise the S3
 * adapter against a real S3-compatible server. Only the surface actually used
 * is declared — a fuller stub would be guesswork about an API we do not call.
 */
declare module 's3rver' {
  interface S3rverOptions {
    port?: number;
    address?: string;
    silent?: boolean;
    directory?: string;
    configureBuckets?: { name: string; configs?: string[] }[];
  }

  class S3rver {
    constructor(options: S3rverOptions);
    run(): Promise<unknown>;
    close(): Promise<void>;
  }

  export = S3rver;
}
