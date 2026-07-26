import { IsOptional, IsEnum, IsNumber, Min, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PaperTradeFiltersDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @IsEnum(['OPEN', 'TARGET_HIT', 'STOP_HIT', 'MANUAL_EXIT', 'EXPIRED', 'CANCELLED'], {
    each: true,
  })
  status?: string[];

  @IsOptional()
  @IsEnum(['SWING', 'INTRADAY', 'OPTIONS_SCALPING'])
  tradeType?: 'SWING' | 'INTRADAY' | 'OPTIONS_SCALPING';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number = 20;
}
