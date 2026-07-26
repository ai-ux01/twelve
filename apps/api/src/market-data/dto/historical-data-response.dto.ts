import { Timeframe } from '@prisma/client';

/**
 * Represents a single candle in the API response.
 * Volume is serialized as string since BigInt is not natively JSON-serializable.
 */
export interface CandleResponseDto {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
}

/**
 * Response DTO for GET /api/market-data/history endpoint.
 *
 * Requirements: 6.5
 */
export interface HistoricalDataResponseDto {
  instrumentId: string;
  timeframe: Timeframe;
  from: string;
  to: string;
  count: number;
  candles: CandleResponseDto[];
}
