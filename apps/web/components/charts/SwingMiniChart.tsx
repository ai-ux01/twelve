'use client';

/**
 * SwingMiniChart Component
 *
 * Compact candlestick chart for swing scanner results. Fixed 120px height,
 * no volume, no time axis labels. Shows price level overlays for entry,
 * stop-loss, and target. Clickable to select the candidate.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { useEffect, useRef } from 'react';
import type { ISeriesApi } from 'lightweight-charts';
import { useChart } from '@/lib/hooks/useChart';
import { toCandlestickData, addPriceLevel, computeTrendlinePoints } from '@/lib/charts/chart-utils';
import type { OHLCVData, TrendlineLine } from '@/lib/api-client';

interface SwingMiniChartProps {
  symbol: string;
  data: OHLCVData[];
  entry?: number;
  stopLoss?: number;
  target?: number;
  trendlines?: { support?: TrendlineLine; resistance?: TrendlineLine };
  onClick?: () => void;
}

/** Color constants for price level overlays */
const ENTRY_COLOR = '#26a69a'; // green
const STOP_LOSS_COLOR = '#ef5350'; // red
const TARGET_COLOR = '#42a5f5'; // blue

/** Trendline rendering constants */
const SUPPORT_TL_COLOR = '#26a69a'; // green
const RESISTANCE_TL_COLOR = '#ef5350'; // red
const TRENDLINE_LINE_STYLE = 2; // dashed (LineStyle.Dashed)
const TRENDLINE_LINE_WIDTH = 2;

export default function SwingMiniChart({
  symbol,
  data,
  entry,
  stopLoss,
  target,
  trendlines,
  onClick,
}: SwingMiniChartProps) {
  const { chartContainerRef, chart, isReady } = useChart({
    height: 120,
    showTimeScale: false,
    showGrid: false,
    showCrosshair: false,
    fitContent: true,
  });
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLevelSeriesRefs = useRef<ISeriesApi<'Line'>[]>([]);
  const trendlineSeriesRefs = useRef<ISeriesApi<'Line'>[]>([]);

  // Render candlestick data and price level overlays
  useEffect(() => {
    if (!isReady || !chart) return;

    // Remove existing series
    if (candlestickSeriesRef.current) {
      chart.removeSeries(candlestickSeriesRef.current);
      candlestickSeriesRef.current = null;
    }
    for (const series of priceLevelSeriesRefs.current) {
      chart.removeSeries(series);
    }
    priceLevelSeriesRefs.current = [];

    if (data.length === 0) return;

    // Add candlestick series (no volume for compact view)
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const candlestickData = toCandlestickData(data);
    candlestickSeries.setData(candlestickData);
    candlestickSeriesRef.current = candlestickSeries;

    // Add price level overlays
    const newPriceLevels: ISeriesApi<'Line'>[] = [];

    if (entry !== undefined) {
      const series = addPriceLevel(chart, entry, ENTRY_COLOR, 'Entry');
      newPriceLevels.push(series);
    }

    if (stopLoss !== undefined) {
      const series = addPriceLevel(chart, stopLoss, STOP_LOSS_COLOR, 'SL');
      newPriceLevels.push(series);
    }

    if (target !== undefined) {
      const series = addPriceLevel(chart, target, TARGET_COLOR, 'Target');
      newPriceLevels.push(series);
    }

    priceLevelSeriesRefs.current = newPriceLevels;

    // Fit content to show all data
    chart.timeScale().fitContent();
  }, [isReady, chart, data, entry, stopLoss, target]);

  // Render trendline overlays
  useEffect(() => {
    if (!isReady || !chart) return;

    // Remove previous trendline series
    for (const series of trendlineSeriesRefs.current) {
      chart.removeSeries(series);
    }
    trendlineSeriesRefs.current = [];

    // Skip rendering if no trendline data
    if (!trendlines?.support && !trendlines?.resistance) return;
    if (data.length === 0) return;

    const newTrendlineSeries: ISeriesApi<'Line'>[] = [];

    // Add support trendline (green dashed)
    if (trendlines?.support) {
      const supportPoints = computeTrendlinePoints(trendlines.support, data);
      if (supportPoints.length === 2) {
        const supportSeries = chart.addLineSeries({
          color: SUPPORT_TL_COLOR,
          lineWidth: TRENDLINE_LINE_WIDTH,
          lineStyle: TRENDLINE_LINE_STYLE,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        supportSeries.setData(supportPoints);
        newTrendlineSeries.push(supportSeries);
      }
    }

    // Add resistance trendline (red dashed)
    if (trendlines?.resistance) {
      const resistancePoints = computeTrendlinePoints(trendlines.resistance, data);
      if (resistancePoints.length === 2) {
        const resistanceSeries = chart.addLineSeries({
          color: RESISTANCE_TL_COLOR,
          lineWidth: TRENDLINE_LINE_WIDTH,
          lineStyle: TRENDLINE_LINE_STYLE,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        resistanceSeries.setData(resistancePoints);
        newTrendlineSeries.push(resistanceSeries);
      }
    }

    trendlineSeriesRefs.current = newTrendlineSeries;
  }, [isReady, chart, data, trendlines]);

  return (
    <div
      className="relative w-full cursor-pointer rounded border border-border transition-colors hover:border-primary/50"
      style={{ height: 120 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`Mini chart for ${symbol}`}
    >
      <div ref={chartContainerRef as React.RefObject<HTMLDivElement>} className="w-full h-full" />

      {/* Empty state */}
      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">No data</span>
        </div>
      )}
    </div>
  );
}
