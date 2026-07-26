/**
 * PerformanceMetricsPanel - Summary cards with color-coded trading metrics
 *
 * Displays: Win Rate, Profit Factor, Total P&L, Expectancy, Average R, Max Drawdown.
 * Color-codes metrics green for positive, red for negative.
 * Shows "No closed trades yet" when all metrics are zero.
 *
 * Requirements: 9.1, 9.2
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PerformanceMetrics } from './types';

export interface PerformanceMetricsPanelProps {
  metrics: PerformanceMetrics | null;
  isLoading: boolean;
  error: string | null;
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface MetricCardProps {
  label: string;
  value: string;
  isPositive: boolean;
  isNeutral?: boolean;
}

function MetricCard({ label, value, isPositive, isNeutral }: MetricCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p
        className={cn(
          'text-xl font-bold font-mono',
          isNeutral
            ? 'text-foreground'
            : isPositive
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function isAllZero(metrics: PerformanceMetrics): boolean {
  return (
    metrics.totalTrades === 0 &&
    metrics.totalPnL === 0 &&
    metrics.winRate === 0 &&
    metrics.profitFactor === 0 &&
    metrics.expectancy === 0 &&
    metrics.averageR === 0 &&
    metrics.maxDrawdown === 0
  );
}

export function PerformanceMetricsPanel({
  metrics,
  isLoading,
  error,
}: PerformanceMetricsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        {isLoading && !metrics ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading metrics...
          </div>
        ) : !metrics || isAllZero(metrics) ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No closed trades yet
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Win Rate"
              value={`${(metrics.winRate ?? 0).toFixed(1)}%`}
              isPositive={(metrics.winRate ?? 0) >= 50}
            />
            <MetricCard
              label="Profit Factor"
              value={(metrics.profitFactor ?? 0) >= 999999 ? '∞' : (metrics.profitFactor ?? 0).toFixed(2)}
              isPositive={(metrics.profitFactor ?? 0) >= 1}
            />
            <MetricCard
              label="Total P&L"
              value={currencyFormatter.format(metrics.totalPnL ?? 0)}
              isPositive={(metrics.totalPnL ?? 0) >= 0}
            />
            <MetricCard
              label="Expectancy"
              value={`${currencyFormatter.format(metrics.expectancy ?? 0)}/trade`}
              isPositive={(metrics.expectancy ?? 0) >= 0}
            />
            <MetricCard
              label="Average R"
              value={`${(metrics.averageR ?? 0).toFixed(2)}R`}
              isPositive={(metrics.averageR ?? 0) >= 0}
            />
            <MetricCard
              label="Max Drawdown"
              value={currencyFormatter.format(metrics.maxDrawdown ?? 0)}
              isPositive={false}
              isNeutral={(metrics.maxDrawdown ?? 0) === 0}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
