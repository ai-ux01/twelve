'use client';

import { useQuery } from '@tanstack/react-query';
import { portfolioKeys } from '@/lib/query-keys';
import { apiClient } from '@/lib/api-client';
import { PortfolioTable } from '@/components/portfolio-table';
import { Skeleton } from '@/components/ui/skeleton';

// For demo purposes, using a default user ID
// In production, this would come from authentication context
const DEFAULT_USER_ID = 'demo-user';

/**
 * Format currency value with rupee symbol
 */
function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Get color class based on value (green for profit, red for loss)
 */
function getPnLColorClass(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-500';
  if (value < 0) return 'text-red-600 dark:text-red-500';
  return 'text-muted-foreground';
}

export default function PortfolioPage() {
  // Fetch portfolio data for summary cards
  const { data: portfolio, isLoading } = useQuery({
    queryKey: portfolioKeys.overview(),
    queryFn: () => apiClient.getPortfolio(DEFAULT_USER_ID),
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    staleTime: 5000,
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Portfolio</h1>
        <p className="text-muted-foreground">
          Monitor your positions, track PnL, and manage your trades
        </p>
      </div>

      {/* Portfolio Summary */}
      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Value</h3>
          {isLoading ? (
            <Skeleton className="h-10 w-32 mb-2" />
          ) : (
            <p className="text-3xl font-bold">{formatCurrency(portfolio?.totalValue || 0)}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">Portfolio value</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Cash Balance</h3>
          {isLoading ? (
            <Skeleton className="h-10 w-32 mb-2" />
          ) : (
            <p className="text-3xl font-bold">{formatCurrency(portfolio?.cashBalance || 0)}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">Available cash</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total P&L</h3>
          {isLoading ? (
            <Skeleton className="h-10 w-32 mb-2" />
          ) : (
            <p className={`text-3xl font-bold ${getPnLColorClass(portfolio?.totalPnL || 0)}`}>
              {formatCurrency(portfolio?.totalPnL || 0)}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">Unrealized gain/loss</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Daily P&L</h3>
          {isLoading ? (
            <Skeleton className="h-10 w-32 mb-2" />
          ) : (
            <p className={`text-3xl font-bold ${getPnLColorClass(portfolio?.dailyPnL || 0)}`}>
              {formatCurrency(portfolio?.dailyPnL || 0)}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">Today&apos;s change</p>
        </div>
      </div>

      {/* Portfolio Metrics */}
      <div className="rounded-lg border bg-card p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Portfolio Metrics</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Exposure</p>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-lg font-semibold">
                {((portfolio?.metrics.totalExposure || 0) * 100).toFixed(1)}%
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Win Rate</p>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-lg font-semibold">
                {((portfolio?.metrics.winRate || 0) * 100).toFixed(1)}%
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Win</p>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-lg font-semibold text-green-600">
                {formatCurrency(portfolio?.metrics.avgWin || 0)}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Loss</p>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-lg font-semibold text-red-600">
                {formatCurrency(portfolio?.metrics.avgLoss || 0)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Positions Table - Using PortfolioTable component */}
      <PortfolioTable userId={DEFAULT_USER_ID} refetchInterval={10000} />

      {/* Paper/Live Toggle Info */}
      <div className="mt-6 rounded-lg border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Paper Trading:</strong> Practice with simulated trades without risking real money.
          Switch to live trading when you&apos;re ready.
        </p>
      </div>
    </div>
  );
}
