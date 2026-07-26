/**
 * PerformancePanel - Display performance metrics for a selected version
 *
 * Shows: trades count, win rate, profit factor, expectancy, average R, drawdown.
 *
 * Requirements: 11.5
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PerformanceMetrics } from './types';

export interface PerformancePanelProps {
  metrics: PerformanceMetrics | null;
  isLoading: boolean;
}

interface MetricItemProps {
  label: string;
  value: string;
  isPositive?: boolean;
  isNeutral?: boolean;
}

function MetricItem({ label, value, isPositive, isNeutral }: MetricItemProps) {
  return (
    <div className="rounded-lg border p-3">
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

export function PerformancePanel({ metrics, isLoading }: PerformancePanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            Loading metrics...
          </div>
        ) : !metrics ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            No performance data available for this version.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricItem
              label="Trades Count"
              value={metrics.trades_count.toString()}
              isNeutral
            />
            <MetricItem
              label="Win Rate"
              value={`${metrics.win_rate.toFixed(1)}%`}
              isPositive={metrics.win_rate >= 50}
            />
            <MetricItem
              label="Profit Factor"
              value={metrics.profit_factor.toFixed(2)}
              isPositive={metrics.profit_factor >= 1}
            />
            <MetricItem
              label="Expectancy"
              value={metrics.expectancy.toFixed(2)}
              isPositive={metrics.expectancy >= 0}
            />
            <MetricItem
              label="Average R"
              value={`${metrics.average_r.toFixed(2)}R`}
              isPositive={metrics.average_r >= 0}
            />
            <MetricItem
              label="Max Drawdown"
              value={`${metrics.max_drawdown.toFixed(2)}%`}
              isPositive={false}
              isNeutral={metrics.max_drawdown === 0}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
