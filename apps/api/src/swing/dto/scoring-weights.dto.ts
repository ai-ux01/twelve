import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

/**
 * DTO for creating or updating scoring weights
 * Requirements: 5.3
 */
export class ScoringWeightsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  trendWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  technicalWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  volumeWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  relativeStrengthWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  breakoutWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  sectorWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  riskRewardWeight?: number;

  @IsOptional()
  @IsString()
  userId?: string;
}

/**
 * Response DTO for scoring weights
 */
export class ScoringWeightsResponseDto {
  id!: string;
  userId!: string | null;
  trendWeight!: number;
  technicalWeight!: number;
  volumeWeight!: number;
  relativeStrengthWeight!: number;
  breakoutWeight!: number;
  sectorWeight!: number;
  riskRewardWeight!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
