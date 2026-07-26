'use client';

/**
 * IntradayChart Component
 *
 * 5-minute candlestick chart with entry, stop-loss, and target price level overlays.
 * Used on the Intraday page to visualize trading signals in context of price action.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { useEffect, useRef } from 'react';
import type { ISeriesApi } from 'lightweight-charts';
import { useChart } from '@/lib/hooks/useChart';
import { toCandlestickData, addPriceLevel, computeTrendlinePoints } from '@/lib/charts/chart-utils';
import type { OHLCVData, TrendlineLine } from '@/lib/api-client';

interface IntradayChartProps {
  symbol: string;
  data: OHLCVData[];
  entry?: number;
  stopLoss?: number;
  target?: number;
  height?: number;
  trendlines?: {
    support?: TrendlineLine;
    resistance?: TrendlineLine;
  };
}

/** Color constants for price level overlays */
const ENTRY_COLOR = '#26a69a'; // green
const STOP_LOSS_COLOR = '#ef5350'; // red
const TARGET_COLOR = '#42a5f5'; // blue

/** Trendline overlay constants */
const SUPPORT_TL_COLOR = '#26a69a'; // green
const RESISTANCE_TL_COLOR = '#ef5350'; // red
const TRENDLINE_LINE_STYLE = 2; // dashed (LineStyle.Dashed)
const TRENDLINE_LINE_WIDTH = 2;

export default function IntradayChart({
  symbol,
  data,
  entry,
  stopLoss,
  target,
  height = 400,
  trendlines,
}: IntradayChartProps) {
  const { chartContainerRef, chart, isReady } = useChart({ height, fitContent: true });
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

    // Add candlestick series
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
      const series = addPriceLevel(chart, stopLoss, STOP_LOSS_COLOR, 'Stop Loss');
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

    // Skip rendering if neither support nor resistance line is present
    if (!trendlines?.support && !trendlines?.resistance) return;

    const newTrendlineSeries: ISeriesApi<'Line'>[] = [];

    // Render support trendline
    if (trendlines?.support) {
      const supportPoints = computeTrendlinePoints(trendlines.support, data);
      if (supportPoints.length === 2) {
        const supportSeries = chart.addLineSeries({
          color: SUPPORT_TL_COLOR,
          lineWidth: TRENDLINE_LINE_WIDTH,
          lineStyle: TRENDLINE_LINE_STYLE,
          title: 'Support TL',
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        supportSeries.setData(supportPoints);
        newTrendlineSeries.push(supportSeries);
      }
    }

    // Render resistance trendline
    if (trendlines?.resistance) {
      const resistancePoints = computeTrendlinePoints(trendlines.resistance, data);
      if (resistancePoints.length === 2) {
        const resistanceSeries = chart.addLineSeries({
          color: RESISTANCE_TL_COLOR,
          lineWidth: TRENDLINE_LINE_WIDTH,
          lineStyle: TRENDLINE_LINE_STYLE,
          title: 'Resistance TL',
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
    <div className="w-full">
      {/* Chart container */}
      <div ref={chartContainerRef as React.RefObject<HTMLDivElement>} className="w-full" />

      {/* Empty state */}
      {data.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <span className="text-sm text-muted-foreground">No data available</span>
        </div>
      )}

      {/* Legend */}
      {(entry !== undefined || stopLoss !== undefined || target !== undefined || trendlines?.support || trendlines?.resistance) && (
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          {entry !== undefined && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={{ backgroundColor: ENTRY_COLOR }}
              />
              <span className="text-muted-foreground">Entry: ₹{entry.toFixed(2)}</span>
            </div>
          )}
          {stopLoss !== undefined && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={{ backgroundColor: STOP_LOSS_COLOR }}
              />
              <span className="text-muted-foreground">Stop Loss: ₹{stopLoss.toFixed(2)}</span>
            </div>
          )}
          {target !== undefined && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={{ backgroundColor: TARGET_COLOR }}
              />
              <span className="text-muted-foreground">Target: ₹{target.toFixed(2)}</span>
            </div>
          )}
          {trendlines?.support && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 border-t-2 border-dashed"
                style={{ borderColor: SUPPORT_TL_COLOR }}
              />
              <span className="text-muted-foreground">Support TL</span>
            </div>
          )}
          {trendlines?.resistance && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 border-t-2 border-dashed"
                style={{ borderColor: RESISTANCE_TL_COLOR }}
              />
              <span className="text-muted-foreground">Resistance TL</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
