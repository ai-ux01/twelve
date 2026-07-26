/**
 * SourceComparison Component
 *
 * Side-by-side comparison of Paper vs Live vs Backtest performance metrics.
 *
 * Phase 15 - AI Trade Coach
 */

'use client';

import type { SourceComparisonResponse, SourceMetrics } from './types';

export interface SourceComparisonProps {
  comparison: SourceComparisonResponse | null;
  isLoading: boolean;
}

export function SourceComparison({ comparison, isLoading }: SourceComparisonProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!comparison) {
    return null;
  }

  const sources = [
    { label: 'Paper', data: comparison.paper, color: 'border-t-blue-500' },
    { label: 'Live', data: comparison.live, color: 'border-t-green-500' },
    { label: 'Backtest', data: comparison.backtest, color: 'border-t-purple-500' },
  ];

  const hasData = sources.some((s) => s.data && s.data.total_trades > 0);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-xl font-semibold mb-4">Source Comparison</h2>

      {!hasData ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-lg mb-1">No comparison data available</p>
          <p className="text-sm">
            Import trades from multiple sources (paper, live, backtest) to see comparisons.
          </p>
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {sources.map((source) => (
              <SourceCard
                key={source.label}
                label={source.label}
                metrics={source.data}
                colorClass={source.color}
              />
            ))}
          </div>

          {/* Insights */}
          {comparison.insights.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-2">📊 Insights</h3>
              <ul className="space-y-1">
                {comparison.insights.map((insight, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    • {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface SourceCardProps {
  label: string;
  metrics: SourceMetrics | null;
  colorClass: string;
}

function SourceCard({ label, metrics, colorClass }: SourceCardProps) {
  if (!metrics || metrics.total_trades === 0) {
    return (
      <div className={`border-t-4 ${colorClass} rounded-md border p-4 bg-muted/10`}>
        <h4 className="text-sm font-medium mb-2">{label}</h4>
        <p className="text-xs text-muted-foreground">No data</p>
      </div>
    );
  }

  return (
    <div className={`border-t-4 ${colorClass} rounded-md border p-4`}>
      <h4 className="text-sm font-medium mb-3">{label}</h4>
      <div className="space-y-2 text-sm">
        <MetricRow label="Trades" value={metrics.total_trades.toString()} />
        <MetricRow label="Win Rate" value={`${metrics.win_rate.toFixed(1)}%`} />
        <MetricRow label="Profit Factor" value={metrics.profit_factor.toFixed(2)} />
        <MetricRow label="Expectancy" value={`₹${metrics.expectancy.toFixed(2)}`} />
        <MetricRow label="Avg R" value={metrics.average_r.toFixed(2)} />
        <MetricRow
          label="Total P&L"
          value={`₹${metrics.total_pnl.toFixed(0)}`}
          positive={metrics.total_pnl > 0}
          negative={metrics.total_pnl < 0}
        />
      </div>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}

function MetricRow({ label, value, positive, negative }: MetricRowProps) {
  let valueClass = 'text-foreground';
  if (positive) valueClass = 'text-green-600';
  if (negative) valueClass = 'text-red-600';

  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
