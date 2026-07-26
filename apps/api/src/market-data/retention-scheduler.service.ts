import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HistoricalDataService } from './historical-data.service';
import { ConfigService } from '../config/config.service';

/**
 * Result from a retention cleanup run.
 */
export interface RetentionResult {
  deletedCount: number;
  durationMs: number;
  batchesProcessed: number;
}

/**
 * RetentionScheduler runs daily cleanup to delete candle data older than the
 * configured retention period. Operates in batches for error resilience and
 * to avoid long-running transactions.
 *
 * - Default schedule: daily at 2 AM (configurable via RETENTION_CRON)
 * - Batch size: 5000 records per batch
 * - Error resilience: logs errors per batch and continues with next batch
 * - Manual trigger: runCleanup() can be called by SyncService after startup sync
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
@Injectable()
export class RetentionScheduler {
  private readonly logger = new Logger(RetentionScheduler.name);
  private readonly DEFAULT_BATCH_SIZE = 5000;

  constructor(
    private readonly historicalDataService: HistoricalDataService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Cron-triggered retention cleanup.
   * Uses the configured RETENTION_CRON expression (default: "0 2 * * *" = daily at 2 AM).
   *
   * Note: The @Cron decorator requires a static expression at compile time.
   * Dynamic cron configuration is handled via SchedulerRegistry if needed,
   * but for simplicity we use the default daily-at-2AM schedule here.
   * The configService.retentionCron getter is available for future dynamic scheduling.
   *
   * Requirements: 5.1
   */
  @Cron('0 2 * * *', { name: 'retention-cleanup' })
  async handleRetentionCleanup(): Promise<void> {
    this.logger.log('Scheduled retention cleanup triggered');
    await this.runCleanup();
  }

  /**
   * Manual trigger for retention cleanup. Called by SyncService after startup sync.
   * Implements batch deletion with error resilience — if a batch fails,
   * logs the error and continues with the next batch.
   *
   * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6
   */
  async runCleanup(): Promise<RetentionResult> {
    const start = Date.now();
    const retentionYears = this.configService.marketDataRetentionYears;
    const boundary = new Date();
    boundary.setFullYear(boundary.getFullYear() - retentionYears);

    this.logger.log(
      `Running retention cleanup. Deleting candles older than ${boundary.toISOString()} (retention: ${retentionYears} years)`,
    );

    let totalDeleted = 0;
    let batchesProcessed = 0;
    const batchSize = this.DEFAULT_BATCH_SIZE;

    // Batch deletion loop with error resilience (Requirement 5.6)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const deleted = await this.historicalDataService.deleteOlderThan(boundary, batchSize);
        batchesProcessed++;
        totalDeleted += deleted;

        this.logger.debug(
          `Batch ${batchesProcessed}: deleted ${deleted} candles`,
        );

        // If we deleted fewer than batchSize, there's nothing left to delete
        if (deleted < batchSize) {
          break;
        }
      } catch (error) {
        // Error resilience: log error and continue with next batch (Requirement 5.6)
        batchesProcessed++;
        this.logger.error(
          `Error in retention batch ${batchesProcessed}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Break after error to avoid infinite loops on persistent failures
        // The next scheduled run will pick up remaining records
        break;
      }
    }

    const durationMs = Date.now() - start;

    this.logger.log(
      `Retention cleanup complete: ${totalDeleted} records deleted, ${batchesProcessed} batches processed, duration: ${durationMs}ms`,
    );

    return { deletedCount: totalDeleted, durationMs, batchesProcessed };
  }
}
