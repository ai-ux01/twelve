/**
 * Test Helper Functions and Mock Data
 * 
 * Provides reusable mock data for testing components
 */

import { IndicatorResult, QuantAnalysisResult } from './api-client';

/**
 * Generate a complete mock IndicatorResult with all required fields
 */
export function createMockIndicators(overrides?: Partial<IndicatorResult>): IndicatorResult {
  return {
    rsi: 65.4,
    macd: {
      value: 12.3,
      signal: 10.1,
      histogram: 2.2,
    },
    sma_20: 2455.0,
    sma_50: 2450.0,
    sma_200: 2380.0,
    ema_5: 2465.0,
    ema_15: 2460.0,
    ema_20: 2458.0,
    ema_50: 2450.0,
    ema_200: 2380.0,
    bollingerBands: {
      upper: 2500.0,
      middle: 2455.0,
      lower: 2410.0,
    },
    adx: 28.5,
    atr: 45.2,
    vwap: 2461.0,
    volume_ma: 1500000,
    relative_volume: 1.25,
    week_52_high: 2600.0,
    week_52_low: 2200.0,
    momentum: 3.5,
    ...overrides,
  };
}

/**
 * Generate a complete mock QuantAnalysisResult
 */
export function createMockQuantAnalysis(
  symbol: string = 'RELIANCE',
  overrides?: Partial<QuantAnalysisResult>
): QuantAnalysisResult {
  return {
    symbol,
    timeframe: '1d',
    indicators: createMockIndicators(),
    supportResistance: [
      { level: 2400, strength: 0.85 },
      { level: 2500, strength: 0.72 },
    ],
    trendlines: [
      {
        slope: 2.5,
        intercept: 2350,
        rSquared: 0.89,
      },
    ],
    ...overrides,
  };
}
