import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';
import { KotakSessionStore } from '../trading/kotak-neo-session.store';
import { MarketFeedConfig } from './market-feed.config';
import { SubscriptionBuilder } from './subscription-builder.service';
import { TickCache } from './tick-cache.service';
import { DepthCache } from './depth-cache.service';
import { parseTick, parseDepth } from './tick-parser';
import {
  IMarketDataProvider,
  MARKET_DATA_PROVIDER,
  ConnectionStatus,
  NormalizedTick,
  NormalizedDepth,
  RawHsmTick,
  RawHsmDepth,
} from './interfaces';

@Injectable()
export class MarketDataManager {
  private readonly logger = new Logger(MarketDataManager.name);

  constructor(
    @Inject(MARKET_DATA_PROVIDER)
    private readonly provider: IMarketDataProvider,
    private readonly subscriptionBuilder: SubscriptionBuilder,
    private readonly tickCache: TickCache,
    private readonly depthCache: DepthCache,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionStore: KotakSessionStore,
    private readonly prisma: PrismaService,
    private readonly config: MarketFeedConfig,
  ) {
    this.wireProviderCallbacks();
  }

  /**
   * Connect to the market data provider using the latest Kotak session credentials.
   */
  async connect(): Promise<void> {
    const session = this.sessionStore.getLatest();

    if (!session) {
      this.logger.warn('No active Kotak session found. Waiting for session...');
      this.eventEmitter.emit('market-feed.waiting-for-session');
      return;
    }

    try {
      this.logger.log('Connecting to market data provider...');
      await this.provider.connect(
        session.auth,
        session.sid,
        session.dataCenter || '',
      );
      this.logger.log('Market data provider connected');
    } catch (error) {
      this.logger.error(
        `Failed to connect to market data provider: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Subscribe to stock market data by trading symbol.
   * Resolves the symbol to an instrument, builds the subscription string, and sends to provider.
   */
  async subscribeStock(symbol: string): Promise<void> {
    const instrument = await this.resolveInstrument(symbol);

    if (!instrument) {
      throw new Error(`Instrument not found for symbol: ${symbol}`);
    }

    const subscriptionString = this.subscriptionBuilder.buildStockSubscription({
      exchangeSegment: instrument.exchangeSegment,
      instrumentToken: instrument.instrumentToken,
      symbol: instrument.symbol,
    });

    this.provider.subscribe([subscriptionString]);
    this.logger.log(`Subscribed to stock: ${symbol} (${subscriptionString})`);
  }

  /**
   * Subscribe to index market data by symbol name.
   */
  async subscribeIndex(symbol: string): Promise<void> {
    const instrument = await this.resolveInstrument(symbol);

    if (!instrument) {
      throw new Error(`Index instrument not found for symbol: ${symbol}`);
    }

    const subscriptionString = this.subscriptionBuilder.buildIndexSubscription({
      exchangeSegment: instrument.exchangeSegment,
      displaySymbol: instrument.name,
      symbol: instrument.symbol,
    });

    this.provider.subscribe([subscriptionString]);
    this.logger.log(`Subscribed to index: ${symbol} (${subscriptionString})`);
  }

  /**
   * Subscribe to an options contract by underlying, expiry, strike, and type.
   */
  async subscribeOption(params: {
    underlying: string;
    expiry: Date;
    strike: number;
    optionType: 'CALL' | 'PUT';
  }): Promise<void> {
    const { underlying, expiry, strike, optionType } = params;

    const instrument = await this.prisma.instrument.findFirst({
      where: {
        underlying,
        expiry,
        strikePrice: strike,
        optionType,
        isActive: true,
      },
    });

    if (!instrument) {
      throw new Error(
        `Option instrument not found: ${underlying} ${strike} ${optionType} expiry ${expiry.toISOString()}`,
      );
    }

    const subscriptionString = this.subscriptionBuilder.buildStockSubscription({
      exchangeSegment: instrument.exchangeSegment,
      instrumentToken: instrument.instrumentToken,
      symbol: instrument.symbol,
    });

    this.provider.subscribe([subscriptionString]);
    this.logger.log(
      `Subscribed to option: ${underlying} ${strike} ${optionType} (${subscriptionString})`,
    );
  }

  /**
   * Subscribe to market depth data for a specific instrument token.
   */
  async subscribeDepth(token: string): Promise<void> {
    const instrument = await this.prisma.instrument.findFirst({
      where: { instrumentToken: token, isActive: true },
    });

    if (!instrument) {
      throw new Error(`Instrument not found for token: ${token}`);
    }

    // Depth subscriptions use the same format as stock subscriptions
    const subscriptionString = this.subscriptionBuilder.buildStockSubscription({
      exchangeSegment: instrument.exchangeSegment,
      instrumentToken: instrument.instrumentToken,
      symbol: instrument.symbol,
    });

    this.provider.subscribe([subscriptionString]);
    this.logger.log(`Subscribed to depth for token: ${token} (${subscriptionString})`);
  }

  /**
   * Unsubscribe from a specific instrument token.
   * Removes from active subscriptions and clears caches.
   */
  unsubscribe(token: string): void {
    // Find all subscription strings that contain this token
    const activeSubs = this.provider.getActiveSubscriptions();
    const matching = activeSubs.filter((sub) => sub.includes(token));

    if (matching.length > 0) {
      this.provider.unsubscribe(matching);
    }

    // Clear from caches
    this.tickCache.remove(token);
    this.depthCache.remove(token);

    this.logger.log(`Unsubscribed token: ${token}`);
  }

  /**
   * Get the latest tick for a given instrument token.
   */
  getLatestTick(token: string): NormalizedTick | null {
    return this.tickCache.get(token);
  }

  /**
   * Get the latest depth for a given instrument token.
   */
  getLatestDepth(token: string): NormalizedDepth | null {
    return this.depthCache.get(token);
  }

  /**
   * Get all currently active subscription strings.
   */
  getActiveSubscriptions(): string[] {
    return this.provider.getActiveSubscriptions();
  }

  /**
   * Get the current connection status.
   */
  getConnectionStatus(): ConnectionStatus {
    return this.provider.getConnectionStatus();
  }

  // --- Private Methods ---

  /**
   * Wire provider tick/depth/status callbacks to internal handlers.
   */
  private wireProviderCallbacks(): void {
    this.provider.onTick((rawTick: RawHsmTick) => {
      this.handleRawTick(rawTick);
    });

    this.provider.onDepth((rawDepth: RawHsmDepth) => {
      this.handleRawDepth(rawDepth);
    });

    this.provider.onStatusChange((status: ConnectionStatus) => {
      this.handleStatusChange(status);
    });
  }

  /**
   * Handle an incoming raw tick: parse, cache, and emit event.
   */
  private handleRawTick(rawTick: RawHsmTick): void {
    const normalizedTick = parseTick(rawTick);

    if (!normalizedTick) {
      // parseTick already logs warnings for invalid ticks
      return;
    }

    // Store in cache
    this.tickCache.set(normalizedTick.instrumentToken, normalizedTick);

    // Emit event for other consumers (ATM Engine, Gateway, etc.)
    this.eventEmitter.emit(`tick.${normalizedTick.instrumentToken}`, normalizedTick);
    this.eventEmitter.emit('tick', normalizedTick);
  }

  /**
   * Handle an incoming raw depth: parse, cache, and emit event.
   */
  private handleRawDepth(rawDepth: RawHsmDepth): void {
    const normalizedDepth = parseDepth(rawDepth);

    // Store in cache
    this.depthCache.set(normalizedDepth.instrumentToken, normalizedDepth);

    // Emit event for depth consumers
    this.eventEmitter.emit(`depth.${normalizedDepth.instrumentToken}`, normalizedDepth);
    this.eventEmitter.emit('depth', normalizedDepth);
  }

  /**
   * Handle connection status changes from the provider.
   */
  private handleStatusChange(status: ConnectionStatus): void {
    this.logger.log(`Market data provider status changed: ${status}`);
    this.eventEmitter.emit('market-feed.status', status);
  }

  /**
   * Resolve a trading symbol to an instrument from the database.
   */
  private async resolveInstrument(symbol: string): Promise<{
    instrumentToken: string | null;
    exchangeSegment: string | null;
    symbol: string;
    name: string;
  } | null> {
    // Try exact symbol match first
    const instrument = await this.prisma.instrument.findFirst({
      where: {
        OR: [
          { symbol },
          { symbol: { contains: symbol } },
        ],
        isActive: true,
      },
      select: {
        instrumentToken: true,
        exchangeSegment: true,
        symbol: true,
        name: true,
      },
    });

    return instrument;
  }
}
