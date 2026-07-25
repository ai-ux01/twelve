/**
 * ChartViewer Component Test/Example
 *
 * Demonstrates usage of the ChartViewer component with sample data
 */

'use client';

import React from 'react';
import { ChartViewer } from './ChartViewer';
import type { OHLCVData, QuantAnalysisResult } from '@/lib/api-client';

// Sample OHLCV data for testing
const generateSampleData = (numPoints: number = 100): OHLCVData[] => {
  const data: OHLCVData[] = [];
  let basePrice = 2450;
  const startDate = new Date('2024-01-01');

  for (let i = 0; i < numPoints; i++) {
    const timestamp = new Date(startDate);
    timestamp.setDate(startDate.getDate() + i);

    // Generate realistic OHLCV data with some randomness
    const change = (Math.random() - 0.5) * 50;
    basePrice = Math.max(basePrice + change, 2300);

    const open = basePrice;
    const close = basePrice + (Math.random() - 0.5) * 30;
    const high = Math.max(open, close) + Math.random() * 20;
    const low = Math.min(open, close) - Math.random() * 20;
    const volume = Math.floor(Math.random() * 1000000) + 500000;

    data.push({
      timestamp: timestamp.toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: volume,
    });
  }

  return data;
};

// Sample quantitative analysis data
const sampleQuantAnalysis: QuantAnalysisResult = {
  symbol: 'RELIANCE',
  timeframe: '1d',
  indicators: {
    rsi: 45.2,
    macd: {
      value: 12.3,
      signal: 10.1,
      histogram: 2.2,
    },
    sma_20: 2455.0,
    sma_50: 2450.0,
    sma_200: 2380.0,
    ema_5: 2462.0,
    ema_15: 2460.0,
    ema_20: 2458.0,
    ema_50: 2452.0,
    ema_200: 2385.0,
    bollingerBands: {
      upper: 2500.0,
      middle: 2455.0,
      lower: 2410.0,
    },
    adx: 25.0,
    atr: 45.0,
    vwap: 2456.0,
    volume_ma: 1000000,
    relative_volume: 1.2,
    week_52_high: 2800.0,
    week_52_low: 2100.0,
    momentum: 15.5,
  },
  supportResistance: [
    { level: 2400, strength: 0.85 },
    { level: 2500, strength: 0.72 },
    { level: 2350, strength: 0.65 },
  ],
  trendlines: [
    {
      slope: 2.5,
      intercept: 2350,
      rSquared: 0.89,
    },
    {
      slope: -1.2,
      intercept: 2550,
      rSquared: 0.75,
    },
  ],
};

// Test component
export function ChartViewerTest() {
  const sampleData = generateSampleData(100);

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">ChartViewer Component Test</h1>
        <p className="text-muted-foreground">
          Testing the TradingView Lightweight Charts integration with technical indicators,
          support/resistance levels, and trendlines.
        </p>
      </div>

      {/* Chart with full quant analysis */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Chart with Technical Indicators & Analysis</h2>
        <ChartViewer
          symbol="RELIANCE"
          data={sampleData}
          quantAnalysis={sampleQuantAnalysis}
          height={600}
          showVolume={true}
        />
      </div>

      {/* Chart without quant analysis */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Basic Chart (No Indicators)</h2>
        <ChartViewer symbol="TATASTEEL" data={sampleData} height={400} showVolume={false} />
      </div>
    </div>
  );
}
