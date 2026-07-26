import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';

/**
 * DTO for POST /swing/scan request
 * Requirements: 5.4
 */
export class ScanSwingUniverseDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @IsString()
  sectorFilter?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  maxResults?: number;

  @IsOptional()
  @IsString()
  userId?: string;
}

/**
 * Candidate result from scan
 */
export interface SwingCandidate {
  symbol: string;
  score: number;
  trend: string;
  setupType: string;
  entry: number;
  stopLoss: number;
  target: number;
  riskReward: number;
  components: {
    trendScore: number;
    technicalScore: number;
    volumeScore: number;
    relativeStrengthScore: number;
    breakoutScore: number;
    sectorScore: number;
    riskRewardScore: number;
  };
}

/**
 * Response from POST /swing/scan
 *
 * Requirements: 20.1 - Partial failure reporting
 */
export interface ScanSwingUniverseResponseDto {
  scannedCount: number;
  candidatesFound: number;
  candidates: SwingCandidate[];
  failures?: Array<{
    symbol: string;
    error: string;
  }>;
}
