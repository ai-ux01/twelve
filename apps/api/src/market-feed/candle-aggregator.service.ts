import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { MongoClient, Db, Collection } from 'mongodb';
import { NormalizedTick } from './interfaces';

/**
 * CandleAggregatorService
 *
 * Listens to tick events from the MarketDataManager, aggregates them into
 * 5-minute OHLCV candles in memory, and flushes completed candles to MongoDB.
 *
 * Candle window: aligned to 5-minute boundaries (9:15, 9:20, 9:25, etc.)
 * Storage: MongoDB `bot-ai.candles` collection (same as quant engine reads from)
 */

interface CandleWindow {
  symbol: string;
  timeframe: string;
  windowStart: number; // Unix timestamp (seconds) of window start
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tickCount: number;
}

const TIMEFRAMES = [
  { name: '5minute', intervalMs: 5 * 60 * 1000 },
  { name: '15minute', intervalMs: 15 * 60 * 1000 },
  { name: '1hour', intervalMs: 60 * 60 * 1000 },
  { name: 'day', intervalMs: 24 * 60 * 60 * 1000 },
  { name: 'week', intervalMs: 7 * 24 * 60 * 60 * 1000 },
];

@Injectable()
export class CandleAggregatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CandleAggregatorService.name);

  // In-memory candle windows: key = "symbol|windowStart"
  private candles = new Map<string, CandleWindow>();
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  // MongoDB
  private mongoClient: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection | null = null;
  private connected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const mongoUri = this.configService.get<string>(
      'MONGODB_URI',
      'mongodb://localhost:27017/bot-ai',
    );

    try {
      this.mongoClient = new MongoClient(mongoUri);
      await this.mongoClient.connect();
      this.db = this.mongoClient.db();
      this.collection = this.db.collection('candles');
      this.connected = true;
      this.logger.log(
        `Candle aggregator connected to MongoDB: ${this.db.databaseName}.candles`,
      );

      // Ensure index for efficient queries
      await this.collection.createIndex(
        { symbol: 1, timeframe: 1, timestamp: -1 },
        { background: true },
      );
    } catch (error) {
      this.logger.error(`Failed to connect to MongoDB: ${error}`);
      this.connected = false;
    }

    // Flush completed candles every 10 seconds
    this.flushInterval = setInterval(() => {
      this.flushCompletedCandles();
    }, 10_000);

    this.logger.log('Candle aggregator started (5min, 15min, 1hr, day, week)');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Flush any remaining candles
    await this.flushCompletedCandles();

    if (this.mongoClient) {
      await this.mongoClient.close();
      this.connected = false;
      this.logger.log('Candle aggregator MongoDB connection closed');
    }
  }

  /**
   * Handle incoming tick events and aggregate into candle windows for all timeframes.
   */
  @OnEvent('tick')
  handleTick(tick: NormalizedTick): void {
    if (!tick.instrumentToken || tick.lastPrice <= 0) return;

    const symbol = tick.symbol || tick.instrumentToken;
    const now = Date.now();

    for (const tf of TIMEFRAMES) {
      const windowStart = this.getWindowStart(now, tf.intervalMs);
      const key = `${symbol}|${tf.name}|${windowStart}`;

      const existing = this.candles.get(key);

      if (existing) {
        existing.high = Math.max(existing.high, tick.lastPrice);
        existing.low = Math.min(existing.low, tick.lastPrice);
        existing.close = tick.lastPrice;
        existing.volume += tick.volume || 0;
        existing.tickCount++;
      } else {
        this.candles.set(key, {
          symbol,
          timeframe: tf.name,
          windowStart,
          open: tick.lastPrice,
          high: tick.lastPrice,
          low: tick.lastPrice,
          close: tick.lastPrice,
          volume: tick.volume || 0,
          tickCount: 1,
        });
      }
    }
  }

  /**
   * Get the start of the candle window for a given interval (aligned to clock).
   */
  private getWindowStart(timestampMs: number, intervalMs: number): number {
    const windowMs = Math.floor(timestampMs / intervalMs) * intervalMs;
    return windowMs / 1000; // Return as seconds (matches MongoDB schema)
  }

  /**
   * Flush completed candle windows to MongoDB.
   * A candle is "completed" if the current time is past its window end.
   */
  private async flushCompletedCandles(): Promise<void> {
    if (!this.connected || !this.collection) return;

    const now = Date.now();
    const toFlush: CandleWindow[] = [];
    const keysToDelete: string[] = [];

    for (const [key, candle] of this.candles.entries()) {
      // Find the matching timeframe interval
      const tf = TIMEFRAMES.find((t) => t.name === candle.timeframe);
      if (!tf) continue;

      const currentWindowStart = this.getWindowStart(now, tf.intervalMs);

      // Only flush candles from completed windows (not the current one)
      if (candle.windowStart < currentWindowStart) {
        toFlush.push(candle);
        keysToDelete.push(key);
      }
    }

    if (toFlush.length === 0) return;

    // Write to MongoDB
    try {
      const operations = toFlush.map((candle) => ({
        updateOne: {
          filter: {
            symbol: candle.symbol,
            timeframe: candle.timeframe,
            timestamp: candle.windowStart,
          },
          update: {
            $set: {
              symbol: candle.symbol,
              timeframe: candle.timeframe,
              timestamp: candle.windowStart,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
            },
          },
          upsert: true,
        },
      }));

      const result = await this.collection.bulkWrite(operations);

      this.logger.debug(
        `Flushed ${toFlush.length} candles to MongoDB ` +
          `(upserted: ${result.upsertedCount}, modified: ${result.modifiedCount})`,
      );

      // Remove flushed candles from memory
      for (const key of keysToDelete) {
        this.candles.delete(key);
      }
    } catch (error) {
      this.logger.error(`Failed to flush candles to MongoDB: ${error}`);
    }
  }

  /**
   * Get aggregator status for health checks.
   */
  getStatus(): {
    connected: boolean;
    activeWindows: number;
    symbols: string[];
  } {
    const symbols = new Set<string>();
    for (const candle of this.candles.values()) {
      symbols.add(candle.symbol);
    }

    return {
      connected: this.connected,
      activeWindows: this.candles.size,
      symbols: Array.from(symbols),
    };
  }
}
