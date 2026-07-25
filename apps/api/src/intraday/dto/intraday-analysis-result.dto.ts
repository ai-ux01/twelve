import { IntradayRecommendation } from './intraday-recommendation.dto';

/**
 * Data freshness information
 * Tracks when data was last updated and if it's stale
 *
 * Requirements: 6.2
 */
export interface DataFreshness {
  timestamp: string; // ISO 8601 format
  ageSeconds: number; // Age of data in seconds
  isStale: boolean; // True if data is older than acceptable threshold
}

/**
 * Technical analysis indicators for intraday trading
 * All indicators calculated from intraday timeframe data
 *
 * Requirements: 6.3
 */
export interface IntradayTechnicalAnalysis {
  rsi: number; // Relative Strength Index (0-100)
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  ema_9: number; // 9-period EMA
  ema_21: number; // 21-period EMA
  ema_50: number; // 50-period EMA
  vwap: number; // Volume Weighted Average Price
  atr: number; // Average True Range (volatility)
  volume: number; // Current volume
  relativeVolume: number; // Volume relative to average (1.0 = average)
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  supportLevels: number[]; // Key support price levels
  resistanceLevels: number[]; // Key resistance price levels
}

/**
 * Complete intraday analysis result
 * Contains all data needed for intraday trading decisions
 *
 * Requirements: 6.1, 6.2, 6.3
 */
export interface IntradayAnalysisResultDto {
  symbol: string;
  interval: string; // 1m, 5m, 15m, 30m, 1h
  timestamp: string; // ISO 8601 format - when analysis was performed
  dataFreshness: DataFreshness;
  technicalAnalysis: IntradayTechnicalAnalysis;
  currentPrice: number;
  priceChange: number; // Absolute price change
  priceChangePercent: number; // Percentage price change
  recommendation: IntradayRecommendation;
}
