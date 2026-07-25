# TanStack Query Setup

This directory contains the TanStack Query (React Query) configuration for server state management in ProfitTerminal.

## Overview

TanStack Query provides powerful data synchronization for fetching, caching, and updating server state. This setup follows best practices for organizing query keys by domain and configuring sensible defaults for a trading application.

## Files

### `query-client.ts`

Configures the QueryClient with application-specific defaults:

- **Stale Time**: 5 minutes (suitable for market data that refreshes frequently)
- **Cache Time (gcTime)**: 10 minutes (keeps unused data available)
- **Retry Logic**: 3 retries with exponential backoff
- **Refetch Behavior**: On window focus and network reconnect

The file exports two functions:

- `createQueryClient()`: Creates a new QueryClient instance
- `getQueryClient()`: Returns a singleton client for browser, new instance for server

### `query-keys.ts`

Defines organized query key factories grouped by domain:

#### Market Domain (`marketKeys`)

For market data, prices, and options chains:

```typescript
marketKeys.all; // ['market']
marketKeys.symbol('RELIANCE'); // ['market', 'RELIANCE']
marketKeys.quote('RELIANCE'); // ['market', 'RELIANCE', 'quote']
marketKeys.ohlcv('RELIANCE', '1d'); // ['market', 'RELIANCE', 'ohlcv', '1d', {...}]
marketKeys.options.chain('NIFTY', '2024-12-26'); // ['market', 'options', 'NIFTY', 'chain', {...}]
```

#### Portfolio Domain (`portfolioKeys`)

For positions, trades, and portfolio metrics:

```typescript
portfolioKeys.all; // ['portfolio']
portfolioKeys.overview(); // ['portfolio', 'overview']
portfolioKeys.positions.list(); // ['portfolio', 'positions', 'list', undefined]
portfolioKeys.positions.detail('uuid'); // ['portfolio', 'positions', 'detail', 'uuid']
portfolioKeys.metrics(); // ['portfolio', 'metrics']
```

#### Recommendations Domain (`recommendationKeys`)

For AI recommendations and performance tracking:

```typescript
recommendationKeys.all; // ['recommendations']
recommendationKeys.list({ symbol: 'RELIANCE' }); // ['recommendations', 'list', {...}]
recommendationKeys.detail('uuid'); // ['recommendations', 'detail', 'uuid']
recommendationKeys.performance(); // ['recommendations', 'performance']
```

#### Other Domains

- `promptKeys`: For caching user prompt analysis results
- `riskKeys`: For caching risk validation results
- `strategyKeys`: For AI-generated trading strategies

## Usage Examples

### Basic Query Hook

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { portfolioKeys } from '@/lib/query-keys';

export function PortfolioOverview() {
  const { data, isLoading, error } = useQuery({
    queryKey: portfolioKeys.overview(),
    queryFn: async () => {
      const res = await fetch('http://localhost:4000/api/portfolio');
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      return res.json();
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Portfolio Value: ${data.totalValue}</h2>
      <p>Total PnL: ${data.totalPnL}</p>
    </div>
  );
}
```

### Mutation with Invalidation

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { portfolioKeys } from '@/lib/query-keys';

export function ExecuteTradeButton({ trade }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (tradeRequest) => {
      const res = await fetch('http://localhost:4000/api/trade/paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeRequest),
      });
      if (!res.ok) throw new Error('Trade failed');
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch portfolio data
      queryClient.invalidateQueries({ queryKey: portfolioKeys.all });
    },
  });

  return (
    <button
      onClick={() => mutation.mutate(trade)}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? 'Executing...' : 'Execute Trade'}
    </button>
  );
}
```

### Real-time Data with Refetch Interval

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { marketKeys } from '@/lib/query-keys';

export function LivePrice({ symbol }) {
  const { data } = useQuery({
    queryKey: marketKeys.quote(symbol),
    queryFn: async () => {
      const res = await fetch(`http://localhost:4000/api/market/${symbol}/quote`);
      return res.json();
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  return <div>Current Price: ₹{data?.price}</div>;
}
```

### Dependent Queries

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { marketKeys, recommendationKeys } from '@/lib/query-keys';

export function RecommendationWithPrice({ recommendationId }) {
  // First query: get recommendation
  const { data: recommendation } = useQuery({
    queryKey: recommendationKeys.detail(recommendationId),
    queryFn: async () => {
      const res = await fetch(`http://localhost:4000/api/recommendations/${recommendationId}`);
      return res.json();
    },
  });

  // Second query: get current price (only runs when recommendation is loaded)
  const { data: quote } = useQuery({
    queryKey: marketKeys.quote(recommendation?.symbol),
    queryFn: async () => {
      const res = await fetch(`http://localhost:4000/api/market/${recommendation.symbol}/quote`);
      return res.json();
    },
    enabled: !!recommendation?.symbol, // Only run when we have a symbol
  });

  return (
    <div>
      <p>Recommended Entry: ₹{recommendation?.entryPrice}</p>
      <p>Current Price: ₹{quote?.price}</p>
    </div>
  );
}
```

### Prefetching Data

```typescript
'use client';

import { useQueryClient } from '@tanstack/react-query';
import { portfolioKeys } from '@/lib/query-keys';
import Link from 'next/link';

export function PortfolioLink() {
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    // Prefetch portfolio data on hover
    queryClient.prefetchQuery({
      queryKey: portfolioKeys.overview(),
      queryFn: async () => {
        const res = await fetch('http://localhost:4000/api/portfolio');
        return res.json();
      },
    });
  };

  return (
    <Link href="/portfolio" onMouseEnter={handleMouseEnter}>
      View Portfolio
    </Link>
  );
}
```

### Optimistic Updates

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { portfolioKeys } from '@/lib/query-keys';

export function ClosePositionButton({ positionId }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`http://localhost:4000/api/portfolio/positions/${id}/close`, {
        method: 'POST',
      });
      return res.json();
    },
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: portfolioKeys.positions.all });

      // Snapshot previous value
      const previous = queryClient.getQueryData(portfolioKeys.positions.list());

      // Optimistically update
      queryClient.setQueryData(portfolioKeys.positions.list(), (old: any) => ({
        ...old,
        positions: old.positions.filter((p: any) => p.id !== id),
      }));

      return { previous };
    },
    onError: (err, id, context) => {
      // Rollback on error
      queryClient.setQueryData(portfolioKeys.positions.list(), context?.previous);
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: portfolioKeys.positions.all });
    },
  });

  return (
    <button onClick={() => mutation.mutate(positionId)}>
      Close Position
    </button>
  );
}
```

## Cache Invalidation Patterns

### Invalidate Entire Domain

```typescript
// Invalidate all market data
queryClient.invalidateQueries({ queryKey: marketKeys.all });

// Invalidate all portfolio data
queryClient.invalidateQueries({ queryKey: portfolioKeys.all });

// Invalidate all recommendations
queryClient.invalidateQueries({ queryKey: recommendationKeys.all });
```

### Invalidate Specific Symbol

```typescript
// Invalidate all data for RELIANCE
queryClient.invalidateQueries({ queryKey: marketKeys.symbol('RELIANCE') });
```

### Invalidate Specific Resource

```typescript
// Invalidate a specific recommendation
queryClient.invalidateQueries({
  queryKey: recommendationKeys.detail(recommendationId),
});
```

## Best Practices

1. **Use Query Key Factories**: Always use the provided factory functions instead of hardcoding query keys
2. **Organize by Domain**: Keep related queries grouped under their domain namespace
3. **Leverage Hierarchy**: Query key hierarchies enable efficient invalidation (e.g., invalidating `marketKeys.all` invalidates all market queries)
4. **Handle Loading States**: Always handle `isLoading`, `error`, and `data` states
5. **Invalidate After Mutations**: Invalidate relevant queries after successful mutations
6. **Use Optimistic Updates**: For better UX, optimistically update the UI before server confirmation
7. **Enable/Disable Queries**: Use the `enabled` option to control when queries run
8. **Set Appropriate Intervals**: Use `refetchInterval` for real-time data like prices

## React Query Devtools

In development mode, React Query Devtools are available at the bottom-right of the screen. They provide:

- Query inspection and debugging
- Cache explorer
- Query invalidation tools
- Network request timeline
- Performance insights

Press the React Query icon to open the devtools panel.

## Requirements

**Validates: Requirements 13.6**

This setup enables reactive data updates using TanStack Query as specified in the design document.
