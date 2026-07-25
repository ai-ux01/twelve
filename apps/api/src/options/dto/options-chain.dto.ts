import { IsString, IsOptional } from 'class-validator';

/**
 * Options Chain Request DTO
 *
 * Request structure for fetching options chain data.
 * Only NIFTY and BANKNIFTY symbols are supported.
 *
 * Requirements: 7.1, 18.1
 */
export class OptionsChainRequestDto {
  @IsString()
  symbol!: string; // NIFTY or BANKNIFTY only

  @IsOptional()
  @IsString()
  expiry?: string; // Optional expiry date (YYYY-MM-DD format)
}

/**
 * Option Contract DTO
 *
 * Represents a single options contract with all relevant data.
 * Includes Greeks, IV, liquidity metrics, and OI data.
 *
 * Requirements: 7.1
 */
export interface OptionContractDto {
  symbol: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiryDate: string;
  ltp: number; // Last traded price
  bid: number;
  ask: number;
  openInterest: number;
  changeInOI: number;
  volume: number;
  impliedVolatility: number;

  // Greeks
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;

  // Liquidity metrics
  bidAskSpread?: number;
  bidAskSpreadPercent?: number;
  liquidityWarning?: {
    wideBidAskSpread: boolean;
    lowVolume: boolean;
    lowOI: boolean;
    deepOTM: boolean;
  };
}

/**
 * Liquidity Metrics DTO
 *
 * Aggregated liquidity metrics for the options chain.
 * Identifies illiquid contracts based on multiple criteria.
 *
 * Requirements: 7.1, 8.1
 */
export interface LiquidityMetricsDto {
  totalContracts: number;
  liquidContracts: number;
  illiquidContracts: number;
  averageVolume: number;
  averageOI: number;
  averageBidAskSpread: number;
  illiquidContractsList?: {
    strikePrice: number;
    optionType: 'CALL' | 'PUT';
    reason: string[];
  }[];
}

/**
 * PCR (Put-Call Ratio) Analysis DTO
 *
 * Calculates put-call ratio from OI and volume.
 * Used to gauge market sentiment.
 *
 * Requirements: 7.1
 */
export interface PCRAnalysisDto {
  pcrByOI: number; // Put OI / Call OI
  pcrByVolume: number; // Put Volume / Call Volume
  sentiment: string; // BULLISH, BEARISH, NEUTRAL
  totalCallOI: number;
  totalPutOI: number;
  totalCallVolume: number;
  totalPutVolume: number;
}

/**
 * ATM (At-The-Money) Analysis DTO
 *
 * Identifies ATM strike and near ATM strikes (±3 strikes).
 * Provides strike-level analysis for ATM region.
 *
 * Requirements: 7.1
 */
export interface ATMAnalysisDto {
  spotPrice: number;
  atmStrike: number;
  strikeInterval: number;
  nearATMStrikes: {
    strike: number;
    distanceFromSpot: number;
    callOI: number;
    putOI: number;
    callVolume: number;
    putVolume: number;
  }[];
}

/**
 * OI (Open Interest) Analysis DTO
 *
 * Analyzes OI buildup/unwinding patterns to identify market positioning.
 * Detects: long buildup, short buildup, long unwinding, short unwinding.
 *
 * Requirements: 7.1
 */
export interface OIAnalysisDto {
  buildupType: 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'SHORT_UNWINDING' | 'NEUTRAL';
  explanation: string;
  supportLevels: {
    strike: number;
    strength: number;
    reason: string;
  }[];
  resistanceLevels: {
    strike: number;
    strength: number;
    reason: string;
  }[];
  maxCallOIStrike: number;
  maxPutOIStrike: number;
  oiChangeAnalysis: {
    strike: number;
    callOIChange: number;
    putOIChange: number;
    interpretation: string;
  }[];
}

/**
 * Options Chain Data Response DTO
 *
 * Complete options chain data with analysis and metrics.
 * Includes all contracts, Greeks, liquidity warnings, and market analysis.
 *
 * Requirements: 7.1, 18.1
 */
export interface OptionsChainDataDto {
  symbol: string;
  expiryDate: string;
  spotPrice: number;
  timestamp: Date;
  contracts: OptionContractDto[];
  pcrAnalysis: PCRAnalysisDto;
  atmAnalysis: ATMAnalysisDto;
  oiAnalysis: OIAnalysisDto;
  liquidityMetrics: LiquidityMetricsDto;
}
