'use client';

/**
 * DashboardSparkline Component
 *
 * Minimal line chart with no axes, no grid, no crosshair.
 * Green line when last value > first value, red otherwise.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import { useEffect, useRef } from 'react';
import type { ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { useChart } from '@/lib/hooks/useChart';

interface DashboardSparklineProps {
  data: number[];
  width?: number;
  height?: number;
}

export default function DashboardSparkline({
  data,
  width = 120,
  height = 40,
}: DashboardSparklineProps) {
  const { chartContainerRef, chart, isReady } = useChart({
    height,
    showGrid: false,
    showCrosshair: false,
    showTimeScale: false,
    showPriceScale: false,
    fitContent: true,
    autoResize: false,
  });
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!isReady || !chart) return;
    if (data.length < 2) return;

    // Set fixed width
    chart.applyOptions({ width });

    // Remove existing series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Determine color: green if last > first, red otherwise
    const color = data[data.length - 1] > data[0] ? '#26a69a' : '#ef5350';

    // Create synthetic time values (one per data point)
    const lineData = data.map((value, i) => ({
      time: (1700000000 + i * 86400) as UTCTimestamp,
      value,
    }));

    // Add line series with minimal styling
    const lineSeries = chart.addLineSeries({
      color,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    lineSeries.setData(lineData);
    seriesRef.current = lineSeries;

    chart.timeScale().fitContent();
  }, [data, isReady, chart, width]);

  if (data.length < 2) {
    return <div style={{ width, height }} />;
  }

  return (
    <div style={{ width, height }}>
      <div ref={chartContainerRef as React.RefObject<HTMLDivElement>} />
    </div>
  );
}
