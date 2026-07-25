/**
 * OIChart Component
 *
 * Displays bar chart comparing Call OI vs Put OI across strikes:
 * - X-axis: Strike prices
 * - Y-axis: Open Interest
 * - Two bars per strike: Call OI (blue), Put OI (red)
 * - Mark ATM strike with vertical line
 * - Highlight support/resistance zones
 * - Add tooltip showing exact OI values on hover
 *
 * Requirements: 7.1, 13.3
 * Task: 70.3
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  HistogramData,
  Time,
  ColorType,
  CrosshairMode,
  LineStyle,
  HistogramSeriesPartialOptions,
} from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OptionsChainResponse } from '@/lib/api-client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface OIChartProps {
  /**
   * Options chain data containing strikes with Call/Put OI
   */
  optionsChain: OptionsChainResponse;
  /**
   * Chart height in pixels
   */
  height?: number;
  /**
   * Support zones (strikes with high put OI)
   */
  supportZones?: number[];
  /**
   * Resistance zones (strikes with high call OI)
   */
  resistanceZones?: number[];
}

interface OIDataPoint {
  strikePrice: number;
  callOI: number;
  putOI: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Finds the ATM (At-The-Money) strike closest to spot price
 */
function findATMStrike(spotPrice: number, strikes: number[]): number | null {
  if (strikes.length === 0) return null;
  return strikes.reduce((prev, curr) =>
    Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
  );
}

/**
 * Convert strike price to chart time (using strike as numeric identifier)
 */
function strikeToTime(strike: number): Time {
  return strike as Time;
}

// ============================================================================
// Component
// ============================================================================

export function OIChart({
  optionsChain,
  height = 400,
  supportZones = [],
  resistanceZones = [],
}: OIChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const callOISeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const putOISeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredStrike, setHoveredStrike] = useState<OIDataPoint | null>(null);

  const { strikes, spotPrice, underlying } = optionsChain;

  // Find ATM strike
  const atmStrike =
    strikes.length > 0
      ? findATMStrike(
          spotPrice,
          strikes.map((s) => s.strikePrice)
        )
      : null;

  // ==========================================================================
  // Chart Initialization
  // ==========================================================================

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart instance
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      grid: {
        vertLines: { color: '#e0e0e0' },
        horzLines: { color: '#e0e0e0' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#cccccc',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#cccccc',
        visible: true,
        timeVisible: false,
        secondsVisible: false,
      },
    });

    // Create Call OI series (blue bars)
    const callOISeries = chart.addHistogramSeries({
      color: '#2196F3',
      priceFormat: {
        type: 'volume',
      },
      title: 'Call OI',
    } as HistogramSeriesPartialOptions);

    // Create Put OI series (red bars)
    const putOISeries = chart.addHistogramSeries({
      color: '#EF5350',
      priceFormat: {
        type: 'volume',
      },
      title: 'Put OI',
    } as HistogramSeriesPartialOptions);

    chartRef.current = chart;
    callOISeriesRef.current = callOISeries;
    putOISeriesRef.current = putOISeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  // ==========================================================================
  // Data Loading
  // ==========================================================================

  useEffect(() => {
    if (!callOISeriesRef.current || !putOISeriesRef.current || !strikes || strikes.length === 0) {
      return;
    }

    setIsLoading(true);

    try {
      // Prepare OI data for both calls and puts
      // Note: We create separate histogram data for calls and puts
      // Since histogram series in lightweight-charts don't support side-by-side bars natively,
      // we'll display them as overlapping with transparency or use a workaround

      const callOIData: HistogramData[] = strikes.map((strike) => ({
        time: strikeToTime(strike.strikePrice),
        value: strike.call.oi,
        color: strike.strikePrice === atmStrike ? '#1976D2' : '#2196F3',
      }));

      const putOIData: HistogramData[] = strikes.map((strike) => ({
        time: strikeToTime(strike.strikePrice),
        value: -strike.put.oi, // Negative to show below axis
        color: strike.strikePrice === atmStrike ? '#D32F2F' : '#EF5350',
      }));

      callOISeriesRef.current.setData(callOIData);
      putOISeriesRef.current.setData(putOIData);

      // Fit content to visible range
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading OI chart data:', error);
      setIsLoading(false);
    }
  }, [strikes, atmStrike]);

  // ==========================================================================
  // ATM Strike Marker
  // ==========================================================================

  useEffect(() => {
    if (!chartRef.current || !atmStrike) return;

    const chart = chartRef.current;

    // Add vertical line at ATM strike
    const atmLineSeries = chart.addLineSeries({
      color: '#FF6F00',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      title: 'ATM',
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Create vertical line data (draw across entire Y-axis range)
    const maxOI = Math.max(...strikes.map((s) => Math.max(s.call.oi, s.put.oi)));

    atmLineSeries.setData([
      { time: strikeToTime(atmStrike), value: -maxOI * 1.2 },
      { time: strikeToTime(atmStrike), value: maxOI * 1.2 },
    ]);
  }, [atmStrike, strikes]);

  // ==========================================================================
  // Support/Resistance Zones
  // ==========================================================================

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;

    // Add support zones (high put OI) as horizontal lines
    supportZones.forEach((zone) => {
      const supportSeries = chart.addLineSeries({
        color: '#4CAF50',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: `Support ${zone}`,
        priceLineVisible: false,
      });

      const zoneData = strikes.map((s) => ({
        time: strikeToTime(s.strikePrice),
        value: zone,
      }));

      supportSeries.setData(zoneData);
    });

    // Add resistance zones (high call OI) as horizontal lines
    resistanceZones.forEach((zone) => {
      const resistanceSeries = chart.addLineSeries({
        color: '#F44336',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: `Resistance ${zone}`,
        priceLineVisible: false,
      });

      const zoneData = strikes.map((s) => ({
        time: strikeToTime(s.strikePrice),
        value: zone,
      }));

      resistanceSeries.setData(zoneData);
    });
  }, [supportZones, resistanceZones, strikes]);

  // ==========================================================================
  // Crosshair Move Handler (Tooltip)
  // ==========================================================================

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;

    const handleCrosshairMove = (param: any) => {
      if (!param.time) {
        setHoveredStrike(null);
        return;
      }

      const strikePrice = param.time as number;
      const strike = strikes.find((s) => s.strikePrice === strikePrice);

      if (strike) {
        setHoveredStrike({
          strikePrice: strike.strikePrice,
          callOI: strike.call.oi,
          putOI: strike.put.oi,
        });
      } else {
        setHoveredStrike(null);
      }
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [strikes]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{underlying} Open Interest Comparison</span>
          {isLoading && (
            <span className="text-sm font-normal text-muted-foreground">Loading...</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tooltip overlay */}
        {hoveredStrike && (
          <div className="mb-2 rounded-md border bg-white p-3 shadow-sm">
            <div className="text-sm font-semibold">
              Strike: {hoveredStrike.strikePrice.toFixed(2)}
              {hoveredStrike.strikePrice === atmStrike && (
                <span className="ml-2 text-xs text-orange-600">(ATM)</span>
              )}
            </div>
            <div className="mt-1 flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-blue-500" />
                <span>Call OI: {hoveredStrike.callOI.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-red-500" />
                <span>Put OI: {hoveredStrike.putOI.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Chart container */}
        <div
          ref={chartContainerRef}
          className="relative w-full"
          style={{ height: `${height}px` }}
        />

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-blue-500" />
            <span>Call OI</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-500" />
            <span>Put OI</span>
          </div>
          {atmStrike && (
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-6 bg-orange-600" />
              <span>ATM Strike: {atmStrike.toFixed(2)}</span>
            </div>
          )}
          {supportZones.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-6 border-t-2 border-dashed border-green-500" />
              <span>Support Zones</span>
            </div>
          )}
          {resistanceZones.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-6 border-t-2 border-dashed border-red-500" />
              <span>Resistance Zones</span>
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 rounded-md border bg-gray-50 p-3 text-sm">
          <div>
            <div className="text-xs text-gray-500">Spot Price</div>
            <div className="font-semibold">{spotPrice.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Total Call OI</div>
            <div className="font-semibold text-blue-600">
              {strikes.reduce((sum, s) => sum + s.call.oi, 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Total Put OI</div>
            <div className="font-semibold text-red-600">
              {strikes.reduce((sum, s) => sum + s.put.oi, 0).toLocaleString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
