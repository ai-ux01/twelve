/**
 * PortfolioTable Component
 *
 * Displays all open positions in table format with real-time PnL updates
 * Extended to show options positions separately with Greeks and expiry alerts
 *
 * Features:
 * - Shows symbol, quantity, entry price, current price, unrealized PnL, PnL%
 * - Color-code profit (green) and loss (red)
 * - Real-time updates using TanStack Query refetch
 * - Separate section for options positions with strike, type, expiry, Greeks
 * - Highlights expiring soon (< 7 days) with warning badge
 * - Shows aggregated options exposure percentage
 *
 * Requirements: 13.4, 11.5
 * Task: 18.3, 72.3
 */

'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { portfolioKeys } from '@/lib/query-keys';
import { apiClient, type Portfolio, type OptionsPositionInfo } from '@/lib/api-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface PortfolioTableProps {
  /**
   * User ID to fetch portfolio for
   */
  userId: string;

  /**
   * Refetch interval in milliseconds (default: 10 seconds for real-time updates)
   */
  refetchInterval?: number;
}

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
 * Format percentage value with + or - sign
 */
function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format date to readable string
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format Greek values (typically small decimal numbers)
 */
function formatGreek(value: number): string {
  return value.toFixed(4);
}

/**
 * Get color class based on value (green for profit, red for loss)
 */
function getPnLColorClass(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-500';
  if (value < 0) return 'text-red-600 dark:text-red-500';
  return 'text-muted-foreground';
}

export function PortfolioTable({
  userId,
  refetchInterval = 10000, // 10 seconds default
}: PortfolioTableProps) {
  // Fetch portfolio data with real-time updates
  const {
    data: portfolio,
    isLoading,
    isError,
    error,
    isRefetching,
  } = useQuery({
    queryKey: portfolioKeys.overview(),
    queryFn: () => apiClient.getPortfolio(userId),
    // Real-time updates
    refetchInterval,
    // Keep previous data while refetching
    placeholderData: (previousData) => previousData,
    // Consider data stale after 5 seconds
    staleTime: 5000,
  });

  // Fetch options positions with real-time updates
  const {
    data: optionsPositions = [],
    isLoading: isLoadingOptions,
    isError: isErrorOptions,
  } = useQuery({
    queryKey: ['portfolio', 'options', userId],
    queryFn: () => apiClient.getOptionsPositions(userId),
    // Real-time updates
    refetchInterval,
    // Keep previous data while refetching
    placeholderData: (previousData) => previousData,
    // Consider data stale after 5 seconds
    staleTime: 5000,
  });

  // Calculate aggregated options exposure
  const optionsExposure = React.useMemo(() => {
    if (!portfolio || optionsPositions.length === 0) return 0;
    const totalOptionsValue = optionsPositions.reduce(
      (sum, pos) => sum + pos.currentPrice * pos.quantity,
      0
    );
    return portfolio.totalValue > 0 ? (totalOptionsValue / portfolio.totalValue) * 100 : 0;
  }, [portfolio, optionsPositions]);

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Open Positions</h2>
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Entry Price</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">P&L %</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Open Positions</h2>
        </div>
        <div className="p-6">
          <div className="text-center text-destructive">
            <p className="font-medium">Failed to load portfolio</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No positions state
  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Open Positions</h2>
          <Badge variant="secondary">0 positions</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Entry Price</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">P&L %</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="text-muted-foreground">
                    No open positions. Start trading by analyzing stocks in the{' '}
                    <a href="/analysis" className="text-primary hover:underline font-medium">
                      Analysis
                    </a>{' '}
                    section.
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // Success state with positions
  return (
    <div className="space-y-6">
      {/* Stock Positions Table */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Stock Positions</h2>
            {isRefetching && <p className="text-xs text-muted-foreground mt-1">Updating...</p>}
          </div>
          <Badge variant="secondary">
            {portfolio.positions.length} position{portfolio.positions.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Entry Price</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">P&L %</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolio.positions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="text-muted-foreground">
                      No stock positions. Start trading by analyzing stocks in the{' '}
                      <a href="/analysis" className="text-primary hover:underline font-medium">
                        Analysis
                      </a>{' '}
                      section.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                portfolio.positions.map((position) => {
                  const pnlColorClass = getPnLColorClass(position.unrealizedPnL);

                  return (
                    <TableRow key={position.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{position.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={position.isPaper ? 'outline' : 'default'} className="text-xs">
                          {position.isPaper ? 'Paper' : 'Live'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{position.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(position.averagePrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(position.currentPrice)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${pnlColorClass}`}>
                        {formatCurrency(position.unrealizedPnL)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${pnlColorClass}`}>
                        {formatPercentage(position.unrealizedPnLPercent)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={position.unrealizedPnL >= 0 ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {position.unrealizedPnL >= 0 ? 'Profit' : 'Loss'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Options Positions Table */}
      {!isLoadingOptions && !isErrorOptions && optionsPositions.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="p-6 border-b flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Options Positions</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Options Exposure: {formatPercentage(optionsExposure)} of portfolio
              </p>
            </div>
            <Badge variant="secondary">
              {optionsPositions.length} position{optionsPositions.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Expiring Soon Alert */}
          {optionsPositions.some((pos) => pos.isExpiringSoon) && (
            <div className="px-6 pt-4">
              <Alert className="border-red-600 bg-red-50 dark:bg-red-950/20">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  You have {optionsPositions.filter((pos) => pos.isExpiringSoon).length} options
                  position(s) expiring within 7 days. Review and consider closing positions.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Strike</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead className="text-right">P&L %</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead className="text-right">Theta</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {optionsPositions.map((position) => {
                  const pnlColorClass = getPnLColorClass(position.unrealizedPnL);

                  return (
                    <TableRow
                      key={position.id}
                      className={`hover:bg-muted/50 ${position.isExpiringSoon ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}
                    >
                      <TableCell className="font-medium">{position.symbol}</TableCell>
                      <TableCell className="text-right">{position.strikePrice}</TableCell>
                      <TableCell>
                        <Badge
                          variant={position.optionType === 'CALL' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {position.optionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(position.expiry)}
                        {position.isExpiringSoon && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            {position.daysToExpiry}d
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{position.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(position.entryPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(position.currentPrice)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${pnlColorClass}`}>
                        {formatCurrency(position.unrealizedPnL)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${pnlColorClass}`}>
                        {formatPercentage(position.unrealizedPnLPercent)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {formatGreek(position.greeks.delta)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {formatGreek(position.greeks.theta)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge
                            variant={position.isPaper ? 'outline' : 'default'}
                            className="text-xs"
                          >
                            {position.isPaper ? 'Paper' : 'Live'}
                          </Badge>
                          {position.expiryAlert && position.daysToExpiry <= 1 && (
                            <Badge variant="destructive" className="text-xs">
                              ⚠ {position.daysToExpiry === 0 ? 'Today' : 'Tomorrow'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
