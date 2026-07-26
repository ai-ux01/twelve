/**
 * EquityCurveChart Component
 *
 * Renders a simple CSS-based bar chart showing portfolio equity over time.
 * Uses proportional-height divs for an MVP visualization without external
 * charting libraries.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface EquityPoint {
  bar_index: number;
  equity: number;
  timestamp?: number | null;
}

export interface EquityCurveChartProps {
  equityCurve: EquityPoint[];
  initialCapital: number;
}

export function EquityCurveChart({ equityCurve, initialCapital }: EquityCurveChartProps) {
  if (!equityCurve || equityCurve.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Equity Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No equity data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sample points for the chart (max ~60 bars shown)
  const maxBars = 60;
  const step = Math.max(1, Math.floor(equityCurve.length / maxBars));
  const sampled = equityCurve.filter((_, i) => i % step === 0 || i === equityCurve.length - 1);

  const equities = sampled.map((p) => p.equity);
  const minEquity = Math.min(...equities);
  const maxEquity = Math.max(...equities);
  const range = maxEquity - minEquity || 1;

  const chartHeight = 200;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equity Curve</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Chart legend */}
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Initial: ₹{initialCapital.toLocaleString()}</span>
          <span>Final: ₹{equityCurve[equityCurve.length - 1].equity.toLocaleString()}</span>
        </div>

        {/* Bar chart */}
        <div
          className="flex items-end gap-px border-b border-l p-1"
          style={{ height: `${chartHeight}px` }}
        >
          {sampled.map((point, i) => {
            const heightPct = ((point.equity - minEquity) / range) * 100;
            const isAboveInitial = point.equity >= initialCapital;
            return (
              <div
                key={i}
                className="flex-1 min-w-[2px] rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(heightPct, 2)}%`,
                  backgroundColor: isAboveInitial
                    ? 'rgb(34 197 94 / 0.7)'
                    : 'rgb(239 68 68 / 0.7)',
                }}
                title={`Bar ${point.bar_index}: ₹${point.equity.toFixed(2)}`}
              />
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Bar {sampled[0]?.bar_index}</span>
          <span>Bar {sampled[sampled.length - 1]?.bar_index}</span>
        </div>

        {/* Y-axis labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Min: ₹{minEquity.toLocaleString()}</span>
          <span>Max: ₹{maxEquity.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
