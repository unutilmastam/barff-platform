'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Container } from '@/components/layout/container';

/**
 * Route-level error boundary.
 *
 * Shows a translated message and the digest, never the error itself: a stack
 * or a database message rendered to a visitor is an information leak, and Next
 * redacts server errors in production for the same reason. The digest is what
 * support quotes to find the real error in the logs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  useEffect(() => {
    // Sentry is wired up in S41; until then the browser console is the only
    // sink, and this is the one place a client error is worth logging.
    console.error(error);
  }, [error]);

  return (
    <Container as="section" className="py-sectionSm sm:py-section">
      <div role="alert">
        <h1 className="text-3xl font-bold text-content-primary sm:text-4xl">{t('title')}</h1>
        <p className="mt-4 max-w-xl text-content-secondary">{t('description')}</p>

        {error.digest !== undefined && (
          <p className="mt-2 text-sm text-content-muted">
            {t('reference')}: <code className="font-mono">{error.digest}</code>
          </p>
        )}

        <button
          type="button"
          onClick={reset}
          className="mt-8 rounded bg-brand-500 px-5 py-2.5 font-semibold text-content-inverse transition-colors hover:bg-brand-400"
        >
          {t('retry')}
        </button>
      </div>
    </Container>
  );
}
