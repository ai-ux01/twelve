import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import {
  IMarketDataProvider,
  ConnectionStatus,
  RawHsmTick,
  RawHsmDepth,
} from './interfaces';

const DEFAULT_TICK_INTERVAL_MS = 1000;
const PRICE_VARIANCE = 0.02; // ±2% random walk
const DEPTH_LEVELS = 5;

@Injectable()
export class MockDataProvider implements IMarketDataProvider {
  private readonly logger = new Logger(MockDataProvider.name);

  private status: ConnectionStatus = 'DISCONNECTED';
  private activeSubscriptions: Set<string> = new Set();
  private basePrices: Map<string, number> = new Map();
  private currentPrices: Map<string, number> = new Map();
  private intervalHandle: NodeJS.Timeout | null = null;
  private tickIntervalMs: number;

  // Callbacks
  private tickHandlers: Array<(rawTick: RawHsmTick) => void> = [];
  private depthHandlers: Array<(rawDepth: RawHsmDepth) => void> = [];
  private statusChangeHandlers: Array<(status: ConnectionStatus) => void> = [];

  constructor(private readonly nestConfigService: NestConfigService) {
    const raw = this.nestConfigService.get<string>('MOCK_TICK_INTERVAL');
    this.tickIntervalMs = raw ? Number(raw) : DEFAULT_TICK_INTERVAL_MS;
    if (isNaN(this.tickIntervalMs) || this.tickIntervalMs < 100) {
      this.tickIntervalMs = DEFAULT_TICK_INTERVAL_MS;
    }
  }

  /**
   * Connect — immediately sets status to CONNECTED (no real WebSocket).
   */
  async connect(_auth: string, _sid: string, _dataCenter: string): Promise<void> {
    this.logger.log('MockDataProvider connecting (no real WebSocket)');
    this.setStatus('CONNECTED');
    this.startTickGeneration();
  }

  /**
   * Disconnect — clears intervals and sets status to DISCONNECTED.
   */
  async disconnect(): Promise<void> {
    this.stopTickGeneration();
    this.setStatus('DISCONNECTED');
    this.logger.log('MockDataProvider disconnected');
  }

  /**
   * Subscribe to instruments. For each new subscription, generate a random base price.
   */
  subscribe(subscriptionStrings: string[]): void {
    for (const sub of subscriptionStrings) {
      if (!this.activeSubscriptions.has(sub)) {
        this.activeSubscriptions.add(sub);

        // Generate a random base price between 100 and 50000
        const basePrice = Math.random() * 49900 + 100;
        this.basePrices.set(sub, basePrice);
        this.currentPrices.set(sub, basePrice);
      }
    }

    this.logger.debug(
      `Mock subscribed to ${subscriptionStrings.length} instruments (total: ${this.activeSubscriptions.size})`,
    );

    // Ensure tick generation is running if connected
    if (this.status === 'CONNECTED' && !this.intervalHandle) {
      this.startTickGeneration();
    }
  }

  /**
   * Unsubscribe from instruments. Stops generating data for those tokens.
   */
  unsubscribe(subscriptionStrings: string[]): void {
    for (const sub of subscriptionStrings) {
      this.activeSubscriptions.delete(sub);
      this.basePrices.delete(sub);
      this.currentPrices.delete(sub);
    }

    this.logger.debug(
      `Mock unsubscribed from ${subscriptionStrings.length} instruments (remaining: ${this.activeSubscriptions.size})`,
    );

    // Stop generation if no subscriptions remain
    if (this.activeSubscriptions.size === 0) {
      this.stopTickGeneration();
    }
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.activeSubscriptions);
  }

  onTick(handler: (rawTick: RawHsmTick) => void): void {
    this.tickHandlers.push(handler);
  }

  onDepth(handler: (rawDepth: RawHsmDepth) => void): void {
    this.depthHandlers.push(handler);
  }

  onStatusChange(handler: (status: ConnectionStatus) => void): void {
    this.statusChangeHandlers.push(handler);
  }

  // --- Private Methods ---

  private startTickGeneration(): void {
    if (this.intervalHandle) return;
    if (this.activeSubscriptions.size === 0) return;

    this.intervalHandle = setInterval(() => {
      this.generateTicks();
    }, this.tickIntervalMs);
  }

  private stopTickGeneration(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private generateTicks(): void {
    for (const sub of this.activeSubscriptions) {
      const basePrice = this.basePrices.get(sub);
      if (!basePrice) continue;

      const currentPrice = this.currentPrices.get(sub) ?? basePrice;

      // Random walk: ±2% from current price, clamped within ±2% of base
      const change = (Math.random() - 0.5) * 2 * PRICE_VARIANCE * currentPrice;
      let newPrice = currentPrice + change;

      // Clamp to ±2% of base price
      const minPrice = basePrice * (1 - PRICE_VARIANCE);
      const maxPrice = basePrice * (1 + PRICE_VARIANCE);
      newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));

      this.currentPrices.set(sub, newPrice);

      // Extract token from subscription string (format: "exchange|token&1")
      const token = this.extractToken(sub);

      // Emit tick
      const rawTick = this.buildRawTick(token, newPrice, basePrice);
      this.emitTick(rawTick);

      // Emit depth
      const rawDepth = this.buildRawDepth(token, newPrice);
      this.emitDepth(rawDepth);
    }
  }

  /**
   * Extract the instrument token from a subscription string.
   * Format: "exchange_segment|token&1" → "token"
   */
  private extractToken(subscription: string): string {
    const pipeIndex = subscription.indexOf('|');
    const ampIndex = subscription.indexOf('&');

    if (pipeIndex >= 0 && ampIndex > pipeIndex) {
      return subscription.substring(pipeIndex + 1, ampIndex);
    }
    // Fallback: use the full string as token
    return subscription;
  }

  private buildRawTick(
    token: string,
    lastPrice: number,
    basePrice: number,
  ): RawHsmTick {
    const open = basePrice.toFixed(2);
    const high = (basePrice * (1 + PRICE_VARIANCE * 0.8)).toFixed(2);
    const low = (basePrice * (1 - PRICE_VARIANCE * 0.8)).toFixed(2);
    const previousClose = (basePrice * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2);
    const volume = Math.floor(Math.random() * 1_000_000).toString();
    const bid = (lastPrice - lastPrice * 0.001).toFixed(2);
    const ask = (lastPrice + lastPrice * 0.001).toFixed(2);

    return {
      tk: token,
      lp: lastPrice.toFixed(2),
      op: open,
      hp: high,
      lop: low,
      pc: previousClose,
      v: volume,
      bp1: bid,
      sp1: ask,
      ts: new Date().toISOString(),
      e: 'NSE',
      n: `MOCK_${token}`,
    };
  }

  private buildRawDepth(token: string, lastPrice: number): RawHsmDepth {
    const depth: Record<string, string> = {
      tk: token,
      e: 'NSE',
      ts: new Date().toISOString(),
    };

    // Generate 5 bid levels (below last price)
    for (let i = 1; i <= DEPTH_LEVELS; i++) {
      const bidPrice = lastPrice - lastPrice * 0.001 * i;
      const bidQty = Math.floor(Math.random() * 500 + 10);
      const bidOrders = Math.floor(Math.random() * 20 + 1);
      depth[`bp${i}`] = bidPrice.toFixed(2);
      depth[`bq${i}`] = bidQty.toString();
      depth[`bo${i}`] = bidOrders.toString();
    }

    // Generate 5 ask levels (above last price)
    for (let i = 1; i <= DEPTH_LEVELS; i++) {
      const askPrice = lastPrice + lastPrice * 0.001 * i;
      const askQty = Math.floor(Math.random() * 500 + 10);
      const askOrders = Math.floor(Math.random() * 20 + 1);
      depth[`sp${i}`] = askPrice.toFixed(2);
      depth[`sq${i}`] = askQty.toString();
      depth[`so${i}`] = askOrders.toString();
    }

    return depth as unknown as RawHsmDepth;
  }

  private emitTick(rawTick: RawHsmTick): void {
    for (const handler of this.tickHandlers) {
      try {
        handler(rawTick);
      } catch (error) {
        this.logger.error(`Mock tick handler error: ${(error as Error).message}`);
      }
    }
  }

  private emitDepth(rawDepth: RawHsmDepth): void {
    for (const handler of this.depthHandlers) {
      try {
        handler(rawDepth);
      } catch (error) {
        this.logger.error(`Mock depth handler error: ${(error as Error).message}`);
      }
    }
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const handler of this.statusChangeHandlers) {
        try {
          handler(newStatus);
        } catch (error) {
          this.logger.error(
            `Mock status change handler error: ${(error as Error).message}`,
          );
        }
      }
    }
  }
}
