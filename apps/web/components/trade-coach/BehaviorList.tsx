/**
 * BehaviorList Component
 *
 * Shows detected negative behavior patterns with counts and severity.
 *
 * Phase 15 - AI Trade Coach
 */

'use client';

import type { BehaviorDetection, BehaviorSeverity } from './types';

export interface BehaviorListProps {
  behaviors: BehaviorDetection[];
  isLoading: boolean;
}

const SEVERITY_STYLES: Record<BehaviorSeverity, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Low' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Critical' },
};

const PATTERN_LABELS: Record<string, string> = {
  overtrading: 'Overtrading',
  revenge_trading: 'Revenge Trading',
  oversizing: 'Oversizing',
  chasing: 'Chasing',
  weak_setups: 'Weak Setups',
  counter_trend: 'Counter-Trend',
  poor_risk_reward: 'Poor R:R',
  moving_stops: 'Moving Stops',
  early_exits: 'Early Exits',
  late_exits: 'Late Exits',
};

export function BehaviorList({ behaviors, isLoading }: BehaviorListProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="space-y-3">
          <div className="h-12 w-full bg-muted rounded" />
          <div className="h-12 w-full bg-muted rounded" />
          <div className="h-12 w-full bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Behavior Patterns</h2>
        {behaviors.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {behaviors.length} pattern{behaviors.length !== 1 ? 's' : ''} detected
          </span>
        )}
      </div>

      {behaviors.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-lg mb-1">No negative patterns detected</p>
          <p className="text-sm">
            Import trades and analyze them to detect behavioral patterns.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {behaviors
            .sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity))
            .map((behavior, i) => (
              <BehaviorCard key={i} behavior={behavior} />
            ))}
        </div>
      )}
    </div>
  );
}

function BehaviorCard({ behavior }: { behavior: BehaviorDetection }) {
  const severityStyle = SEVERITY_STYLES[behavior.severity];
  const patternLabel = PATTERN_LABELS[behavior.pattern] || behavior.pattern;

  return (
    <div className="flex items-start gap-4 p-3 rounded-md border bg-muted/20">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{patternLabel}</span>
          <span
            className={`px-2 py-0.5 text-xs rounded-full font-medium ${severityStyle.bg} ${severityStyle.text}`}
          >
            {severityStyle.label}
          </span>
          <span className="text-xs text-muted-foreground">
            × {behavior.count}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{behavior.description}</p>
        {behavior.details && (
          <p className="text-xs text-muted-foreground mt-1 italic">
            {behavior.details}
          </p>
        )}
      </div>
    </div>
  );
}

function severityOrder(severity: BehaviorSeverity): number {
  const order: Record<BehaviorSeverity, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  return order[severity];
}
