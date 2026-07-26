/**
 * Validation Status Component
 *
 * Cards for Backtest, Out-of-Sample, Walk-Forward, Paper Trading, Shadow Mode.
 * Shows pass/fail/pending with icons. Paper trading shows metrics when running.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.5
 */

'use client';

import type { ValidationStatuses, PerformanceMetrics, ProbabilityCalibration } from './types';

interface ValidationStatusProps {
  validations: ValidationStatuses;
  metrics: PerformanceMetrics;
  calibration: ProbabilityCalibration;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'passed':
      return '✅';
    case 'failed':
      return '❌';
    case 'running':
      return '🔄';
    case 'pending':
    case 'not_started':
      return '⏳';
    default:
      return '—';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'passed':
      return 'border-green-300 bg-green-50';
    case 'failed':
      return 'border-red-300 bg-red-50';
    case 'running':
      return 'border-blue-300 bg-blue-50';
    case 'pending':
    case 'not_started':
      return 'border-gray-200 bg-gray-50';
    default:
      return 'border-gray-200 bg-gray-50';
  }
}

export function ValidationStatus({ validations, metrics, calibration }: ValidationStatusProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Validation Status
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {/* Backtest */}
        <div className={`rounded-lg border p-3 ${getStatusColor(validations.backtest_status)}`}>
          <div className="flex items-center gap-2 mb-1">
            <span>{getStatusIcon(validations.backtest_status)}</span>
            <h3 className="text-xs font-medium">Backtest</h3>
          </div>
          <p className="text-xs capitalize">{validations.backtest_status}</p>
        </div>

        {/* Out-of-Sample */}
        <div className={`rounded-lg border p-3 ${getStatusColor(validations.out_of_sample_status)}`}>
          <div className="flex items-center gap-2 mb-1">
            <span>{getStatusIcon(validations.out_of_sample_status)}</span>
            <h3 className="text-xs font-medium">Out-of-Sample</h3>
          </div>
          <p className="text-xs capitalize">{validations.out_of_sample_status}</p>
        </div>

        {/* Walk-Forward */}
        <div className={`rounded-lg border p-3 ${getStatusColor(validations.walk_forward_status)}`}>
          <div className="flex items-center gap-2 mb-1">
            <span>{getStatusIcon(validations.walk_forward_status)}</span>
            <h3 className="text-xs font-medium">Walk-Forward</h3>
          </div>
          <p className="text-xs capitalize">{validations.walk_forward_status}</p>
        </div>

        {/* Paper Trading */}
        <div className={`rounded-lg border p-3 ${getStatusColor(validations.paper_trading_status)}`}>
          <div className="flex items-center gap-2 mb-1">
            <span>{getStatusIcon(validations.paper_trading_status)}</span>
            <h3 className="text-xs font-medium">Paper Trading</h3>
          </div>
          <p className="text-xs capitalize mb-1">{validations.paper_trading_status.replace('_', ' ')}</p>
          {validations.paper_trading_status === 'running' && (
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <p>Trades: {metrics.trade_count}</p>
              <p>Win Rate: {(metrics.win_rate * 100).toFixed(1)}%</p>
              <p>PF: {metrics.profit_factor.toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* Shadow Mode */}
        <div className={`rounded-lg border p-3 ${getStatusColor(validations.shadow_mode_status)}`}>
          <div className="flex items-center gap-2 mb-1">
            <span>{getStatusIcon(validations.shadow_mode_status)}</span>
            <h3 className="text-xs font-medium">Shadow Mode</h3>
          </div>
          <p className="text-xs capitalize mb-1">{validations.shadow_mode_status.replace('_', ' ')}</p>
          {(validations.shadow_mode_status === 'running' || validations.shadow_mode_status === 'passed') && (
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <p>Expected: {(calibration.expected_probability * 100).toFixed(1)}%</p>
              <p>Actual: {(calibration.actual_probability * 100).toFixed(1)}%</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
