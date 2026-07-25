/**
 * Query Client Provider Component
 *
 * Wraps the application with TanStack Query's QueryClientProvider
 * to enable server state management throughout the component tree.
 *
 * This component should be used in the root layout to provide
 * query client context to all components.
 *
 * Requirements: 13.6
 */

'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/query-client';
import { ReactNode } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * QueryProvider wraps the app with QueryClientProvider
 *
 * Features:
 * - Provides QueryClient to all child components
 * - Includes React Query Devtools in development
 * - Uses singleton client pattern for browser
 * - Creates new client per request on server
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Get or create the query client
  // In browser, this will reuse the same instance
  // On server, this creates a new instance per request
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* React Query Devtools - only in development */}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
