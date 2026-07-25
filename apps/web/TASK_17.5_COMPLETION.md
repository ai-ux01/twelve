# Task 17.5: Set up TanStack Query for server state management

## Completion Summary

Successfully configured TanStack Query (React Query) v5 for server state management in the Next.js frontend application.

## Implementation Details

### 1. Query Client Configuration (`lib/query-client.ts`)

Created a centralized QueryClient configuration with:

- **Stale Time**: 5 minutes (optimized for market data that updates frequently)
- **Cache Time (gcTime)**: 10 minutes (keeps unused data available)
- **Retry Logic**: 3 retries with exponential backoff (1s, 2s, 4s up to 30s max)
- **Refetch Behavior**:
  - On window focus (for fresh data when user returns)
  - On network reconnect (to recover from connection issues)
  - Not on mount if data is still fresh

The file exports:

- `createQueryClient()`: Factory function for creating new QueryClient instances
- `getQueryClient()`: Singleton pattern for browser, new instance per request for server (Next.js App Router compatible)

### 2. Query Keys Organization (`lib/query-keys.ts`)

Defined type-safe query key factories organized by domain:

#### Market Domain (`marketKeys`)

- All market data: `['market']`
- Symbol-specific: `['market', 'RELIANCE']`
- Price quotes: `['market', 'RELIANCE', 'quote']`
- OHLCV data: `['market', 'RELIANCE', 'ohlcv', '1d', { from, to }]`
- Options chains: `['market', 'options', 'NIFTY', 'chain', { expiry }]`
- Options Greeks: `['market', 'options', 'NIFTY', 'greeks', strike, type, expiry]`

#### Portfolio Domain (`portfolioKeys`)

- All portfolio data: `['portfolio']`
- Overview: `['portfolio', 'overview']`
- Positions list: `['portfolio', 'positions', 'list', filters]`
- Position detail: `['portfolio', 'positions', 'detail', positionId]`
- Metrics: `['portfolio', 'metrics']`
- Trades: `['portfolio', 'trades', 'list', filters]`

#### Recommendations Domain (`recommendationKeys`)

- All recommendations: `['recommendations']`
- Filtered list: `['recommendations', 'list', filters]`
- Detail: `['recommendations', 'detail', recommendationId]`
- Performance metrics: `['recommendations', 'performance']`
- Recent: `['recommendations', 'recent', limit]`

#### Additional Domains

- **Prompt Keys**: For caching user prompt analysis
- **Risk Keys**: For caching risk validation results
- **Strategy Keys**: For AI-generated trading strategies

**Benefits of this structure:**

- Type-safe query keys with TypeScript
- Hierarchical organization enables efficient cache invalidation
- Consistent naming convention across the application
- Easy to invalidate entire domains or specific resources

### 3. Query Provider Component (`components/providers/query-provider.tsx`)

Created a client component that wraps the application with:

- `QueryClientProvider` to provide query client context
- `ReactQueryDevtools` integration (development only)
- Singleton client pattern for browser
- Per-request client for server rendering

### 4. Root Layout Integration (`app/layout.tsx`)

Updated the root layout to wrap the entire application with `QueryProvider`, enabling TanStack Query throughout the component tree.

### 5. Documentation

Created comprehensive documentation in `lib/README.md` covering:

- Setup overview
- Query keys structure and usage
- Usage examples for common patterns:
  - Basic queries
  - Mutations with cache invalidation
  - Real-time data with refetch intervals
  - Dependent queries
  - Prefetching
  - Optimistic updates
- Cache invalidation patterns
- Best practices

### 6. Example Implementation (`lib/hooks/use-portfolio.example.tsx`)

Created a complete example demonstrating:

- Custom query hook (`usePortfolio`)
- Type-safe query key usage
- Loading and error state handling
- Component integration
- Real-time data with automatic refetching

## Files Created

1. `/apps/web/lib/query-client.ts` - QueryClient configuration
2. `/apps/web/lib/query-keys.ts` - Organized query key factories
3. `/apps/web/components/providers/query-provider.tsx` - QueryProvider wrapper component
4. `/apps/web/lib/README.md` - Comprehensive documentation
5. `/apps/web/lib/hooks/use-portfolio.example.tsx` - Usage example
6. `/apps/web/TASK_17.5_COMPLETION.md` - This completion document

## Files Modified

1. `/apps/web/app/layout.tsx` - Added QueryProvider wrapper
2. `/apps/web/package.json` - Added `@tanstack/react-query-devtools` (dev dependency)

## Verification

### Type Checking

```bash
pnpm tsc --noEmit --skipLibCheck
```

✅ **PASSED** - No type errors in the TanStack Query setup

### Development Server

```bash
pnpm dev
```

✅ **PASSED** - Server started successfully on http://localhost:3000

- Next.js compiled successfully with QueryProvider integrated
- React Query Devtools available in development mode

## Dependencies

- `@tanstack/react-query`: ^5.32.0 (already installed)
- `@tanstack/react-query-devtools`: ^5.101.4 (newly installed as dev dependency)

## Requirements Validation

**Validates: Requirements 13.6**

> "THE Frontend_App SHALL update data reactively using TanStack Query"

This implementation provides:
✅ TanStack Query configured with sensible defaults for the trading application
✅ Query keys organized by domain (market, portfolio, recommendations)
✅ Type-safe query key factories for consistency
✅ QueryProvider integrated at the root level
✅ Development tools for debugging and monitoring
✅ Comprehensive documentation and examples
✅ Ready for implementing reactive data fetching in components

## Next Steps

The TanStack Query infrastructure is now ready. Components can use the query keys and hooks to:

1. Fetch market data with automatic caching and refetching
2. Display portfolio information with real-time updates
3. Load AI recommendations with proper state management
4. Implement mutations for trade execution with cache invalidation
5. Build reactive UIs that automatically update when data changes

Example usage in any component:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { marketKeys } from '@/lib/query-keys';

export function PriceDisplay({ symbol }) {
  const { data } = useQuery({
    queryKey: marketKeys.quote(symbol),
    queryFn: async () => {
      const res = await fetch(`http://localhost:4000/api/market/${symbol}/quote`);
      return res.json();
    },
    refetchInterval: 5000, // Update every 5 seconds
  });

  return <div>Current Price: ₹{data?.price}</div>;
}
```

## Notes

- Query keys follow a hierarchical structure for efficient invalidation
- Default stale time of 5 minutes is appropriate for market data
- Real-time data should use `refetchInterval` option
- React Query Devtools are available in development mode only
- The setup is fully compatible with Next.js 14 App Router (server/client components)
