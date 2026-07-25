/**
 * TanStack Query Client Configuration
 *
 * This module configures the QueryClient for server state management
 * with sensible defaults for the ProfitTerminal application.
 *
 * Requirements: 13.6
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Creates and configures a new QueryClient instance
 *
 * Default options:
 * - Queries are cached for 5 minutes (staleTime)
 * - Cache is kept for 10 minutes (gcTime)
 * - Failed queries retry up to 3 times
 * - Retry delay uses exponential backoff
 * - Window focus refetching is enabled for fresh data
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Consider data stale after 5 minutes (market data context)
        staleTime: 5 * 60 * 1000,

        // Keep unused data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,

        // Retry failed requests up to 3 times
        retry: 3,

        // Exponential backoff for retries
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,

        // Don't refetch on mount if data is still fresh
        refetchOnMount: false,

        // Refetch on network reconnect
        refetchOnReconnect: true,
      },
      mutations: {
        // Retry mutations once
        retry: 1,

        // Shorter retry delay for mutations
        retryDelay: 1000,
      },
    },
  });
}

/**
 * Singleton QueryClient instance for use across the application
 *
 * Note: In Next.js App Router, this should be instantiated per request
 * to avoid shared state between users. Use in a provider component.
 */
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create a new query client
    return createQueryClient();
  } else {
    // Browser: create a new query client if we don't already have one
    if (!browserQueryClient) {
      browserQueryClient = createQueryClient();
    }
    return browserQueryClient;
  }
}
