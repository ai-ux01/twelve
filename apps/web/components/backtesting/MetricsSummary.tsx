/**
 * MetricsSummary Component
 *
 * Displays a grid of 11 performance metric cards from backtest results.
 * Color-codes positive values green and negative values red.
 *
 * Metrics: Total Return %, CAGR, Win Rate, Profit Factor, Expectancy,
 * Average Winner, Average Loser, Max Drawdown %, Sharpe Ratio,
 * Total Trades, Average Holding Period.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface PerformanceMetrics {
  total_return_pct: number;
  cagr: number;
  win_rate: number;
  profit_factor: number;
  expectancy: number;
  average_winner: number;
  average_loser: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  total_trades: number;
  average_holding_period: number;
}

export interface MetricsSummaryProps {
  metrics: PerformanceMetrics | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  isPositive: boolean;
  isNeutral?: boolean;
}

function MetricCard({ label, value, isPositive, isNeutral }: MetricCardProps) {
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

export function MetricsSummary({ metrics }: MetricsSummaryProps) {
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Run a backtest to see performance metrics.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Total Return"
            value={`${metrics.total_return_pct.toFixed(2)}%`}
            isPositive={metrics.total_return_pct >= 0}
          />
          <MetricCard
            label="CAGR"
            value={`${(metrics.cagr * 100).toFixed(2)}%`}
            isPositive={metrics.cagr >= 0}
          />
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
            value={`₹${metrics.expectancy.toFixed(2)}`}
            isPositive={metrics.expectancy >= 0}
          />
          <MetricCard
            label="Avg Winner"
            value={`₹${metrics.average_winner.toFixed(2)}`}
            isPositive={true}
          />
          <MetricCard
            label="Avg Loser"
            value={`₹${metrics.average_loser.toFixed(2)}`}
            isPositive={false}
            isNeutral={metrics.average_loser === 0}
          />
          <MetricCard
            label="Max Drawdown"
            value={`${metrics.max_drawdown_pct.toFixed(2)}%`}
            isPositive={false}
            isNeutral={metrics.max_drawdown_pct === 0}
          />
          <MetricCard
            label="Sharpe Ratio"
            value={metrics.sharpe_ratio.toFixed(2)}
            isPositive={metrics.sharpe_ratio >= 0}
          />
          <MetricCard
            label="Total Trades"
            value={String(metrics.total_trades)}
            isPositive={true}
            isNeutral={true}
          />
          <MetricCard
            label="Avg Holding"
            value={`${metrics.average_holding_period.toFixed(1)} bars`}
            isPositive={true}
            isNeutral={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}
