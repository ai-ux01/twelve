'use client';

/**
 * TradePnLChart Component
 *
 * Histogram chart showing individual trade P&L values.
 * Green bars for profitable trades, red bars for losing trades.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5
 */

import { useEffect, useRef } from 'react';
import type { ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { useChart } from '@/lib/hooks/useChart';

interface TradePnLChartProps {
  trades: { closedAt: string; realizedPnL: number }[];
  height?: number;
}

export default function TradePnLChart({
  trades,
  height = 300,
}: TradePnLChartProps) {
  const { chartContainerRef, chart, isReady } = useChart({
    height,
    fitContent: true,
  });
  const seriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  useEffect(() => {
    if (!isReady || !chart) return;
    if (trades.length === 0) return;

    // Remove existing series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Sort trades chronologically
    const sorted = [...trades].sort(
      (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
    );

    // Build histogram data with color based on P&L sign
    const data = sorted.map((trade) => ({
      time: (new Date(trade.closedAt).getTime() / 1000) as UTCTimestamp,
      value: trade.realizedPnL,
      color: trade.realizedPnL >= 0 ? '#26a69a' : '#ef5350',
    }));

    // Add histogram series
    const histogramSeries = chart.addHistogramSeries({
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    histogramSeries.setData(data);
    seriesRef.current = histogramSeries;

    chart.timeScale().fitContent();
  }, [trades, isReady, chart]);

  if (trades.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No trades available to display P&L
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div ref={chartContainerRef as React.RefObject<HTMLDivElement>} className="w-full" />
    </div>
  );
}
