'use client';

/**
 * PortfolioValueChart Component
 *
 * Line chart for 30-day portfolio value with tooltip on hover.
 * Uses lightweight-charts built-in crosshair for tooltip behavior.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { useEffect, useRef } from 'react';
import type { ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { useChart } from '@/lib/hooks/useChart';
import { toLineData } from '@/lib/charts/chart-utils';

interface PortfolioValueChartProps {
  data: { date: string; value: number }[];
  height?: number;
}

export default function PortfolioValueChart({
  data,
  height = 300,
}: PortfolioValueChartProps) {
  const { chartContainerRef, chart, isReady } = useChart({
    height,
    showCrosshair: true,
    fitContent: true,
  });
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!isReady || !chart) return;
    if (data.length === 0) return;

    // Remove existing series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Convert data to LineData format
    const lineData = toLineData(
      data.map((d) => ({ timestamp: d.date, value: d.value }))
    );

    // Add line series
    const lineSeries = chart.addLineSeries({
      color: '#26a69a',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    lineSeries.setData(lineData);
    seriesRef.current = lineSeries;

    chart.timeScale().fitContent();
  }, [data, isReady, chart]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No portfolio data available
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div ref={chartContainerRef as React.RefObject<HTMLDivElement>} className="w-full" />
    </div>
  );
}
