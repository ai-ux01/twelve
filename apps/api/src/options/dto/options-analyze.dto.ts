import { IsString, IsOptional } from 'class-validator';

/**
 * Options Analysis Request DTO
 *
 * Request structure for analyzing options chain data.
 * Only NIFTY and BANKNIFTY symbols are supported.
 *
 * Requirements: 7.1, 18.2
 */
export class OptionsAnalysisRequestDto {
  @IsString()
  symbol!: string; // NIFTY or BANKNIFTY only

  @IsOptional()
  @IsString()
  expiry?: string; // Optional expiry date (YYYY-MM-DD format)
}

/**
 * Options Analysis Result DTO
 *
 * Complete options chain analysis including PCR, ATM, OI analysis, and support/resistance.
 *
 * Requirements: 7.1, 18.2
 */
export interface OptionsAnalysisResultDto {
  symbol: string;
  expiryDate: string;
  spotPrice: number;
  timestamp: Date;

  // PCR Analysis
  pcrAnalysis: {
    pcrByOI: number;
    pcrByVolume: number;
    sentiment: string; // BULLISH, BEARISH, NEUTRAL
    totalCallOI: number;
    totalPutOI: number;
    totalCallVolume: number;
    totalPutVolume: number;
  };

  // ATM Analysis
  atmAnalysis: {
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
  };

  // OI Analysis
  oiAnalysis: {
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
  };
}
