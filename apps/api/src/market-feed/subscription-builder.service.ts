import { Injectable } from '@nestjs/common';

export interface Instrument {
  exchange?: string;
  exchangeSegment?: string | null;
  instrumentToken?: string | null;
  symbol?: string;
  displaySymbol?: string;
}

const MAX_SCRIPS = 200;
const MAX_CHANNELS = 16;

@Injectable()
export class SubscriptionBuilder {
  /**
   * Build subscription string for a stock instrument.
   * Format: {exchangeSegment}|{instrumentToken}&1
   */
  buildStockSubscription(instrument: Instrument): string {
    this.validate(instrument);
    return `${instrument.exchangeSegment}|${instrument.instrumentToken}&1`;
  }

  /**
   * Build subscription string for an index instrument.
   * Format: {exchangeSegment}|{displaySymbol}&1
   */
  buildIndexSubscription(instrument: Instrument): string {
    if (!instrument.exchangeSegment) {
      throw new Error(
        'Instrument is missing required field: exchangeSegment',
      );
    }
    const displaySymbol = instrument.displaySymbol ?? instrument.symbol;
    if (!displaySymbol) {
      throw new Error(
        'Instrument is missing required field: displaySymbol or symbol',
      );
    }
    return `${instrument.exchangeSegment}|${displaySymbol}&1`;
  }

  /**
   * Build subscription strings for a batch of instruments.
   */
  buildBatch(instruments: Instrument[]): string[] {
    return instruments.map((inst) => this.buildStockSubscription(inst));
  }

  /**
   * Validate that an instrument has the required fields for subscription building.
   * Throws if exchange or instrumentToken is missing.
   */
  validate(instrument: Instrument): void {
    if (!instrument.exchangeSegment && !instrument.exchange) {
      throw new Error(
        'Instrument is missing required field: exchangeSegment or exchange',
      );
    }
    if (!instrument.instrumentToken) {
      throw new Error(
        'Instrument is missing required field: instrumentToken',
      );
    }
  }

  /**
   * Deduplicate subscription strings, returning only unique values.
   */
  deduplicate(subscriptions: string[]): string[] {
    return [...new Set(subscriptions)];
  }

  /**
   * Check that adding new subscriptions doesn't exceed HSM protocol limits.
   * Throws if total scrips > 200 or total channels > 16.
   */
  checkLimits(currentCount: number, addingCount: number): void {
    const total = currentCount + addingCount;
    if (total > MAX_SCRIPS) {
      throw new Error(
        `Subscription limit exceeded: ${total} scrips exceeds maximum of ${MAX_SCRIPS}`,
      );
    }
    if (addingCount > MAX_CHANNELS) {
      throw new Error(
        `Channel limit exceeded: ${addingCount} exceeds maximum of ${MAX_CHANNELS} channels`,
      );
    }
  }
}
