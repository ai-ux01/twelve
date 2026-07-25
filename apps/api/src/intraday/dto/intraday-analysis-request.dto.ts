import { IsString, IsIn, IsOptional, Matches } from 'class-validator';

/**
 * DTO for intraday analysis request
 * Used for POST /intraday/analyze/:symbol
 *
 * Requirements: 6.1, 6.2
 */
export class IntradayAnalysisRequestDto {
  @IsString()
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Symbol must contain only uppercase letters and numbers',
  })
  symbol!: string;

  @IsString()
  @IsIn(['1m', '5m', '15m', '30m', '1h'], {
    message: 'Interval must be one of: 1m, 5m, 15m, 30m, 1h',
  })
  interval!: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
