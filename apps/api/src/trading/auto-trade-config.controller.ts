import {
  Controller,
  Get,
  Put,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsInt,
} from 'class-validator';

/**
 * DTO for updating auto-trade configuration.
 * All fields are optional - only provided fields are updated.
 */
export class UpdateAutoTradeConfigDto {
  @IsOptional()
  @IsBoolean()
  options_scalper_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  swing_scanner_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  intraday_scorer_enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(95)
  options_scalper_threshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  swing_scanner_threshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  intraday_scorer_threshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  default_swing_quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  default_intraday_quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  duplicate_window_minutes?: number;
}

/**
 * AutoTradeConfigController - REST API for Auto-Trade Configuration
 *
 * Proxies GET and PUT requests to the quant engine's /api/auto-trade-config endpoint.
 * The quant engine (port 8000) is the source of truth for auto-trade config,
 * stored in a JsonFileStore.
 *
 * Requirements: 5.3
 */
@Controller('auto-trade-config')
export class AutoTradeConfigController {
  private readonly logger = new Logger(AutoTradeConfigController.name);
  private readonly quantEngineUrl: string;

  constructor() {
    this.quantEngineUrl =
      process.env.QUANT_ENGINE_URL || 'http://localhost:8000';
  }

  /**
   * GET /api/auto-trade-config — Retrieve current auto-trade configuration
   *
   * Proxies to the quant engine's GET /api/auto-trade-config endpoint.
   */
  @Get()
  async getConfig() {
    this.logger.log('Fetching auto-trade config from quant engine');

    try {
      const response = await fetch(
        `${this.quantEngineUrl}/api/auto-trade-config`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Quant engine returned ${response.status}: ${errorText}`,
        );
        throw new HttpException(
          `Failed to fetch auto-trade config: ${errorText}`,
          response.status,
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to connect to quant engine: ${error}`);
      throw new HttpException(
        'Quant engine is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * PUT /api/auto-trade-config — Update auto-trade configuration
   *
   * Proxies to the quant engine's PUT /api/auto-trade-config endpoint.
   * Validates the request body before forwarding.
   */
  @Put()
  @HttpCode(HttpStatus.OK)
  async updateConfig(@Body() dto: UpdateAutoTradeConfigDto) {
    this.logger.log(
      `Updating auto-trade config: ${JSON.stringify(Object.keys(dto))}`,
    );

    try {
      const response = await fetch(
        `${this.quantEngineUrl}/api/auto-trade-config`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dto),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Quant engine returned ${response.status}: ${errorText}`,
        );
        throw new HttpException(
          `Failed to update auto-trade config: ${errorText}`,
          response.status,
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to connect to quant engine: ${error}`);
      throw new HttpException(
        'Quant engine is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
