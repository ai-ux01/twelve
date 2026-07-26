/**
 * Performance Metrics Component
 *
 * Grid of metric cards showing trade count, win rate, profit factor,
 * expectancy, max drawdown. Includes probability calibration visual.
 *
 * Requirements: 9.4, 9.5
 */

'use client';

import type { PerformanceMetrics as PerformanceMetricsType, ProbabilityCalibration } from './types';

interface PerformanceMetricsProps {
  metrics: PerformanceMetricsType;
  calibration: ProbabilityCalibration;
}

interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
}

function MetricCard({ label, value, sublabel }: MetricCardProps) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

export function PerformanceMetrics({ metrics, calibration }: PerformanceMetricsProps) {
  const calibrationError = Math.abs(calibration.expected_probability - calibration.actual_probability);

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Performance Metrics
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard label="Trade Count" value={String(metrics.trade_count)} />
        <MetricCard
          label="Win Rate"
          value={`${(metrics.win_rate * 100).toFixed(1)}%`}
          sublabel={metrics.win_rate > 0.4 ? '> 40% threshold' : '< 40% threshold'}
        />
        <MetricCard
          label="Profit Factor"
          value={metrics.profit_factor.toFixed(2)}
          sublabel={metrics.profit_factor > 1.0 ? 'Above 1.0' : 'Below 1.0'}
        />
        <MetricCard
          label="Expectancy"
          value={metrics.expectancy.toFixed(2)}
          sublabel={metrics.expectancy > 0 ? 'Positive' : 'Non-positive'}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${(metrics.max_drawdown * 100).toFixed(1)}%`}
        />
      </div>

      {/* Probability Calibration Visual */}
      <div className="rounded-lg border bg-white p-3 mt-3">
        <p className="text-xs text-muted-foreground mb-2">Probability Calibration</p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Expected</span>
              <span>{(calibration.expected_probability * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${calibration.expected_probability * 100}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Actual</span>
              <span>{(calibration.actual_probability * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${calibration.actual_probability * 100}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Error</p>
            <p
              className={`text-sm font-semibold ${
                calibrationError < 0.2 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {(calibrationError * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
