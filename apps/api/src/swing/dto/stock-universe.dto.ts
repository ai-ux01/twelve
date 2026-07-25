import { IsString, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

/**
 * DTO for adding a stock to the universe
 */
export class AddStockDto {
  @IsString()
  symbol!: string;

  @IsString()
  sector!: string;

  @IsNumber()
  @Min(0)
  marketCap!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * DTO for updating a stock in the universe
 */
export class UpdateStockDto {
  @IsString()
  @IsOptional()
  sector?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  marketCap?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * DTO for filtering stock universe
 */
export class FilterStockUniverseDto {
  @IsString()
  @IsOptional()
  sector?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
