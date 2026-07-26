'use client';

/**
 * EquityCurveChart Component
 *
 * Line chart showing cumulative P&L over time using a baseline series.
 * Green area above zero, red area below zero.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5
 */

import { useEffect, useRef } from 'react';
import type { ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { useChart } from '@/lib/hooks/useChart';
import { cumulativeSum } from '@/lib/charts/chart-utils';

interface EquityCurveChartProps {
  trades: { closedAt: string; realizedPnL: number }[];
  height?: number;
}

export default function EquityCurveChart({
  trades,
  height = 300,
}: EquityCurveChartProps) {
  const { chartContainerRef, chart, isReady } = useChart({
    height,
    fitContent: true,
  });
  const seriesRef = useRef<ISeriesApi<'Baseline'> | null>(null);

  useEffect(() => {
    if (!isReady || !chart) return;
    if (trades.length === 0) return;

    // Remove existing series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Compute cumulative P&L
    const pnlValues = trades.map((t) => t.realizedPnL);
    const cumulative = cumulativeSum(pnlValues);

    // Build baseline series data
    const data = trades.map((trade, i) => ({
      time: (new Date(trade.closedAt).getTime() / 1000) as UTCTimestamp,
      value: cumulative[i],
    }));

    // Add baseline series: green above zero, red below zero
    const baselineSeries = chart.addBaselineSeries({
      baseValue: { type: 'price', price: 0 },
      topLineColor: '#26a69a',
      topFillColor1: 'rgba(38, 166, 154, 0.28)',
      topFillColor2: 'rgba(38, 166, 154, 0.05)',
      bottomLineColor: '#ef5350',
      bottomFillColor1: 'rgba(239, 83, 80, 0.05)',
      bottomFillColor2: 'rgba(239, 83, 80, 0.28)',
    });

    baselineSeries.setData(data);
    seriesRef.current = baselineSeries;

    chart.timeScale().fitContent();
  }, [trades, isReady, chart]);

  if (trades.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No trades available to display equity curve
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div ref={chartContainerRef as React.RefObject<HTMLDivElement>} className="w-full" />
    </div>
  );
}
