import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '../config/config.service';

/**
 * Represents a single market tick.
 */
export interface TickData {
  instrumentId: string;
  price: number;
  volume: number;
  timestamp: Date;
}

/**
 * TickBuffer provides an in-memory buffer for live tick data with dual-threshold flush logic.
 *
 * Key behaviors:
 * - When STORE_TICKS is disabled (default), push() is a no-op
 * - When enabled, ticks are buffered in memory
 * - Flush triggers when EITHER:
 *   1. Buffer reaches TICK_BATCH_SIZE (default 1000), OR
 *   2. TICK_BATCH_INTERVAL_MS (default 5000ms) has elapsed since the last flush
 * - Flush is non-blocking (fire-and-forget with error logging)
 * - Only completed (closed) candle bars should be persisted (handled upstream)
 *
 * Requirements: 11.1, 11.2, 12.1, 12.2, 12.3, 12.4
 */
@Injectable()
export class TickBuffer implements OnModuleDestroy {
  private readonly logger = new Logger(TickBuffer.name);
  private buffer: TickData[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private lastFlushTime: number = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Start the interval timer if ticks are enabled
    if (this.configService.storeTicks) {
      this.startFlushTimer();
    }
  }

  /**
   * Add a tick to the buffer.
   * When STORE_TICKS is disabled, this is a no-op (Requirement 12.3).
   * Flushes when batch size threshold is reached (Requirement 12.2).
   */
  push(tick: TickData): void {
    // No-op when tick storage is disabled (Requirement 12.1, 12.3)
    if (!this.configService.storeTicks) {
      return;
    }

    this.buffer.push(tick);

    // Flush when buffer reaches TICK_BATCH_SIZE (Requirement 12.2)
    if (this.buffer.length >= this.configService.tickBatchSize) {
      this.triggerFlush();
    }
  }

  /**
   * Clean up timer on module destroy.
   */
  onModuleDestroy(): void {
    this.stopFlushTimer();
    // Flush any remaining ticks
    if (this.buffer.length > 0) {
      this.triggerFlush();
    }
  }

  /**
   * Start the periodic flush timer.
   * Checks if TICK_BATCH_INTERVAL_MS has elapsed since last flush.
   */
  private startFlushTimer(): void {
    const intervalMs = this.configService.tickBatchIntervalMs;
    this.flushTimer = setInterval(() => {
      const elapsed = Date.now() - this.lastFlushTime;
      if (elapsed >= intervalMs && this.buffer.length > 0) {
        this.triggerFlush();
      }
    }, Math.min(intervalMs, 1000)); // Check every second or at the interval, whichever is smaller
  }

  /**
   * Stop the flush timer.
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Non-blocking flush: fire-and-forget with error logging.
   * Does NOT block the live data processing pipeline (Requirement 12.4).
   */
  private triggerFlush(): void {
    const ticksToFlush = [...this.buffer];
    this.buffer = [];
    this.lastFlushTime = Date.now();

    // Fire-and-forget — don't await, just log errors
    this.flush(ticksToFlush).catch((error) => {
      this.logger.error(
        `Failed to flush ${ticksToFlush.length} ticks: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  /**
   * Flush ticks to the database.
   * Stores tick data using a batch insert.
   */
  private async flush(ticks: TickData[]): Promise<void> {
    if (ticks.length === 0) {
      return;
    }

    this.logger.debug(`Flushing ${ticks.length} ticks to database`);

    // Use raw SQL batch insert for performance
    const values = ticks
      .map((t) => {
        const id = this.generateUuid();
        return `('${id}', '${t.instrumentId}', 'TICK'::"Timeframe", '${t.timestamp.toISOString()}'::timestamp, ${t.price}, ${t.price}, ${t.price}, ${t.price}, ${t.volume}, NOW())`;
      })
      .join(',\n');

    const query = `
      INSERT INTO "Candle" ("id", "instrumentId", "timeframe", "timestamp", "open", "high", "low", "close", "volume", "createdAt")
      VALUES ${values}
      ON CONFLICT ("instrumentId", "timeframe", "timestamp")
      DO UPDATE SET
        "high" = GREATEST("Candle"."high", EXCLUDED."high"),
        "low" = LEAST("Candle"."low", EXCLUDED."low"),
        "close" = EXCLUDED."close",
        "volume" = "Candle"."volume" + EXCLUDED."volume"
    `;

    await this.prisma.$executeRawUnsafe(query);

    this.logger.debug(`Successfully flushed ${ticks.length} ticks`);
  }

  /**
   * Generate a UUID v4 for tick record IDs.
   */
  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
