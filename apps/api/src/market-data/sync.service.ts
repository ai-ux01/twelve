import { Injectable, Logger, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { Timeframe } from '@prisma/client';
import { HistoricalDataService } from './historical-data.service';
import { KiteConnectProvider } from './providers/kite-connect.provider';
import { RateLimiter } from './rate-limiter.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../database/prisma.service';

/**
 * Represents a date range segment for chunked broker API requests.
 */
export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Result of syncing historical data for a single instrument+timeframe.
 */
export interface SyncResult {
  instrumentId: string;
  timeframe: Timeframe;
  candlesSynced: number;
  fromDate: Date;
  toDate: Date;
  durationMs: number;
}

/**
 * Interface for RetentionScheduler dependency (forward reference).
 * The actual RetentionScheduler is registered in the same module.
 */
export interface IRetentionScheduler {
  runCleanup(): Promise<{ deletedCount: number; durationMs: number; batchesProcessed: number }>;
}

/**
 * Injection token for the RetentionScheduler.
 */
export const RETENTION_SCHEDULER_TOKEN = 'RETENTION_SCHEDULER';

/**
 * Maximum number of candles the broker API returns per request.
 * Kotak limits: ~2000 candles per day-timeframe request.
 */
const MAX_CANDLES_PER_REQUEST = 2000;

/**
 * Timeframes to sync for each instrument.
 * Excludes TICK (handled by TickBuffer) and less common timeframes.
 */
const SYNC_TIMEFRAMES: Timeframe[] = [
  Timeframe.ONE_MIN,
  Timeframe.FIVE_MIN,
  Timeframe.FIFTEEN_MIN,
  Timeframe.ONE_HOUR,
  Timeframe.ONE_DAY,
];

/**
 * SyncService handles incremental data fetching from broker APIs.
 *
 * Key behaviors:
 * - Non-blocking startup: onModuleInit launches background sync via setImmediate
 * - Incremental sync: only fetches data after the latest stored timestamp
 * - Chunked requests: splits date ranges into broker-API-sized segments
 * - Rate limiting: acquires rate limiter token before each broker API call
 * - Exponential backoff: retries failed requests with 1s, 2s, 4s delays (max 3 attempts)
 * - After sync: triggers RetentionScheduler cleanup pass
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 10.1, 10.2, 10.3, 10.4
 */
@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);

  private static readonly MAX_RETRIES = 3;
  private static readonly INITIAL_BACKOFF_MS = 1000;

  constructor(
    private readonly historicalDataService: HistoricalDataService,
    private readonly kiteConnectProvider: KiteConnectProvider,
    private readonly rateLimiter: RateLimiter,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(RETENTION_SCHEDULER_TOKEN)
    private readonly retentionScheduler?: IRetentionScheduler,
  ) {}

  /**
   * Called on app start. Initiates non-blocking background sync if configured.
   * Uses setImmediate to ensure the HTTP server starts accepting requests immediately.
   *
   * Requirements: 10.1, 10.2
   */
  async onModuleInit(): Promise<void> {
    if (!this.configService.syncOnStartup) {
      this.logger.log('Startup sync disabled (SYNC_ON_STARTUP=false)');
      return;
    }

    this.logger.log('Scheduling background sync on startup...');

    // Non-blocking: use setImmediate so server boot is not delayed
    setImmediate(() => {
      this.syncAllInstruments().catch((error) => {
        this.logger.error(
          `Background sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
    });
  }

  /**
   * Sync historical data for a single instrument+timeframe.
   * Determines the latest stored timestamp and fetches only new data from the broker API.
   *
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
   */
  async syncHistoricalData(
    instrumentId: string,
    timeframe: Timeframe,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let totalCandlesSynced = 0;

    // Determine the starting point for sync (Requirement 4.2)
    const latestTimestamp = await this.historicalDataService.getLatestTimestamp(
      instrumentId,
      timeframe,
    );

    const now = new Date();
    let fromDate: Date;

    if (latestTimestamp) {
      // Incremental sync: start from 1ms after the latest stored timestamp
      fromDate = new Date(latestTimestamp.getTime() + 1);
    } else {
      // First sync: fetch up to 2 years of historical data (Requirement 4.3)
      fromDate = new Date(now);
      fromDate.setFullYear(fromDate.getFullYear() - this.configService.marketDataRetentionYears);
    }

    const toDate = now;

    // If fromDate is after toDate, nothing to sync
    if (fromDate >= toDate) {
      this.logger.debug(
        `No new data to sync for instrument=${instrumentId} timeframe=${timeframe}`,
      );
      return {
        instrumentId,
        timeframe,
        candlesSynced: 0,
        fromDate,
        toDate,
        durationMs: Date.now() - startTime,
      };
    }

    // Chunk the date range into broker-API-sized segments (Requirement 4.4)
    const chunks = this.chunkDateRange(fromDate, toDate, timeframe);

    this.logger.debug(
      `Syncing instrument=${instrumentId} timeframe=${timeframe}: ${chunks.length} chunk(s) from ${fromDate.toISOString()} to ${toDate.toISOString()}`,
    );

    // Fetch and upsert data for each chunk
    for (const chunk of chunks) {
      // Rate limiting (Requirement 4.5)
      await this.rateLimiter.acquire();

      // Fetch with exponential backoff retry (Requirement 4.6)
      const candles = await this.fetchWithRetry(instrumentId, timeframe, chunk);

      if (candles.length > 0) {
        await this.historicalDataService.upsertCandles(candles);
        totalCandlesSynced += candles.length;
      }
    }

    const durationMs = Date.now() - startTime;

    this.logger.debug(
      `Sync complete for instrument=${instrumentId} timeframe=${timeframe}: ${totalCandlesSynced} candles in ${durationMs}ms`,
    );

    return {
      instrumentId,
      timeframe,
      candlesSynced: totalCandlesSynced,
      fromDate,
      toDate,
      durationMs,
    };
  }

  /**
   * Sync all active instruments. Iterates through each instrument and timeframe
   * combination with rate limiting. Runs in background.
   *
   * Requirements: 10.1, 10.3, 10.4
   */
  async syncAllInstruments(): Promise<void> {
    const overallStart = Date.now();
    let totalCandles = 0;

    this.logger.log('Starting background sync for all active instruments...');

    // Get all active instruments
    const instruments = await this.prisma.instrument.findMany({
      where: { isActive: true },
      select: { id: true, symbol: true },
    });

    this.logger.log(`Found ${instruments.length} active instrument(s) to sync`);

    for (const instrument of instruments) {
      for (const timeframe of SYNC_TIMEFRAMES) {
        try {
          const result = await this.syncHistoricalData(instrument.id, timeframe);
          totalCandles += result.candlesSynced;
        } catch (error) {
          // Graceful degradation: if sync fails for one instrument, continue with others
          this.logger.error(
            `Sync failed for instrument=${instrument.symbol} (${instrument.id}) timeframe=${timeframe}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    }

    const totalDuration = Date.now() - overallStart;

    // Log total candles synced and duration (Requirement 10.3)
    this.logger.log(
      `Background sync complete: ${totalCandles} candles synced across ${instruments.length} instrument(s) in ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`,
    );

    // After sync completes, trigger retention cleanup pass (Requirement 10.4)
    if (this.retentionScheduler) {
      try {
        this.logger.log('Triggering post-sync retention cleanup...');
        const cleanupResult = await this.retentionScheduler.runCleanup();
        this.logger.log(
          `Post-sync retention cleanup complete: ${cleanupResult.deletedCount} candles removed in ${cleanupResult.durationMs}ms`,
        );
      } catch (error) {
        this.logger.error(
          `Post-sync retention cleanup failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    } else {
      this.logger.warn('RetentionScheduler not available, skipping post-sync cleanup');
    }
  }

  /**
   * Chunk a date range into broker-API-sized segments.
   * Each chunk respects the Kotak API response limit of ~2000 candles per request.
   *
   * The chunk size is determined by the timeframe:
   * - ONE_MIN: ~2000 minutes = ~33 hours per chunk
   * - FIVE_MIN: ~2000 * 5 minutes = ~166 hours = ~6.9 days per chunk
   * - FIFTEEN_MIN: ~2000 * 15 minutes = ~500 hours = ~20 days per chunk
   * - ONE_HOUR: ~2000 hours = ~83 days per chunk
   * - ONE_DAY: ~2000 days = ~5.5 years per chunk (single chunk for 2yr window)
   *
   * Requirements: 4.4
   */
  chunkDateRange(from: Date, to: Date, timeframe: Timeframe): DateRange[] {
    if (from >= to) {
      return [];
    }

    const chunkDurationMs = this.getChunkDurationMs(timeframe);
    const chunks: DateRange[] = [];

    let currentFrom = new Date(from);

    while (currentFrom < to) {
      const chunkEnd = new Date(currentFrom.getTime() + chunkDurationMs);
      const effectiveEnd = chunkEnd < to ? chunkEnd : new Date(to);

      chunks.push({
        from: new Date(currentFrom),
        to: effectiveEnd,
      });

      currentFrom = new Date(effectiveEnd.getTime() + 1);
    }

    return chunks;
  }

  /**
   * Calculate the maximum duration for a single chunk based on timeframe.
   * Uses MAX_CANDLES_PER_REQUEST (2000) as the limit.
   */
  private getChunkDurationMs(timeframe: Timeframe): number {
    const minutesPerCandle = this.getMinutesPerCandle(timeframe);
    // Duration = maxCandles * minutesPerCandle * 60 * 1000 (ms)
    return MAX_CANDLES_PER_REQUEST * minutesPerCandle * 60 * 1000;
  }

  /**
   * Get the number of minutes per candle for a given timeframe.
   */
  private getMinutesPerCandle(timeframe: Timeframe): number {
    switch (timeframe) {
      case Timeframe.ONE_MIN:
        return 1;
      case Timeframe.FIVE_MIN:
        return 5;
      case Timeframe.FIFTEEN_MIN:
        return 15;
      case Timeframe.THIRTY_MIN:
        return 30;
      case Timeframe.ONE_HOUR:
        return 60;
      case Timeframe.FOUR_HOUR:
        return 240;
      case Timeframe.ONE_DAY:
        return 1440;
      case Timeframe.ONE_WEEK:
        return 10080;
      case Timeframe.ONE_MONTH:
        return 43200; // ~30 days
      default:
        return 1440; // default to daily
    }
  }

  /**
   * Fetch OHLCV data from broker API with exponential backoff retry.
   * Retry delays: 1s, 2s, 4s (max 3 attempts).
   *
   * Requirements: 4.6
   */
  private async fetchWithRetry(
    instrumentId: string,
    timeframe: Timeframe,
    dateRange: DateRange,
  ): Promise<
    Array<{
      instrumentId: string;
      timeframe: Timeframe;
      timestamp: Date;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: bigint;
    }>
  > {
    const interval = this.timeframeToInterval(timeframe);

    for (let attempt = 1; attempt <= SyncService.MAX_RETRIES; attempt++) {
      try {
        const ohlcvData = await this.kiteConnectProvider.fetchOHLCV(
          instrumentId,
          interval,
          dateRange.from,
          dateRange.to,
        );

        // Transform broker response to CandleInput format
        return ohlcvData.map((candle) => ({
          instrumentId,
          timeframe,
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: BigInt(Math.round(candle.volume)),
        }));
      } catch (error) {
        if (attempt >= SyncService.MAX_RETRIES) {
          this.logger.error(
            `All ${SyncService.MAX_RETRIES} retry attempts exhausted for instrument=${instrumentId} timeframe=${timeframe} range=[${dateRange.from.toISOString()}, ${dateRange.to.toISOString()}]`,
          );
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delayMs =
          SyncService.INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Attempt ${attempt}/${SyncService.MAX_RETRIES} failed for instrument=${instrumentId} timeframe=${timeframe}. Retrying in ${delayMs}ms... Error: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );

        await this.sleep(delayMs);
      }
    }

    // This should never be reached due to the throw in the loop, but TypeScript needs it
    return [];
  }

  /**
   * Convert Timeframe enum to broker API interval string.
   */
  private timeframeToInterval(timeframe: Timeframe): string {
    switch (timeframe) {
      case Timeframe.ONE_MIN:
        return 'minute';
      case Timeframe.FIVE_MIN:
        return '5minute';
      case Timeframe.FIFTEEN_MIN:
        return '15minute';
      case Timeframe.THIRTY_MIN:
        return '30minute';
      case Timeframe.ONE_HOUR:
        return '60minute';
      case Timeframe.FOUR_HOUR:
        return '4hour';
      case Timeframe.ONE_DAY:
        return 'day';
      case Timeframe.ONE_WEEK:
        return 'week';
      case Timeframe.ONE_MONTH:
        return 'month';
      default:
        return 'day';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
