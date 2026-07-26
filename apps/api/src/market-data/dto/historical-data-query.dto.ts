import { IsUUID, IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { Timeframe } from '@prisma/client';

/**
 * Query DTO for GET /api/market-data/history endpoint.
 * Validates incoming query parameters for historical data requests.
 *
 * Requirements: 6.1, 6.3
 */
export class HistoricalDataQueryDto {
  @IsUUID()
  instrumentId!: string;

  @IsEnum(Timeframe, {
    message: `timeframe must be one of: ${Object.values(Timeframe).join(', ')}`,
  })
  timeframe!: Timeframe;

  @IsISO8601({}, { message: 'from must be a valid ISO 8601 date string' })
  from!: string;

  @IsISO8601({}, { message: 'to must be a valid ISO 8601 date string' })
  @IsOptional()
  to?: string;
}
