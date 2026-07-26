/**
 * Property-Based Tests for computeTrendlinePoints utility
 *
 * Uses fast-check with vitest to validate correctness properties
 * of the trendline computation function.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeTrendlinePoints } from './chart-utils';
import type { OHLCVData, TrendlineLine } from '@/lib/api-client';

/**
 * Arbitrary generator for a single OHLCV candle with a valid ISO timestamp.
 * Uses integer-based date generation to avoid Invalid Date issues.
 */
const ohlcvArbitrary: fc.Arbitrary<OHLCVData> = fc
  .integer({ min: 1577836800000, max: 1893456000000 }) // 2020-01-01 to 2030-01-01 in ms
  .map((ms) => new Date(ms).toISOString())
  .chain((timestamp) =>
    fc.record({
      timestamp: fc.constant(timestamp),
      open: fc.double({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }),
      high: fc.double({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }),
      low: fc.double({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }),
      close: fc.double({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }),
      volume: fc.integer({ min: 0, max: 10000000 }),
    })
  );

/**
 * Arbitrary generator for a non-empty OHLCV array (1 to 200 candles).
 */
const nonEmptyOhlcvArbitrary = fc.array(ohlcvArbitrary, { minLength: 1, maxLength: 200 });

// ============================================================================
// Property 1: Linear Price Computation
// ============================================================================

describe('Feature: trendline-visualization, Property 1: Linear Price Computation', () => {
  /**
   * **Validates: Requirements 4.4, 5.4, 6.2, 6.3**
   *
   * For any trendline with slope `s` and intercept `b`, and for any valid index `i`
   * within an OHLCV array, the computed price at that index SHALL equal `s × i + b`,
   * and the associated timestamp SHALL correspond to `ohlcvData[i].timestamp`.
   */
  it('output prices match slope × clampedIndex + intercept for both start and end points', () => {
    fc.assert(
      fc.property(
        nonEmptyOhlcvArbitrary,
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -100000, max: 100000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: -50, max: 250 }),
        fc.integer({ min: -50, max: 250 }),
        (ohlcvData, slope, intercept, rSquared, startPoint, endPoint) => {
          const trendline: TrendlineLine = {
            slope,
            intercept,
            r_squared: rSquared,
            start_point: startPoint,
            end_point: endPoint,
          };

          const result = computeTrendlinePoints(trendline, ohlcvData);

          // Should always produce exactly 2 points for valid trendline + non-empty data
          expect(result).toHaveLength(2);

          const maxIndex = ohlcvData.length - 1;
          const clampedStart = Math.max(0, Math.min(startPoint, maxIndex));
          const clampedEnd = Math.max(0, Math.min(endPoint, maxIndex));

          // Verify start point price matches the linear formula: slope × index + intercept
          const expectedStartPrice = slope * clampedStart + intercept;
          expect(result[0].value).toBeCloseTo(expectedStartPrice, 10);

          // Verify end point price matches the linear formula: slope × index + intercept
          const expectedEndPrice = slope * clampedEnd + intercept;
          expect(result[1].value).toBeCloseTo(expectedEndPrice, 10);

          // Verify timestamps correspond to ohlcvData entries at clamped indices
          const expectedStartTime = new Date(ohlcvData[clampedStart].timestamp).getTime() / 1000;
          const expectedEndTime = new Date(ohlcvData[clampedEnd].timestamp).getTime() / 1000;
          expect(result[0].time).toBe(expectedStartTime);
          expect(result[1].time).toBe(expectedEndTime);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 3: Index Clamping
// ============================================================================

describe('Feature: trendline-visualization, Property 3: Index Clamping', () => {
  /**
   * **Validates: Requirements 6.4**
   *
   * For any trendline where start_point or end_point exceeds the OHLCV array bounds
   * (negative or >= length), the computeTrendlinePoints function SHALL clamp the index
   * to the valid range [0, length-1] and still produce a correct price using the clamped
   * index in the formula slope × clamped_index + intercept.
   */
  it('should clamp out-of-bounds indices and compute correct prices', () => {
    fc.assert(
      fc.property(
        nonEmptyOhlcvArbitrary,
        fc.float({ min: -1000, max: 1000, noNaN: true }),
        fc.float({ min: -100000, max: 100000, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.oneof(
          // Negative start_point
          fc.integer({ min: -1000, max: -1 }),
          // start_point >= array length (will be generated relative to array length below)
          fc.integer({ min: 200, max: 1000 })
        ),
        fc.oneof(
          // Negative end_point
          fc.integer({ min: -1000, max: -1 }),
          // end_point >= array length
          fc.integer({ min: 200, max: 1000 })
        ),
        (ohlcvData, slope, intercept, rSquared, startPoint, endPoint) => {
          const trendline: TrendlineLine = {
            slope,
            intercept,
            r_squared: rSquared,
            start_point: startPoint,
            end_point: endPoint,
          };

          // Function should NOT throw
          const result = computeTrendlinePoints(trendline, ohlcvData);

          // Should return exactly 2 points
          expect(result).toHaveLength(2);

          // Compute expected clamped indices
          const len = ohlcvData.length;
          const clampedStart = Math.max(0, Math.min(startPoint, len - 1));
          const clampedEnd = Math.max(0, Math.min(endPoint, len - 1));

          // Verify prices match slope × clampedIndex + intercept
          const expectedStartPrice = slope * clampedStart + intercept;
          const expectedEndPrice = slope * clampedEnd + intercept;

          expect(result[0].value).toBeCloseTo(expectedStartPrice, 5);
          expect(result[1].value).toBeCloseTo(expectedEndPrice, 5);

          // Verify timestamps correspond to clamped indices
          const expectedStartTime = new Date(ohlcvData[clampedStart].timestamp).getTime() / 1000;
          const expectedEndTime = new Date(ohlcvData[clampedEnd].timestamp).getTime() / 1000;

          expect(result[0].time).toBe(expectedStartTime);
          expect(result[1].time).toBe(expectedEndTime);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clamp start_point < 0 to index 0', () => {
    fc.assert(
      fc.property(
        nonEmptyOhlcvArbitrary,
        fc.float({ min: -1000, max: 1000, noNaN: true }),
        fc.float({ min: -100000, max: 100000, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: -1000, max: -1 }),
        fc.integer({ min: 0, max: 199 }),
        (ohlcvData, slope, intercept, rSquared, startPoint, endPoint) => {
          const validEndPoint = Math.min(endPoint, ohlcvData.length - 1);
          const trendline: TrendlineLine = {
            slope,
            intercept,
            r_squared: rSquared,
            start_point: startPoint,
            end_point: validEndPoint,
          };

          const result = computeTrendlinePoints(trendline, ohlcvData);

          expect(result).toHaveLength(2);

          // Start should be clamped to 0
          const expectedStartPrice = slope * 0 + intercept;
          expect(result[0].value).toBeCloseTo(expectedStartPrice, 5);

          const expectedStartTime = new Date(ohlcvData[0].timestamp).getTime() / 1000;
          expect(result[0].time).toBe(expectedStartTime);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clamp end_point >= array length to last index', () => {
    fc.assert(
      fc.property(
        nonEmptyOhlcvArbitrary,
        fc.float({ min: -1000, max: 1000, noNaN: true }),
        fc.float({ min: -100000, max: 100000, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: 0, max: 199 }),
        fc.integer({ min: 200, max: 1000 }),
        (ohlcvData, slope, intercept, rSquared, startPoint, endPoint) => {
          const validStartPoint = Math.min(startPoint, ohlcvData.length - 1);
          const trendline: TrendlineLine = {
            slope,
            intercept,
            r_squared: rSquared,
            start_point: validStartPoint,
            end_point: endPoint,
          };

          const result = computeTrendlinePoints(trendline, ohlcvData);

          expect(result).toHaveLength(2);

          // End should be clamped to last index
          const lastIndex = ohlcvData.length - 1;
          const expectedEndPrice = slope * lastIndex + intercept;
          expect(result[1].value).toBeCloseTo(expectedEndPrice, 5);

          const expectedEndTime = new Date(ohlcvData[lastIndex].timestamp).getTime() / 1000;
          expect(result[1].time).toBe(expectedEndTime);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 4: Null Trendline Returns Empty
// ============================================================================

/**
 * Arbitrary generator for OHLCV arrays that can be empty or non-empty.
 */
const ohlcvArrayArbitrary = fc.array(ohlcvArbitrary, { minLength: 0, maxLength: 50 });

describe('Feature: trendline-visualization, Property 4: Null Trendline Returns Empty', () => {
  /**
   * **Validates: Requirements 6.5**
   *
   * For any null or undefined trendline input, regardless of the OHLCV array content,
   * the computeTrendlinePoints function SHALL return an empty array.
   */
  it('should return an empty array when trendline is null, for any OHLCV data', () => {
    fc.assert(
      fc.property(ohlcvArrayArbitrary, (ohlcvData) => {
        const result = computeTrendlinePoints(null, ohlcvData);
        expect(result).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it('should return an empty array when trendline is undefined, for any OHLCV data', () => {
    fc.assert(
      fc.property(ohlcvArrayArbitrary, (ohlcvData) => {
        const result = computeTrendlinePoints(undefined, ohlcvData);
        expect(result).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });
});
