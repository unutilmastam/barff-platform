'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiRequestError } from './api-client';

/**
 * TanStack Query provider.
 *
 * The client is created inside `useState` rather than at module scope. A
 * module-level client is shared by every request the server handles, which
 * leaks one visitor's cached data into another's response.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Public content changes rarely and is cached at the edge anyway
            // (S11); refetching on every focus is wasted traffic on mobile.
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Retrying a 404 or a 403 just repeats a request the server
              // already refused, and delays showing the user the real answer.
              if (error instanceof ApiRequestError && !error.isRetryable) return false;
              return failureCount < 2;
            },
          },
          mutations: {
            // Never automatic: a retried POST can create a second order. S26
            // adds idempotency keys, and retries become safe then.
            retry: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
