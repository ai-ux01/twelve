'use client';

/**
 * CumulativePnLChart Component
 *
 * Line chart with baseline series showing cumulative P&L over time.
 * Green area above zero, red area below. Includes zero reference line.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { useEffect, useRef } from 'react';
import type { ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { useChart } from '@/lib/hooks/useChart';
import { cumulativeSum } from '@/lib/charts/chart-utils';

interface CumulativePnLChartProps {
  trades: { date: string; pnl: number }[];
  height?: number;
  isLoading?: boolean;
}

export default function CumulativePnLChart({
  trades,
  height = 300,
  isLoading = false,
}: CumulativePnLChartProps) {
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
    const pnlValues = trades.map((t) => t.pnl);
    const cumulative = cumulativeSum(pnlValues);

    // Build baseline series data
    const data = trades.map((trade, i) => ({
      time: (new Date(trade.date).getTime() / 1000) as UTCTimestamp,
      value: cumulative[i],
    }));

    // Add baseline series with zero as the base value
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

    // Add zero reference price line
    baselineSeries.createPriceLine({
      price: 0,
      color: '#758696',
      lineWidth: 1,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: 'Zero',
    });

    chart.timeScale().fitContent();
  }, [trades, isReady, chart]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className="animate-pulse rounded bg-muted"
        style={{ height }}
      />
    );
  }

  if (trades.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No cumulative P&L data available
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div ref={chartContainerRef as React.RefObject<HTMLDivElement>} className="w-full" />
    </div>
  );
}
