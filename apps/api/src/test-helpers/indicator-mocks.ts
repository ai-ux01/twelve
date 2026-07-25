import { QuantAnalysisResult } from '../quant/quant.service';

/**
 * Helper function to create complete indicator structure for testing
 *
 * This helper ensures all test mocks include all required indicator fields,
 * preventing TypeScript errors when the QuantAnalysisResult interface is extended.
 *
 * @param basePrice - The base price around which all indicators will be calculated
 * @returns Complete indicator object with all required fields
 */
export function createCompleteIndicators(
  basePrice: number = 2450
): QuantAnalysisResult['indicators'] {
  return {
    rsi: 65.5,
    macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
    sma_20: basePrice,
    sma_50: basePrice - 30,
    sma_200: basePrice - 70,
    ema_5: basePrice + 5,
    ema_15: basePrice + 3,
    ema_20: basePrice + 5,
    ema_50: basePrice - 28,
    ema_200: basePrice - 68,
    bollingerBands: {
      upper: basePrice + 50,
      middle: basePrice,
      lower: basePrice - 50,
    },
    adx: 25.0,
    atr: 15.0,
    vwap: basePrice + 10,
    volume_ma: 1000000,
    relative_volume: 1.2,
    week_52_high: basePrice + 150,
    week_52_low: basePrice - 250,
    momentum: 5.0,
  };
}
