import {
  Controller,
  Get,
  Query,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HistoricalDataService } from './historical-data.service';
import { PrismaService } from '../database/prisma.service';
import { HistoricalDataQueryDto } from './dto/historical-data-query.dto';
import {
  HistoricalDataResponseDto,
  CandleResponseDto,
} from './dto/historical-data-response.dto';

/**
 * HistoricalDataController exposes a REST endpoint for querying historical candle data.
 *
 * - GET /api/market-data/history
 * - Validates query params via class-validator DTO (returns HTTP 400 on invalid params)
 * - Returns HTTP 404 for non-existent instrumentId
 * - Returns JSON with instrumentId, timeframe, from, to, count, and candles array
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
@SkipThrottle()
@Controller('market-data')
export class HistoricalDataController {
  private readonly logger = new Logger(HistoricalDataController.name);

  constructor(
    private readonly historicalDataService: HistoricalDataService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/market-data/history
   *
   * Query historical OHLCV candle data for an instrument.
   *
   * @param query - Validated query parameters (instrumentId, timeframe, from, to)
   * @returns HistoricalDataResponseDto with candle data
   *
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
   */
  @Get('history')
  async getHistory(
    @Query() query: HistoricalDataQueryDto,
  ): Promise<HistoricalDataResponseDto> {
    const { instrumentId, timeframe, from, to } = query;

    this.logger.debug(
      `History request: instrument=${instrumentId} timeframe=${timeframe} from=${from} to=${to || 'now'}`,
    );

    // Check if instrument exists (Requirement 6.4)
    const instrument = await this.prisma.instrument.findFirst({
      where: { id: instrumentId },
      select: { id: true },
    });

    if (!instrument) {
      throw new NotFoundException(`Instrument not found: ${instrumentId}`);
    }

    // Parse dates — 'to' defaults to now if not provided
    const fromDate = new Date(from);
    const toDate = to ? new Date(to) : new Date();

    // Query historical candles (date clamping handled by service)
    const result = await this.historicalDataService.getHistoricalCandles({
      instrumentId,
      timeframe,
      fromDate,
      toDate,
    });

    // Transform candles to response format (BigInt → string for JSON serialization)
    const candles: CandleResponseDto[] = result.candles.map((candle) => ({
      timestamp: candle.timestamp.toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume.toString(),
    }));

    return {
      instrumentId: result.instrumentId,
      timeframe: result.timeframe,
      from: result.from.toISOString(),
      to: result.to.toISOString(),
      count: result.count,
      candles,
    };
  }
}
