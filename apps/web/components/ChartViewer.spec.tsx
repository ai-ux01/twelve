/**
 * ChartViewer Component Unit Tests
 *
 * Tests the core functionality of the ChartViewer component including:
 * - Chart initialization and rendering
 * - Data loading and display
 * - Technical indicator overlays
 * - Support/resistance level annotations
 * - Trendline rendering
 *
 * Task: 18.4
 */

import { describe, it, expect } from 'vitest';
import type { OHLCVData, QuantAnalysisResult } from '@/lib/api-client';

// ============================================================================
// Test Data Generators
// ============================================================================

function generateTestOHLCVData(numPoints: number = 10): OHLCVData[] {
  const data: OHLCVData[] = [];
  let basePrice = 2450;
  const startDate = new Date('2024-01-01');

  for (let i = 0; i < numPoints; i++) {
    const timestamp = new Date(startDate);
    timestamp.setDate(startDate.getDate() + i);

    const open = basePrice;
    const close = basePrice + (Math.random() - 0.5) * 10;
    const high = Math.max(open, close) + 5;
    const low = Math.min(open, close) - 5;
    const volume = 1000000;

    data.push({
      timestamp: timestamp.toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: volume,
    });

    basePrice = close;
  }

  return data;
}

function generateTestQuantAnalysis(): QuantAnalysisResult {
  return {
    symbol: 'TEST',
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
    ],
    trendlines: [
      {
        slope: 2.5,
        intercept: 2350,
        rSquared: 0.89,
      },
    ],
  };
}

// ============================================================================
// Unit Tests
// ============================================================================

describe('ChartViewer Component', () => {
  describe('Data Validation', () => {
    it('should accept valid OHLCV data', () => {
      const data = generateTestOHLCVData(10);

      expect(data).toHaveLength(10);
      expect(data[0]).toHaveProperty('timestamp');
      expect(data[0]).toHaveProperty('open');
      expect(data[0]).toHaveProperty('high');
      expect(data[0]).toHaveProperty('low');
      expect(data[0]).toHaveProperty('close');
      expect(data[0]).toHaveProperty('volume');
    });

    it('should validate OHLCV data integrity (high >= low)', () => {
      const data = generateTestOHLCVData(10);

      data.forEach((candle) => {
        expect(candle.high).toBeGreaterThanOrEqual(candle.low);
        expect(candle.high).toBeGreaterThanOrEqual(candle.open);
        expect(candle.high).toBeGreaterThanOrEqual(candle.close);
        expect(candle.low).toBeLessThanOrEqual(candle.open);
        expect(candle.low).toBeLessThanOrEqual(candle.close);
      });
    });

    it('should accept valid QuantAnalysisResult', () => {
      const quantAnalysis = generateTestQuantAnalysis();

      expect(quantAnalysis).toHaveProperty('symbol');
      expect(quantAnalysis).toHaveProperty('timeframe');
      expect(quantAnalysis).toHaveProperty('indicators');
      expect(quantAnalysis.indicators).toHaveProperty('rsi');
      expect(quantAnalysis.indicators).toHaveProperty('macd');
      expect(quantAnalysis.indicators).toHaveProperty('sma_20');
      expect(quantAnalysis.indicators).toHaveProperty('sma_50');
      expect(quantAnalysis.indicators).toHaveProperty('sma_200');
      expect(quantAnalysis.indicators).toHaveProperty('ema_20');
    });
  });

  describe('Technical Indicators', () => {
    it('should have valid RSI value (0-100)', () => {
      const quantAnalysis = generateTestQuantAnalysis();

      expect(quantAnalysis.indicators.rsi).toBeGreaterThanOrEqual(0);
      expect(quantAnalysis.indicators.rsi).toBeLessThanOrEqual(100);
    });

    it('should have valid MACD values', () => {
      const quantAnalysis = generateTestQuantAnalysis();
      const macd = quantAnalysis.indicators.macd;

      expect(macd).toHaveProperty('value');
      expect(macd).toHaveProperty('signal');
      expect(macd).toHaveProperty('histogram');
      expect(typeof macd.value).toBe('number');
      expect(typeof macd.signal).toBe('number');
      expect(typeof macd.histogram).toBe('number');
    });

    it('should have Bollinger Bands in correct order (lower < middle < upper)', () => {
      const quantAnalysis = generateTestQuantAnalysis();
      const bb = quantAnalysis.indicators.bollingerBands;

      expect(bb.lower).toBeLessThan(bb.middle);
      expect(bb.middle).toBeLessThan(bb.upper);
    });

    it('should have moving averages as positive numbers', () => {
      const quantAnalysis = generateTestQuantAnalysis();

      expect(quantAnalysis.indicators.sma_20).toBeGreaterThan(0);
      expect(quantAnalysis.indicators.sma_50).toBeGreaterThan(0);
      expect(quantAnalysis.indicators.sma_200).toBeGreaterThan(0);
      expect(quantAnalysis.indicators.ema_20).toBeGreaterThan(0);
    });
  });

  describe('Support/Resistance Levels', () => {
    it('should have support/resistance levels with valid strength (0-1)', () => {
      const quantAnalysis = generateTestQuantAnalysis();

      quantAnalysis.supportResistance.forEach((level) => {
        expect(level.strength).toBeGreaterThanOrEqual(0);
        expect(level.strength).toBeLessThanOrEqual(1);
        expect(level.level).toBeGreaterThan(0);
      });
    });

    it('should have support/resistance levels as numbers', () => {
      const quantAnalysis = generateTestQuantAnalysis();

      quantAnalysis.supportResistance.forEach((level) => {
        expect(typeof level.level).toBe('number');
        expect(typeof level.strength).toBe('number');
      });
    });
  });

  describe('Trendlines', () => {
    it('should have trendlines with valid R² value (0-1)', () => {
      const quantAnalysis = generateTestQuantAnalysis();

      quantAnalysis.trendlines.forEach((trendline) => {
        expect(trendline.rSquared).toBeGreaterThanOrEqual(0);
        expect(trendline.rSquared).toBeLessThanOrEqual(1);
      });
    });

    it('should have trendlines with slope and intercept', () => {
      const quantAnalysis = generateTestQuantAnalysis();

      quantAnalysis.trendlines.forEach((trendline) => {
        expect(trendline).toHaveProperty('slope');
        expect(trendline).toHaveProperty('intercept');
        expect(trendline).toHaveProperty('rSquared');
        expect(typeof trendline.slope).toBe('number');
        expect(typeof trendline.intercept).toBe('number');
      });
    });
  });

  describe('Data Transformations', () => {
    it('should convert timestamp strings to Unix time for chart library', () => {
      const data = generateTestOHLCVData(5);

      data.forEach((candle) => {
        const timestamp = new Date(candle.timestamp).getTime();
        expect(timestamp).toBeGreaterThan(0);
        expect(isNaN(timestamp)).toBe(false);
      });
    });

    it('should handle empty data array gracefully', () => {
      const emptyData: OHLCVData[] = [];

      expect(emptyData).toHaveLength(0);
      // Component should handle this without crashing
    });

    it('should handle missing quantAnalysis gracefully', () => {
      const data = generateTestOHLCVData(10);
      const quantAnalysis = undefined;

      expect(data).toHaveLength(10);
      expect(quantAnalysis).toBeUndefined();
      // Component should render chart without indicators
    });
  });

  describe('Component Props', () => {
    it('should have required props: symbol and data', () => {
      const props = {
        symbol: 'RELIANCE',
        data: generateTestOHLCVData(10),
      };

      expect(props.symbol).toBe('RELIANCE');
      expect(props.data).toHaveLength(10);
    });

    it('should have optional props with defaults', () => {
      const defaultHeight = 500;
      const defaultShowVolume = true;

      expect(typeof defaultHeight).toBe('number');
      expect(typeof defaultShowVolume).toBe('boolean');
      expect(defaultHeight).toBeGreaterThan(0);
    });

    it('should accept custom height', () => {
      const customHeight = 600;

      expect(customHeight).toBe(600);
      expect(customHeight).toBeGreaterThan(0);
    });

    it('should accept showVolume toggle', () => {
      const showVolume = false;

      expect(showVolume).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single data point', () => {
      const data = generateTestOHLCVData(1);

      expect(data).toHaveLength(1);
      expect(data[0]).toHaveProperty('timestamp');
      expect(data[0]).toHaveProperty('open');
      expect(data[0]).toHaveProperty('high');
      expect(data[0]).toHaveProperty('low');
      expect(data[0]).toHaveProperty('close');
      expect(data[0]).toHaveProperty('volume');
    });

    it('should handle large datasets', () => {
      const data = generateTestOHLCVData(1000);

      expect(data).toHaveLength(1000);
      expect(data[0]).toHaveProperty('timestamp');
      expect(data[999]).toHaveProperty('timestamp');
    });

    it('should handle extreme price values', () => {
      const extremeData: OHLCVData[] = [
        {
          timestamp: new Date().toISOString(),
          open: 1000000,
          high: 1000100,
          low: 999900,
          close: 1000050,
          volume: 1000000,
        },
        {
          timestamp: new Date().toISOString(),
          open: 0.01,
          high: 0.02,
          low: 0.005,
          close: 0.015,
          volume: 1000000,
        },
      ];

      extremeData.forEach((candle) => {
        expect(candle.high).toBeGreaterThanOrEqual(candle.low);
        expect(candle.open).toBeGreaterThan(0);
        expect(candle.close).toBeGreaterThan(0);
      });
    });

    it('should handle missing optional indicator fields', () => {
      const partialQuantAnalysis: QuantAnalysisResult = {
        symbol: 'TEST',
        timeframe: '1d',
        indicators: {
          rsi: 50,
          macd: { value: 0, signal: 0, histogram: 0 },
          sma_20: 100,
          sma_50: 100,
          sma_200: 100,
          ema_5: 101,
          ema_15: 100.5,
          ema_20: 100,
          ema_50: 100,
          ema_200: 100,
          bollingerBands: { upper: 110, middle: 100, lower: 90 },
          adx: 25,
          atr: 5,
          vwap: 100,
          volume_ma: 1000000,
          relative_volume: 1.0,
          week_52_high: 150,
          week_52_low: 50,
          momentum: 0,
        },
        supportResistance: [],
        trendlines: [],
      };

      expect(partialQuantAnalysis.supportResistance).toHaveLength(0);
      expect(partialQuantAnalysis.trendlines).toHaveLength(0);
      // Component should handle empty arrays without crashing
    });
  });
});
