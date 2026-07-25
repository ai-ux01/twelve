/**
 * Example: Portfolio Query Hook
 *
 * This is an example of how to use TanStack Query with the query keys
 * to fetch portfolio data from the backend API.
 *
 * This example demonstrates:
 * - Using useQuery with typed query keys
 * - Handling loading and error states
 * - Automatic refetching and caching
 *
 * Requirements: 13.6
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { portfolioKeys } from '../query-keys';

// Type definitions (these would normally come from a shared types file)
interface Portfolio {
  totalValue: number;
  cashBalance: number;
  positions: Position[];
  totalPnL: number;
  dailyPnL: number;
  metrics: {
    totalExposure: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
  };
}

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  stopLoss?: number;
  target?: number;
  isPaper: boolean;
}

/**
 * Custom hook to fetch portfolio data
 *
 * This hook uses TanStack Query to fetch and cache portfolio data
 * from the backend API.
 */
export function usePortfolio() {
  return useQuery({
    queryKey: portfolioKeys.overview(),
    queryFn: async (): Promise<Portfolio> => {
      const response = await fetch('http://localhost:4000/api/portfolio');

      if (!response.ok) {
        throw new Error(`Failed to fetch portfolio: ${response.statusText}`);
      }

      return response.json();
    },
    // Optional: configure per-query options
    staleTime: 10 * 1000, // Consider data stale after 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for real-time updates
  });
}

/**
 * Example component using the portfolio hook
 */
export function PortfolioOverviewExample() {
  const { data: portfolio, isLoading, error, isError } = usePortfolio();

  if (isLoading) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Loading portfolio...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4">
        <p className="text-destructive">Error: {error.message}</p>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">No portfolio data available</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold">₹{portfolio.totalValue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Cash Balance</p>
          <p className="text-2xl font-bold">₹{portfolio.cashBalance.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Total PnL</p>
          <p
            className={`text-xl font-semibold ${
              portfolio.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            ₹{portfolio.totalPnL.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Daily PnL</p>
          <p
            className={`text-xl font-semibold ${
              portfolio.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            ₹{portfolio.dailyPnL.toLocaleString()}
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-2">Metrics</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Exposure:</span>{' '}
            <span className="font-medium">
              {(portfolio.metrics.totalExposure * 100).toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Win Rate:</span>{' '}
            <span className="font-medium">{(portfolio.metrics.winRate * 100).toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Avg Win:</span>{' '}
            <span className="font-medium">₹{portfolio.metrics.avgWin.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-2">
          Positions ({portfolio.positions.length})
        </p>
        <div className="space-y-2">
          {portfolio.positions.slice(0, 3).map((position) => (
            <div
              key={position.id}
              className="flex items-center justify-between p-2 bg-muted rounded"
            >
              <div>
                <p className="font-medium">{position.symbol}</p>
                <p className="text-sm text-muted-foreground">
                  {position.quantity} @ ₹{position.entryPrice}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">₹{position.currentPrice}</p>
                <p
                  className={`text-sm ${
                    position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {position.unrealizedPnL >= 0 ? '+' : ''}
                  {position.unrealizedPnLPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
