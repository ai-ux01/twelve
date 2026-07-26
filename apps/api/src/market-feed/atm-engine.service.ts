import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';
import { MarketFeedConfig } from './market-feed.config';
import { MarketDataManager } from './market-data-manager.service';
import { NormalizedTick } from './interfaces';

@Injectable()
export class ATMEngine {
  private readonly logger = new Logger(ATMEngine.name);

  /** Map of underlying → current ATM strike price */
  private currentATM: Map<string, number> = new Map();

  /** Configurable number of strikes above/below ATM to subscribe */
  private readonly strikeRange: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: MarketFeedConfig,
    private readonly marketDataManager: MarketDataManager,
  ) {
    this.strikeRange = this.config.atmStrikeRange;
  }

  /**
   * Listens to all tick events and recalculates ATM when a spot price for an underlying changes.
   * This is triggered by EventEmitter2 'tick' events emitted by MarketDataManager.
   */
  @OnEvent('tick')
  async onSpotTick(tick: NormalizedTick): Promise<void> {
    // Determine if this tick is for an underlying instrument (equity/index)
    const underlying = await this.resolveUnderlying(tick.instrumentToken);
    if (!underlying) return;

    await this.recalculateATM(underlying, tick.lastPrice);
  }

  /**
   * Calculate the ATM strike as the strike price closest to the current spot price.
   * Returns the strike that minimizes |strike - spot|.
   */
  calculateATM(spotPrice: number, availableStrikes: number[]): number | null {
    if (availableStrikes.length === 0) return null;

    let bestStrike = availableStrikes[0];
    let minDistance = Math.abs(bestStrike - spotPrice);

    for (const strike of availableStrikes) {
      const distance = Math.abs(strike - spotPrice);
      if (distance < minDistance) {
        minDistance = distance;
        bestStrike = strike;
      }
    }

    return bestStrike;
  }

  /**
   * Get the current ATM strike for an underlying.
   */
  getATMStrike(underlying: string): number | null {
    return this.currentATM.get(underlying) ?? null;
  }

  /**
   * Rebalance subscriptions when ATM changes.
   * Unsubscribes from strikes that fall outside the new range,
   * and subscribes to newly included strikes.
   * Range is ±N strikes around ATM for both CALL and PUT.
   */
  async rebalanceSubscriptions(
    underlying: string,
    newATM: number,
    oldATM: number | null,
  ): Promise<void> {
    const availableStrikes = await this.getAvailableStrikes(underlying);
    if (availableStrikes.length === 0) {
      this.logger.warn(
        `No contracts found for underlying ${underlying} — skipping rebalance`,
      );
      return;
    }

    const newRange = this.getStrikeRange(newATM, availableStrikes);
    const oldRange = oldATM
      ? this.getStrikeRange(oldATM, availableStrikes)
      : [];

    // Determine strikes to unsubscribe (in old range but not new range)
    const toUnsubscribe = oldRange.filter((s) => !newRange.includes(s));
    // Determine strikes to subscribe (in new range but not old range)
    const toSubscribe = newRange.filter((s) => !oldRange.includes(s));

    // Unsubscribe old strikes (both CALL and PUT)
    for (const strike of toUnsubscribe) {
      await this.unsubscribeOption(underlying, strike, 'CALL');
      await this.unsubscribeOption(underlying, strike, 'PUT');
    }

    // Subscribe new strikes (both CALL and PUT)
    for (const strike of toSubscribe) {
      await this.subscribeOption(underlying, strike, 'CALL');
      await this.subscribeOption(underlying, strike, 'PUT');
    }

    if (toSubscribe.length > 0 || toUnsubscribe.length > 0) {
      this.logger.log(
        `ATM rebalanced for ${underlying}: ATM=${newATM}, subscribed ${toSubscribe.length} strikes, unsubscribed ${toUnsubscribe.length} strikes`,
      );
    }
  }

  // --- Private Methods ---

  /**
   * Recalculate ATM for an underlying given a new spot price.
   * Only rebalances when ATM actually changes.
   */
  private async recalculateATM(
    underlying: string,
    spotPrice: number,
  ): Promise<void> {
    const availableStrikes = await this.getAvailableStrikes(underlying);

    if (availableStrikes.length === 0) {
      this.logger.warn(
        `No option contracts found for underlying ${underlying} — cannot calculate ATM`,
      );
      return;
    }

    const newATM = this.calculateATM(spotPrice, availableStrikes);
    if (newATM === null) return;

    const oldATM = this.currentATM.get(underlying) ?? null;

    // Only rebalance when ATM actually changes
    if (oldATM === newATM) return;

    this.currentATM.set(underlying, newATM);
    await this.rebalanceSubscriptions(underlying, newATM, oldATM);
  }

  /**
   * Resolve an instrument token to an underlying symbol.
   * Returns null if the token is not an equity/index underlying.
   */
  private async resolveUnderlying(
    instrumentToken: string,
  ): Promise<string | null> {
    const instrument = await this.prisma.instrument.findFirst({
      where: {
        instrumentToken,
        isActive: true,
        optionType: null, // Only equities/indices (not options themselves)
      },
      select: { symbol: true, underlying: true, name: true },
    });

    if (!instrument) return null;

    // Use the underlying field if available, otherwise the symbol/name
    return instrument.underlying || instrument.symbol;
  }

  /**
   * Get all available strike prices for an underlying from the Instrument table.
   * Filters to active instruments with a future expiry (nearest expiry).
   */
  private async getAvailableStrikes(underlying: string): Promise<number[]> {
    const now = new Date();

    const instruments = await this.prisma.instrument.findMany({
      where: {
        underlying,
        isActive: true,
        optionType: { not: null },
        expiry: { gte: now },
        strikePrice: { not: null },
      },
      select: { strikePrice: true, expiry: true },
      orderBy: { expiry: 'asc' },
    });

    if (instruments.length === 0) return [];

    // Get the nearest expiry
    const nearestExpiry = instruments[0].expiry;

    // Filter to only the nearest expiry and collect unique strikes
    const strikes = new Set<number>();
    for (const inst of instruments) {
      if (
        inst.expiry &&
        nearestExpiry &&
        inst.expiry.getTime() === nearestExpiry.getTime() &&
        inst.strikePrice !== null
      ) {
        strikes.add(inst.strikePrice);
      }
    }

    return Array.from(strikes).sort((a, b) => a - b);
  }

  /**
   * Get the range of strikes (±N) around an ATM strike from the available strikes.
   */
  private getStrikeRange(atm: number, availableStrikes: number[]): number[] {
    const sorted = [...availableStrikes].sort((a, b) => a - b);
    const atmIndex = sorted.indexOf(atm);

    if (atmIndex === -1) {
      // ATM not in available strikes — find the closest
      let closestIdx = 0;
      let minDist = Math.abs(sorted[0] - atm);
      for (let i = 1; i < sorted.length; i++) {
        const dist = Math.abs(sorted[i] - atm);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      const startIdx = Math.max(0, closestIdx - this.strikeRange);
      const endIdx = Math.min(sorted.length - 1, closestIdx + this.strikeRange);
      return sorted.slice(startIdx, endIdx + 1);
    }

    const startIdx = Math.max(0, atmIndex - this.strikeRange);
    const endIdx = Math.min(sorted.length - 1, atmIndex + this.strikeRange);
    return sorted.slice(startIdx, endIdx + 1);
  }

  /**
   * Subscribe to an option contract via MarketDataManager.
   */
  private async subscribeOption(
    underlying: string,
    strike: number,
    optionType: 'CALL' | 'PUT',
  ): Promise<void> {
    try {
      const now = new Date();
      const instrument = await this.prisma.instrument.findFirst({
        where: {
          underlying,
          strikePrice: strike,
          optionType,
          isActive: true,
          expiry: { gte: now },
        },
        orderBy: { expiry: 'asc' },
      });

      if (!instrument) {
        this.logger.warn(
          `No contract found for ${underlying} ${strike} ${optionType} — skipping subscribe`,
        );
        return;
      }

      await this.marketDataManager.subscribeOption({
        underlying,
        expiry: instrument.expiry!,
        strike,
        optionType,
      });
    } catch (error) {
      this.logger.error(
        `Failed to subscribe option ${underlying} ${strike} ${optionType}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Unsubscribe from an option contract.
   */
  private async unsubscribeOption(
    underlying: string,
    strike: number,
    optionType: 'CALL' | 'PUT',
  ): Promise<void> {
    try {
      const now = new Date();
      const instrument = await this.prisma.instrument.findFirst({
        where: {
          underlying,
          strikePrice: strike,
          optionType,
          isActive: true,
          expiry: { gte: now },
        },
        select: { instrumentToken: true },
        orderBy: { expiry: 'asc' },
      });

      if (instrument?.instrumentToken) {
        this.marketDataManager.unsubscribe(instrument.instrumentToken);
      }
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe option ${underlying} ${strike} ${optionType}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
