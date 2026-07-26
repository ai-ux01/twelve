/**
 * CompareView - Side-by-side comparison of two versions
 *
 * Shows content diff and metrics comparison using preformatted text.
 *
 * Requirements: 11.3
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PromptVersion, PerformanceMetrics } from './types';

export interface CompareViewProps {
  versionA: PromptVersion | null;
  versionB: PromptVersion | null;
  metricsA: PerformanceMetrics | null;
  metricsB: PerformanceMetrics | null;
  contentDiff: string | null;
  onClose: () => void;
}

function MetricsColumn({ metrics, label }: { metrics: PerformanceMetrics | null; label: string }) {
  if (!metrics) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No metrics for {label}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Trades</span>
        <span className="font-mono">{metrics.trades_count}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Win Rate</span>
        <span className="font-mono">{metrics.win_rate.toFixed(1)}%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Profit Factor</span>
        <span className="font-mono">{metrics.profit_factor.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Expectancy</span>
        <span className="font-mono">{metrics.expectancy.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Average R</span>
        <span className="font-mono">{metrics.average_r.toFixed(2)}R</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Max Drawdown</span>
        <span className="font-mono">{metrics.max_drawdown.toFixed(2)}%</span>
      </div>
    </div>
  );
}

export function CompareView({
  versionA,
  versionB,
  metricsA,
  metricsB,
  contentDiff,
  onClose,
}: CompareViewProps) {
  if (!versionA || !versionB) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            Compare v{versionA.version} vs v{versionB.version}
          </CardTitle>
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Content Diff */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Content Diff</h4>
          {contentDiff ? (
            <pre className="rounded-md bg-muted/50 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
              {contentDiff}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">No content differences.</p>
          )}
        </div>

        {/* Metrics Comparison */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Metrics Comparison</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Badge variant="secondary" className="mb-2">
                v{versionA.version}
              </Badge>
              <MetricsColumn metrics={metricsA} label={`v${versionA.version}`} />
            </div>
            <div>
              <Badge variant="secondary" className="mb-2">
                v{versionB.version}
              </Badge>
              <MetricsColumn metrics={metricsB} label={`v${versionB.version}`} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
