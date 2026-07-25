import { QuantAnalysisResult } from './quant.service';
import * as fc from 'fast-check';
import { it } from '@fast-check/jest';

/**
 * Property-Based Tests for Quantitative Analysis Serialization
 *
 * **Validates: Requirements 3.8**
 *
 * Property 4: Quantitative Analysis Serialization Round-Trip
 *
 * For any valid QuantAnalysisResult object, serializing to JSON and
 * deserializing back SHALL produce an equivalent object with all
 * numerical values preserved within floating-point precision.
 *
 * This test ensures data integrity in communication with the Quant Engine.
 */
describe('QuantService - Property 4: Quantitative Analysis Serialization Round-Trip', () => {
  /**
   * Floating-point precision tolerance for comparison (IEEE 754 double precision)
   * Using a small epsilon to account for JSON serialization/deserialization precision loss
   */
  const EPSILON = 1e-10;

  /**
   * Helper function to compare floating-point numbers within epsilon tolerance
   */
  const almostEqual = (a: number, b: number, epsilon: number = EPSILON): boolean => {
    return Math.abs(a - b) <= epsilon;
  };

  /**
   * Helper function to compare objects with nested numerical values
   * Note: JSON.stringify removes undefined values, so we need to handle that case
   */
  const deepAlmostEqual = (a: any, b: any, epsilon: number = EPSILON): boolean => {
    // Both are undefined or null - consider equal
    if (a === undefined && b === undefined) return true;
    if (a === null && b === null) return true;

    // One is undefined/null and the other isn't - not equal
    if ((a === undefined || a === null) && b !== undefined && b !== null) return false;
    if ((b === undefined || b === null) && a !== undefined && a !== null) return false;

    if (typeof a === 'number' && typeof b === 'number') {
      return almostEqual(a, b, epsilon);
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, idx) => deepAlmostEqual(item, b[idx], epsilon));
    }

    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      // Get all keys from both objects
      const keysA = Object.keys(a).sort();
      const keysB = Object.keys(b).sort();

      // When comparing after JSON serialization, undefined fields are removed
      // So we filter out undefined values from the original object keys
      const filteredKeysA = keysA.filter((key) => a[key] !== undefined);
      const filteredKeysB = keysB.filter((key) => b[key] !== undefined);

      if (filteredKeysA.length !== filteredKeysB.length) return false;
      if (!filteredKeysA.every((key, idx) => key === filteredKeysB[idx])) return false;

      return filteredKeysA.every((key) => deepAlmostEqual(a[key], b[key], epsilon));
    }

    return a === b;
  };

  /**
   * Arbitrary generators for QuantAnalysisResult structure
   */

  // Generate valid financial numbers (positive, no NaN, no infinity)
  const financialNumberArb = fc.double({
    min: 0.01,
    max: 100000,
    noNaN: true,
    noDefaultInfinity: true,
  });

  // Generate numbers that can be positive or negative (for indicators like MACD)
  const signedNumberArb = fc.double({
    min: -10000,
    max: 10000,
    noNaN: true,
    noDefaultInfinity: true,
  });

  // Generate RSI (0-100)
  const rsiArb = fc.double({
    min: 0,
    max: 100,
    noNaN: true,
    noDefaultInfinity: true,
  });

  // Generate percentage values (0-1)
  const percentageArb = fc.double({
    min: 0,
    max: 1,
    noNaN: true,
    noDefaultInfinity: true,
  });

  // Generate MACD data
  const macdArb = fc.record({
    value: signedNumberArb,
    signal: signedNumberArb,
    histogram: signedNumberArb,
  });

  // Generate Bollinger Bands (ensuring upper > middle > lower)
  const bollingerBandsArb = fc
    .tuple(financialNumberArb, financialNumberArb, financialNumberArb)
    .map(([a, b, c]) => {
      const sorted = [a, b, c].sort((x, y) => x - y);
      return {
        lower: sorted[0],
        middle: sorted[1],
        upper: sorted[2],
      };
    });

  // Generate indicators
  const indicatorsArb = fc.record({
    rsi: rsiArb,
    macd: macdArb,
    sma_20: financialNumberArb,
    sma_50: financialNumberArb,
    sma_200: financialNumberArb,
    ema_20: financialNumberArb,
    bollingerBands: bollingerBandsArb,
  });

  // Generate support/resistance levels
  const supportResistanceLevelArb = fc.record({
    level: financialNumberArb,
    strength: percentageArb,
  });

  const supportResistanceArb = fc.array(supportResistanceLevelArb, {
    minLength: 0,
    maxLength: 10,
  });

  // Generate trendlines (with R² between 0 and 1)
  const trendlineArb = fc.record({
    slope: signedNumberArb,
    intercept: financialNumberArb,
    rSquared: percentageArb,
  });

  const trendlinesArb = fc.array(trendlineArb, {
    minLength: 0,
    maxLength: 5,
  });

  // Generate optional options Greeks
  const optionsGreeksArb = fc.option(
    fc.record({
      delta: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
      gamma: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
      theta: fc.double({ min: -100, max: 0, noNaN: true, noDefaultInfinity: true }),
      vega: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    }),
    { nil: undefined }
  );

  // Generate complete QuantAnalysisResult
  const quantAnalysisResultArb: fc.Arbitrary<QuantAnalysisResult> = fc.record({
    symbol: fc.string({ minLength: 1, maxLength: 20 }),
    timeframe: fc.constantFrom('1m', '5m', '15m', '1h', '4h', '1d', '1w'),
    indicators: indicatorsArb,
    supportResistance: supportResistanceArb,
    trendlines: trendlinesArb,
    optionsGreeks: optionsGreeksArb,
  });

  /**
   * Main property test: Serialization round-trip preserves data
   *
   * For any valid QuantAnalysisResult:
   * 1. Serialize to JSON string
   * 2. Deserialize back to object
   * 3. All values should match within floating-point precision
   */
  it.prop([quantAnalysisResultArb])(
    'should preserve all values in serialize-deserialize round-trip',
    (original: QuantAnalysisResult) => {
      // Serialize to JSON
      const serialized: string = JSON.stringify(original);

      // Deserialize back
      const deserialized: QuantAnalysisResult = JSON.parse(serialized);

      // Verify structure is preserved
      expect(deserialized.symbol).toBe(original.symbol);
      expect(deserialized.timeframe).toBe(original.timeframe);

      // Verify all numerical values are preserved within floating-point precision
      expect(deepAlmostEqual(deserialized, original)).toBe(true);
    }
  );

  /**
   * Property test: Multiple round-trips are idempotent
   *
   * Serializing and deserializing multiple times should produce
   * the same result (no progressive precision loss)
   */
  it.prop([quantAnalysisResultArb, fc.integer({ min: 1, max: 5 })])(
    'should be idempotent across multiple serialization round-trips',
    (original: QuantAnalysisResult, roundTrips: number) => {
      let current = original;

      // Perform multiple serialization round-trips
      for (let i = 0; i < roundTrips; i++) {
        const serialized = JSON.stringify(current);
        current = JSON.parse(serialized);
      }

      // After multiple round-trips, values should still match original
      expect(deepAlmostEqual(current, original)).toBe(true);
    }
  );

  /**
   * Property test: Optional fields remain optional
   *
   * The optionsGreeks field is optional and should remain undefined
   * if not present in the original object
   */
  it.prop([quantAnalysisResultArb])(
    'should preserve optional field presence/absence',
    (original: QuantAnalysisResult) => {
      const serialized = JSON.stringify(original);
      const deserialized: QuantAnalysisResult = JSON.parse(serialized);

      // If optionsGreeks was undefined, it should remain undefined
      if (original.optionsGreeks === undefined) {
        expect(deserialized.optionsGreeks).toBeUndefined();
      } else {
        expect(deserialized.optionsGreeks).toBeDefined();
        expect(deepAlmostEqual(deserialized.optionsGreeks, original.optionsGreeks)).toBe(true);
      }
    }
  );

  /**
   * Property test: Arrays maintain order and length
   *
   * Support/resistance levels and trendlines should maintain
   * their order and length through serialization
   */
  it.prop([quantAnalysisResultArb])(
    'should preserve array length and order',
    (original: QuantAnalysisResult) => {
      const serialized = JSON.stringify(original);
      const deserialized: QuantAnalysisResult = JSON.parse(serialized);

      // Support/resistance array
      expect(deserialized.supportResistance.length).toBe(original.supportResistance.length);

      // Trendlines array
      expect(deserialized.trendlines.length).toBe(original.trendlines.length);

      // Verify order is preserved by comparing each element
      original.supportResistance.forEach((sr, idx) => {
        expect(deepAlmostEqual(deserialized.supportResistance[idx], sr)).toBe(true);
      });

      original.trendlines.forEach((tl, idx) => {
        expect(deepAlmostEqual(deserialized.trendlines[idx], tl)).toBe(true);
      });
    }
  );

  /**
   * Property test: Nested object structure is preserved
   *
   * Nested objects like indicators.macd and indicators.bollingerBands
   * should maintain their structure through serialization
   */
  it.prop([quantAnalysisResultArb])(
    'should preserve nested object structure',
    (original: QuantAnalysisResult) => {
      const serialized = JSON.stringify(original);
      const deserialized: QuantAnalysisResult = JSON.parse(serialized);

      // Verify MACD nested structure
      expect(deserialized.indicators.macd).toHaveProperty('value');
      expect(deserialized.indicators.macd).toHaveProperty('signal');
      expect(deserialized.indicators.macd).toHaveProperty('histogram');

      // Verify Bollinger Bands nested structure
      expect(deserialized.indicators.bollingerBands).toHaveProperty('upper');
      expect(deserialized.indicators.bollingerBands).toHaveProperty('middle');
      expect(deserialized.indicators.bollingerBands).toHaveProperty('lower');

      // Verify values are preserved
      expect(deepAlmostEqual(deserialized.indicators.macd, original.indicators.macd)).toBe(true);
      expect(
        deepAlmostEqual(deserialized.indicators.bollingerBands, original.indicators.bollingerBands)
      ).toBe(true);
    }
  );

  /**
   * Edge case test: Empty arrays
   *
   * Empty support/resistance and trendlines arrays should remain empty
   */
  it('should handle empty arrays correctly', () => {
    const original: QuantAnalysisResult = {
      symbol: 'TEST',
      timeframe: '1d',
      indicators: {
        rsi: 50,
        macd: { value: 0, signal: 0, histogram: 0 },
        sma_20: 100,
        sma_50: 100,
        sma_200: 100,
        ema_20: 100,
        bollingerBands: { upper: 110, middle: 100, lower: 90 },
      },
      supportResistance: [],
      trendlines: [],
    };

    const serialized = JSON.stringify(original);
    const deserialized: QuantAnalysisResult = JSON.parse(serialized);

    expect(deserialized.supportResistance).toEqual([]);
    expect(deserialized.trendlines).toEqual([]);
    expect(deepAlmostEqual(deserialized, original)).toBe(true);
  });

  /**
   * Edge case test: Extreme values
   *
   * Very large and very small numbers should be preserved correctly
   */
  it('should handle extreme numerical values', () => {
    const original: QuantAnalysisResult = {
      symbol: 'EXTREME',
      timeframe: '1m',
      indicators: {
        rsi: 0.0001,
        macd: { value: 99999.99, signal: -99999.99, histogram: 0.000001 },
        sma_20: 0.01,
        sma_50: 50000,
        sma_200: 99999,
        ema_20: 0.01,
        bollingerBands: { upper: 100000, middle: 50000, lower: 0.01 },
      },
      supportResistance: [
        { level: 0.01, strength: 0.001 },
        { level: 99999.99, strength: 0.999 },
      ],
      trendlines: [
        { slope: -9999.99, intercept: 99999.99, rSquared: 0.000001 },
        { slope: 9999.99, intercept: 0.01, rSquared: 0.999999 },
      ],
    };

    const serialized = JSON.stringify(original);
    const deserialized: QuantAnalysisResult = JSON.parse(serialized);

    expect(deepAlmostEqual(deserialized, original)).toBe(true);
  });

  /**
   * Edge case test: Options Greeks edge values
   *
   * Options Greeks have specific ranges and should be preserved
   */
  it('should handle options Greeks edge values', () => {
    const original: QuantAnalysisResult = {
      symbol: 'NIFTY',
      timeframe: '1d',
      indicators: {
        rsi: 50,
        macd: { value: 0, signal: 0, histogram: 0 },
        sma_20: 100,
        sma_50: 100,
        sma_200: 100,
        ema_20: 100,
        bollingerBands: { upper: 110, middle: 100, lower: 90 },
      },
      supportResistance: [],
      trendlines: [],
      optionsGreeks: {
        delta: -1, // Min value for puts
        gamma: 0, // Min value
        theta: -100, // Large negative theta
        vega: 100, // Large vega
      },
    };

    const serialized = JSON.stringify(original);
    const deserialized: QuantAnalysisResult = JSON.parse(serialized);

    expect(deserialized.optionsGreeks).toBeDefined();
    expect(deepAlmostEqual(deserialized.optionsGreeks, original.optionsGreeks)).toBe(true);
  });
});
