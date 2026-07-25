/**
 * ChartViewer Component
 *
 * Wraps TradingView Lightweight Charts library to display:
 * - Candlestick chart for selected symbol
 * - Technical indicators (SMA, EMA)
 * - Support/resistance levels
 * - Trendlines from quant analysis
 *
 * Requirements: 13.3
 * Task: 18.4
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OHLCVData, QuantAnalysisResult } from '@/lib/api-client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ChartViewerProps {
  symbol: string;
  data: OHLCVData[];
  quantAnalysis?: QuantAnalysisResult;
  height?: number;
  showVolume?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ChartViewer({
  symbol,
  data,
  quantAnalysis,
  height = 500,
  showVolume = true,
}: ChartViewerProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Create volume series if enabled
    let volumeSeries: ISeriesApi<'Histogram'> | null = null;
    if (showVolume) {
      volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
    }

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

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
  }, [height, showVolume]);

  // ==========================================================================
  // Data Loading
  // ==========================================================================

  useEffect(() => {
    if (!candlestickSeriesRef.current || !data || data.length === 0) {
      return;
    }

    setIsLoading(true);

    try {
      // Convert OHLCV data to candlestick format
      const candleData: CandlestickData[] = data.map((d) => ({
        time: (new Date(d.timestamp).getTime() / 1000) as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      candlestickSeriesRef.current.setData(candleData);

      // Set volume data if enabled
      if (volumeSeriesRef.current && showVolume) {
        const volumeData: LineData[] = data.map((d) => ({
          time: (new Date(d.timestamp).getTime() / 1000) as Time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
        }));
        volumeSeriesRef.current.setData(volumeData);
      }

      // Fit content to visible range
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading chart data:', error);
      setIsLoading(false);
    }
  }, [data, showVolume]);

  // ==========================================================================
  // Technical Indicators Overlay
  // ==========================================================================

  useEffect(() => {
    if (!chartRef.current || !quantAnalysis || !data || data.length === 0) {
      return;
    }

    const chart = chartRef.current;
    const indicators = quantAnalysis.indicators;

    // SMA 20
    if (indicators.sma_20) {
      const sma20Series = chart.addLineSeries({
        color: '#2196F3',
        lineWidth: 2,
        title: 'SMA 20',
      });

      const sma20Data: LineData[] = data.map((d) => ({
        time: (new Date(d.timestamp).getTime() / 1000) as Time,
        value: indicators.sma_20,
      }));

      sma20Series.setData(sma20Data);
    }

    // SMA 50
    if (indicators.sma_50) {
      const sma50Series = chart.addLineSeries({
        color: '#FF9800',
        lineWidth: 2,
        title: 'SMA 50',
      });

      const sma50Data: LineData[] = data.map((d) => ({
        time: (new Date(d.timestamp).getTime() / 1000) as Time,
        value: indicators.sma_50,
      }));

      sma50Series.setData(sma50Data);
    }

    // SMA 200
    if (indicators.sma_200) {
      const sma200Series = chart.addLineSeries({
        color: '#9C27B0',
        lineWidth: 2,
        title: 'SMA 200',
      });

      const sma200Data: LineData[] = data.map((d) => ({
        time: (new Date(d.timestamp).getTime() / 1000) as Time,
        value: indicators.sma_200,
      }));

      sma200Series.setData(sma200Data);
    }

    // EMA 5
    if (indicators.ema_5) {
      const ema5Series = chart.addLineSeries({
        color: '#E91E63',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: 'EMA 5',
      });

      const ema5Data: LineData[] = data.map((d) => ({
        time: (new Date(d.timestamp).getTime() / 1000) as Time,
        value: indicators.ema_5,
      }));

      ema5Series.setData(ema5Data);
    }

    // EMA 15
    if (indicators.ema_15) {
      const ema15Series = chart.addLineSeries({
        color: '#00BCD4',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: 'EMA 15',
      });

      const ema15Data: LineData[] = data.map((d) => ({
        time: (new Date(d.timestamp).getTime() / 1000) as Time,
        value: indicators.ema_15,
      }));

      ema15Series.setData(ema15Data);
    }

    // EMA 20
    if (indicators.ema_20) {
      const ema20Series = chart.addLineSeries({
        color: '#4CAF50',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: 'EMA 20',
      });

      const ema20Data: LineData[] = data.map((d) => ({
        time: (new Date(d.timestamp).getTime() / 1000) as Time,
        value: indicators.ema_20,
      }));

      ema20Series.setData(ema20Data);
    }

    // EMA 50
    if (indicators.ema_50) {
      const ema50Series = chart.addLineSeries({
        color: '#FFC107',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: 'EMA 50',
      });

      const ema50Data: LineData[] = data.map((d) => ({
        time: (new Date(d.timestamp).getTime() / 1000) as Time,
        value: indicators.ema_50,
      }));

      ema50Series.setData(ema50Data);
    }

    // EMA 200
    if (indicators.ema_200) {
      const ema200Series = chart.addLineSeries({
        color: '#795548',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: 'EMA 200',
      });

      const ema200Data: LineData[] = data.map((d) => ({
        time: (new Date(d.timestamp).getTime() / 1000) as Time,
        value: indicators.ema_200,
      }));

      ema200Series.setData(ema200Data);
    }
  }, [quantAnalysis, data]);

  // ==========================================================================
  // Support/Resistance Levels
  // ==========================================================================

  useEffect(() => {
    if (
      !chartRef.current ||
      !quantAnalysis?.supportResistance ||
      quantAnalysis.supportResistance.length === 0 ||
      !data ||
      data.length === 0
    ) {
      return;
    }

    const chart = chartRef.current;
    const levels = quantAnalysis.supportResistance;

    // Draw each support/resistance level as a horizontal line
    levels.forEach((level, index) => {
      const levelSeries = chart.addLineSeries({
        color: level.strength > 0.7 ? '#f44336' : '#ff9800',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: `S/R ${level.level.toFixed(2)}`,
        priceLineVisible: false,
      });

      // Create horizontal line data
      const levelData: LineData[] = data.map((d) => ({
        time: (new Date(d.timestamp).getTime() / 1000) as Time,
        value: level.level,
      }));

      levelSeries.setData(levelData);

      // Add price line marker
      levelSeries.createPriceLine({
        price: level.level,
        color: level.strength > 0.7 ? '#f44336' : '#ff9800',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `S/R (${level.strength.toFixed(2)})`,
      });
    });
  }, [quantAnalysis, data]);

  // ==========================================================================
  // Trendlines
  // ==========================================================================

  useEffect(() => {
    if (
      !chartRef.current ||
      !quantAnalysis?.trendlines ||
      quantAnalysis.trendlines.length === 0 ||
      !data ||
      data.length === 0
    ) {
      return;
    }

    const chart = chartRef.current;
    const trendlines = quantAnalysis.trendlines;

    // Draw each trendline
    trendlines.forEach((trendline) => {
      const trendSeries = chart.addLineSeries({
        color: trendline.rSquared > 0.8 ? '#4CAF50' : '#8BC34A',
        lineWidth: 2,
        title: `Trendline (R²=${trendline.rSquared.toFixed(2)})`,
      });

      // Calculate trendline values for each data point
      const trendData: LineData[] = data.map((d, index) => {
        const value = trendline.slope * index + trendline.intercept;
        return {
          time: (new Date(d.timestamp).getTime() / 1000) as Time,
          value: value,
        };
      });

      trendSeries.setData(trendData);
    });
  }, [quantAnalysis, data]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{symbol} Chart</span>
          {isLoading && (
            <span className="text-sm font-normal text-muted-foreground">Loading...</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={chartContainerRef}
          className="relative w-full"
          style={{ height: `${height}px` }}
        />

        {/* Legend for technical indicators */}
        {quantAnalysis && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {quantAnalysis.indicators.sma_20 && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-6 bg-blue-500" />
                <span>SMA 20: {quantAnalysis.indicators.sma_20.toFixed(2)}</span>
              </div>
            )}
            {quantAnalysis.indicators.sma_50 && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-6 bg-orange-500" />
                <span>SMA 50: {quantAnalysis.indicators.sma_50.toFixed(2)}</span>
              </div>
            )}
            {quantAnalysis.indicators.sma_200 && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-6 bg-purple-500" />
                <span>SMA 200: {quantAnalysis.indicators.sma_200.toFixed(2)}</span>
              </div>
            )}
            {quantAnalysis.indicators.ema_5 && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-6 border-t-2 border-dashed border-pink-500" />
                <span>EMA 5: {quantAnalysis.indicators.ema_5.toFixed(2)}</span>
              </div>
            )}
            {quantAnalysis.indicators.ema_15 && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-6 border-t-2 border-dashed border-cyan-500" />
                <span>EMA 15: {quantAnalysis.indicators.ema_15.toFixed(2)}</span>
              </div>
            )}
            {quantAnalysis.indicators.ema_20 && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-6 border-t-2 border-dashed border-green-500" />
                <span>EMA 20: {quantAnalysis.indicators.ema_20.toFixed(2)}</span>
              </div>
            )}
            {quantAnalysis.indicators.ema_50 && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-6 border-t-2 border-dashed border-amber-500" />
                <span>EMA 50: {quantAnalysis.indicators.ema_50.toFixed(2)}</span>
              </div>
            )}
            {quantAnalysis.indicators.ema_200 && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-6 border-t-2 border-dashed border-brown-700" />
                <span>EMA 200: {quantAnalysis.indicators.ema_200.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* Legend for support/resistance */}
        {quantAnalysis?.supportResistance && quantAnalysis.supportResistance.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Support/Resistance Levels</h4>
            <div className="flex flex-wrap gap-3 text-xs">
              {quantAnalysis.supportResistance.map((level, index) => (
                <div key={index} className="flex items-center gap-2 rounded-md border px-2 py-1">
                  <div
                    className={`h-0.5 w-4 border-t border-dashed ${
                      level.strength > 0.7 ? 'border-red-500' : 'border-orange-500'
                    }`}
                  />
                  <span>
                    {level.level.toFixed(2)} (str: {level.strength.toFixed(2)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend for trendlines */}
        {quantAnalysis?.trendlines && quantAnalysis.trendlines.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Trendlines</h4>
            <div className="flex flex-wrap gap-3 text-xs">
              {quantAnalysis.trendlines.map((trendline, index) => (
                <div key={index} className="flex items-center gap-2 rounded-md border px-2 py-1">
                  <div
                    className={`h-0.5 w-4 ${
                      trendline.rSquared > 0.8 ? 'bg-green-500' : 'bg-lime-500'
                    }`}
                  />
                  <span>
                    Slope: {trendline.slope.toFixed(4)}, R²: {trendline.rSquared.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
