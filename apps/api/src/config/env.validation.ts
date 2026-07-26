import { IsString, IsNumber, IsEnum, IsUrl, IsOptional, IsBoolean, Min } from 'class-validator';
import { plainToClass, Type } from 'class-transformer';
import { validateSync } from 'class-validator';

enum AIProvider {
  OPENAI = 'openai',
  OLLAMA = 'ollama',
}

/**
 * Environment variables validation schema using class-validator.
 * This ensures type safety and validation for all environment variables.
 */
export class EnvironmentVariables {
  // Database
  @IsString()
  DATABASE_URL!: string;

  // Kite Connect API
  @IsOptional()
  @IsString()
  KITE_API_KEY?: string;

  @IsOptional()
  @IsString()
  KITE_API_SECRET?: string;

  // Kotak Neo API
  @IsOptional()
  @IsString()
  KOTAK_API_KEY?: string;

  @IsOptional()
  @IsString()
  KOTAK_API_SECRET?: string;

  // AI Provider Configuration
  @IsEnum(AIProvider)
  AI_PROVIDER: AIProvider = AIProvider.OPENAI;

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  OLLAMA_BASE_URL?: string;

  @IsOptional()
  @IsString()
  AI_MODEL?: string;

  // Service URLs
  @IsOptional()
  @IsUrl({ require_tld: false })
  BACKEND_API_URL?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  QUANT_ENGINE_URL?: string;

  // JWT Secret
  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  // Risk Parameters
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  DEFAULT_MAX_POSITION_SIZE?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  DEFAULT_MAX_DRAWDOWN?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  DEFAULT_MAX_PORTFOLIO_EXPOSURE?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  DEFAULT_STOP_LOSS?: number;

  // Server Configuration
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  PORT?: number;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  // Historical Market Data Configuration
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  MARKET_DATA_RETENTION_YEARS?: number;

  @IsOptional()
  @IsString()
  STORE_TICKS?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  TICK_BATCH_SIZE?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  TICK_BATCH_INTERVAL_MS?: number;

  @IsOptional()
  @IsString()
  SYNC_ON_STARTUP?: string;

  @IsOptional()
  @IsString()
  RETENTION_CRON?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  BROKER_RATE_LIMIT_RPS?: number;
}

/**
 * Validates environment variables against the EnvironmentVariables schema.
 * Throws an error if validation fails.
 */
export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment variable validation failed:\n${errors
        .map((error) => Object.values(error.constraints || {}).join(', '))
        .join('\n')}`
    );
  }

  return validatedConfig;
}
