/**
 * BacktestResults Component
 *
 * Container component composing MetricsSummary, EquityCurveChart,
 * TradeList, and optional WalkForwardResults when per_window_metrics exists.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricsSummary, type PerformanceMetrics } from './MetricsSummary';
import { EquityCurveChart, type EquityPoint } from './EquityCurveChart';
import { TradeList, type TradeRecord } from './TradeList';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface WindowMetrics {
  window_index: number;
  in_sample_start: number;
  in_sample_end: number;
  out_of_sample_start: number;
  out_of_sample_end: number;
  total_trades: number;
  total_return_pct: number;
  win_rate: number;
  profit_factor: number;
  sharpe_ratio: number;
}

export interface BacktestResultData {
  backtest_id: string;
  symbol: string;
  test_mode: string;
  initial_capital: number;
  final_equity: number;
  trades: TradeRecord[];
  equity_curve: EquityPoint[];
  metrics: PerformanceMetrics;
  per_window_metrics?: WindowMetrics[] | null;
  survivorship_bias_warning: boolean;
}

export interface BacktestResultsProps {
  result: BacktestResultData | null;
}

function WalkForwardResults({ windows }: { windows: WindowMetrics[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Walk-Forward Results ({windows.length} windows)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Window</TableHead>
              <TableHead>IS Range</TableHead>
              <TableHead>OOS Range</TableHead>
              <TableHead>Trades</TableHead>
              <TableHead>Return %</TableHead>
              <TableHead>Win Rate</TableHead>
              <TableHead>PF</TableHead>
              <TableHead>Sharpe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {windows.map((w) => (
              <TableRow key={w.window_index}>
                <TableCell className="font-mono text-xs">{w.window_index + 1}</TableCell>
                <TableCell className="font-mono text-xs">
                  {w.in_sample_start}–{w.in_sample_end}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {w.out_of_sample_start}–{w.out_of_sample_end}
                </TableCell>
                <TableCell className="font-mono text-xs">{w.total_trades}</TableCell>
                <TableCell
                  className={cn(
                    'font-mono text-xs font-bold',
                    w.total_return_pct >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {w.total_return_pct.toFixed(2)}%
                </TableCell>
                <TableCell className="font-mono text-xs">{w.win_rate.toFixed(1)}%</TableCell>
                <TableCell className="font-mono text-xs">{w.profit_factor.toFixed(2)}</TableCell>
                <TableCell className="font-mono text-xs">{w.sharpe_ratio.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function BacktestResults({ result }: BacktestResultsProps) {
  if (!result) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">{result.symbol}</span>
        <span className="text-muted-foreground">
          Mode: {result.test_mode.replace(/_/g, ' ').toUpperCase()}
        </span>
        <span className="text-muted-foreground">ID: {result.backtest_id.slice(0, 8)}...</span>
        {result.survivorship_bias_warning && (
          <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">
            ⚠ Survivorship bias warning
          </span>
        )}
      </div>

      {/* Metrics */}
      <MetricsSummary metrics={result.metrics} />

      {/* Equity Curve */}
      <EquityCurveChart
        equityCurve={result.equity_curve}
        initialCapital={result.initial_capital}
      />

      {/* Walk-Forward Results */}
      {result.per_window_metrics && result.per_window_metrics.length > 0 && (
        <WalkForwardResults windows={result.per_window_metrics} />
      )}

      {/* Trade Log */}
      <TradeList trades={result.trades} />
    </div>
  );
}
