import { Injectable, Logger } from '@nestjs/common';
import { Timeframe } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '../config/config.service';

/**
 * Input for batch upsert of candle data.
 */
export interface CandleInput {
  instrumentId: string;
  timeframe: Timeframe;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
}

/**
 * Result returned from getHistoricalCandles.
 */
export interface HistoricalCandlesResult {
  instrumentId: string;
  timeframe: Timeframe;
  from: Date;
  to: Date;
  count: number;
  candles: Array<{
    id: string;
    instrumentId: string;
    timeframe: Timeframe;
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: bigint;
    createdAt: Date;
  }>;
}

/**
 * HistoricalDataService provides CRUD operations for historical OHLCV candle data.
 *
 * Key behaviors:
 * - Date clamping: fromDate is clamped to the retention boundary, toDate is clamped to now
 * - Idempotent upsert: uses ON CONFLICT DO UPDATE for duplicate prevention
 * - Batch deletion: deleteOlderThan operates in configurable batch sizes
 * - Ascending order: all queries return candles ordered by timestamp ASC
 *
 * Requirements: 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.3, 13.3, 13.4
 */
@Injectable()
export class HistoricalDataService {
  private readonly logger = new Logger(HistoricalDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Query historical candles with automatic date clamping.
   *
   * - fromDate is clamped to the retention boundary (now - retentionYears)
   * - toDate is clamped to the current timestamp (no future data)
   * - Results are ordered by timestamp ascending
   * - Returns empty array if no candles match
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   */
  async getHistoricalCandles(params: {
    instrumentId: string;
    timeframe: Timeframe;
    fromDate: Date;
    toDate: Date;
  }): Promise<HistoricalCandlesResult> {
    const { instrumentId, timeframe, fromDate, toDate } = params;

    const now = new Date();
    const retentionBoundary = this.getRetentionBoundary(now);

    // Clamp fromDate to retention boundary (Requirement 3.2)
    const effectiveFrom = fromDate < retentionBoundary ? retentionBoundary : fromDate;

    // Clamp toDate to current timestamp (Requirement 3.3)
    const effectiveTo = toDate > now ? now : toDate;

    this.logger.debug(
      `Querying candles for ${instrumentId} [${timeframe}] from ${effectiveFrom.toISOString()} to ${effectiveTo.toISOString()}`,
    );

    // Query with ascending order (Requirement 3.4)
    const candles = await this.prisma.candle.findMany({
      where: {
        instrumentId,
        timeframe,
        timestamp: {
          gte: effectiveFrom,
          lte: effectiveTo,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return {
      instrumentId,
      timeframe,
      from: effectiveFrom,
      to: effectiveTo,
      count: candles.length,
      candles,
    };
  }

  /**
   * Batch upsert candles using raw SQL ON CONFLICT DO UPDATE for idempotent writes.
   *
   * Uses the unique constraint (instrumentId, timeframe, timestamp) to detect duplicates.
   * On conflict, updates OHLCV values to the new values (last write wins).
   *
   * Requirements: 2.1, 2.2, 2.3, 13.3
   */
  async upsertCandles(candles: CandleInput[]): Promise<number> {
    if (candles.length === 0) {
      return 0;
    }

    this.logger.debug(`Upserting ${candles.length} candles`);

    // Use raw SQL for true upsert with ON CONFLICT DO UPDATE
    // This ensures idempotence: reinserting same data updates instead of duplicating
    const values = candles
      .map((c) => {
        const id = this.generateUuid();
        return `('${id}', '${c.instrumentId}', '${c.timeframe}'::"Timeframe", '${c.timestamp.toISOString()}'::timestamp, ${c.open}, ${c.high}, ${c.low}, ${c.close}, ${c.volume}, NOW())`;
      })
      .join(',\n');

    const query = `
      INSERT INTO "Candle" ("id", "instrumentId", "timeframe", "timestamp", "open", "high", "low", "close", "volume", "createdAt")
      VALUES ${values}
      ON CONFLICT ("instrumentId", "timeframe", "timestamp")
      DO UPDATE SET
        "open" = EXCLUDED."open",
        "high" = EXCLUDED."high",
        "low" = EXCLUDED."low",
        "close" = EXCLUDED."close",
        "volume" = EXCLUDED."volume"
    `;

    const result = await this.prisma.$executeRawUnsafe(query);

    this.logger.debug(`Upserted ${result} candles`);
    return result;
  }

  /**
   * Get the latest stored timestamp for an instrument+timeframe combination.
   * Used by SyncService to determine the sync starting point.
   *
   * Returns null if no candles exist for the combination.
   *
   * Requirements: 4.2 (supports incremental sync gap detection)
   */
  async getLatestTimestamp(
    instrumentId: string,
    timeframe: Timeframe,
  ): Promise<Date | null> {
    const result = await this.prisma.candle.findFirst({
      where: {
        instrumentId,
        timeframe,
      },
      orderBy: {
        timestamp: 'desc',
      },
      select: {
        timestamp: true,
      },
    });

    return result?.timestamp ?? null;
  }

  /**
   * Delete candles older than the given boundary date.
   * Operates in batches to avoid long-running transactions and database locks.
   *
   * Returns the total number of deleted records.
   *
   * Requirements: 5.2, 5.3
   */
  async deleteOlderThan(boundary: Date, batchSize: number = 5000): Promise<number> {
    let totalDeleted = 0;
    let batchCount = 0;

    this.logger.debug(
      `Starting batch deletion of candles older than ${boundary.toISOString()} (batch size: ${batchSize})`,
    );

    // Delete in batches to avoid long-running transactions
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const deleted = await this.prisma.$executeRawUnsafe(
        `DELETE FROM "Candle" WHERE "id" IN (
          SELECT "id" FROM "Candle"
          WHERE "timestamp" < $1
          LIMIT $2
        )`,
        boundary,
        batchSize,
      );

      batchCount++;
      totalDeleted += deleted;

      this.logger.debug(`Batch ${batchCount}: deleted ${deleted} candles`);

      // If we deleted fewer than batchSize, there's no more to delete
      if (deleted < batchSize) {
        break;
      }
    }

    this.logger.log(
      `Retention cleanup complete: deleted ${totalDeleted} candles in ${batchCount} batch(es)`,
    );

    return totalDeleted;
  }

  /**
   * Calculate the retention boundary date (now - retentionYears).
   */
  private getRetentionBoundary(now: Date): Date {
    const retentionYears = this.configService.marketDataRetentionYears;
    const boundary = new Date(now);
    boundary.setFullYear(boundary.getFullYear() - retentionYears);
    return boundary;
  }

  /**
   * Generate a UUID v4 for candle IDs.
   */
  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
