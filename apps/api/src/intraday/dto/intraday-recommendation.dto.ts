import {
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsOptional,
  Min,
  Max,
  IsISO8601,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Intraday trading signal types
 * Requirements: 6.1, 6.7
 */
export enum IntradaySignal {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
  NO_TRADE = 'NO_TRADE',
}

/**
 * MACD indicator values
 * Requirements: 6.7
 */
export class MacdValues {
  @IsNumber()
  value!: number;

  @IsNumber()
  signal!: number;

  @IsNumber()
  histogram!: number;
}

/**
 * Opening range data for intraday trading
 * Requirements: 6.7
 */
export class OpeningRange {
  @IsNumber()
  @Min(0)
  high!: number;

  @IsNumber()
  @Min(0)
  low!: number;

  @IsNumber()
  @Min(0)
  open!: number;
}

/**
 * Complete intraday trading recommendation
 * Includes entry/exit levels, risk metrics, technical indicators, and rationale
 *
 * Requirements: 6.1, 6.2, 6.7
 */
export class IntradayRecommendation {
  // Basic identification fields
  @IsString()
  symbol!: string;

  @IsEnum(IntradaySignal)
  signal!: IntradaySignal;

  @IsNumber()
  @Min(0)
  @Max(100)
  confidence!: number; // 0 to 100 (percentage)

  @IsISO8601()
  timestamp!: string; // ISO 8601 format - when recommendation was generated

  // Entry/exit levels
  @IsNumber()
  @Min(0)
  entry!: number; // Suggested entry price

  @IsNumber()
  @Min(0)
  stopLoss!: number; // Suggested stop loss price

  @IsNumber()
  @Min(0)
  target!: number; // Suggested target price

  @IsNumber()
  @Min(0)
  riskReward!: number; // Risk/reward ratio (e.g., 2.0 means 2:1)

  // Technical indicators
  @IsNumber()
  @Min(0)
  currentPrice!: number; // Current market price

  @IsNumber()
  @Min(0)
  vwap!: number; // Volume Weighted Average Price

  @IsNumber()
  @Min(0)
  ema5!: number; // 5-period Exponential Moving Average

  @IsNumber()
  @Min(0)
  ema15!: number; // 15-period Exponential Moving Average

  @IsNumber()
  @Min(0)
  @Max(100)
  rsi!: number; // Relative Strength Index (0-100)

  @ValidateNested()
  @Type(() => MacdValues)
  macd!: MacdValues; // MACD indicator values

  // Price context
  @ValidateNested()
  @Type(() => OpeningRange)
  openingRange!: OpeningRange; // Opening range data

  @IsNumber()
  @Min(0)
  previousDayHigh!: number; // Previous trading day's high

  @IsNumber()
  @Min(0)
  previousDayLow!: number; // Previous trading day's low

  // Data quality and reasoning
  @IsBoolean()
  isStale!: boolean; // True if recommendation is based on stale data

  @IsISO8601()
  dataTimestamp!: string; // ISO 8601 format - when underlying data was collected

  @IsString()
  rationale!: string; // Human-readable explanation of the recommendation

  // Optional fields
  @IsOptional()
  @IsISO8601()
  validUntil?: string; // ISO 8601 format - when recommendation expires (optional)

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  warnings?: string[]; // Optional warnings about data quality or market conditions
}
