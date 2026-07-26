/**
 * PerformanceMetricsDisplay Component - Trade Analysis
 *
 * Displays aggregate performance metrics: Win Rate, Profit Factor, Expectancy,
 * Max Drawdown, Average R, MFE mean, MAE mean.
 * Formats values as percentages, ratios, or ₹ currency.
 * Shows empty state when no trades are imported.
 *
 * Requirements: 8.4
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PerformanceMetrics } from './types';

export interface PerformanceMetricsDisplayProps {
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
          'text-lg font-bold font-mono',
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
  return metrics.total_trades === 0;
}

export function PerformanceMetricsDisplay({
  metrics,
  isLoading,
  error,
}: PerformanceMetricsDisplayProps) {
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
            No trades imported yet. Upload a CSV or add a trade manually.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <MetricCard
              label="Win Rate"
              value={`${metrics.win_rate.toFixed(1)}%`}
              isPositive={metrics.win_rate >= 50}
            />
            <MetricCard
              label="Profit Factor"
              value={metrics.profit_factor >= 9999 ? '∞' : metrics.profit_factor.toFixed(2)}
              isPositive={metrics.profit_factor >= 1}
            />
            <MetricCard
              label="Expectancy"
              value={`${currencyFormatter.format(metrics.expectancy)}/trade`}
              isPositive={metrics.expectancy >= 0}
            />
            <MetricCard
              label="Max Drawdown"
              value={currencyFormatter.format(metrics.max_drawdown)}
              isPositive={false}
              isNeutral={metrics.max_drawdown === 0}
            />
            <MetricCard
              label="Average R"
              value={`${metrics.average_r.toFixed(2)}R`}
              isPositive={metrics.average_r >= 0}
            />
            <MetricCard
              label="MFE Mean"
              value={
                metrics.mfe_mean != null
                  ? currencyFormatter.format(metrics.mfe_mean)
                  : '—'
              }
              isPositive={true}
              isNeutral={metrics.mfe_mean == null}
            />
            <MetricCard
              label="MAE Mean"
              value={
                metrics.mae_mean != null
                  ? currencyFormatter.format(metrics.mae_mean)
                  : '—'
              }
              isPositive={false}
              isNeutral={metrics.mae_mean == null}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
