import { Logger } from '@nestjs/common';
import {
  RawHsmTick,
  RawHsmDepth,
  NormalizedTick,
  NormalizedDepth,
  DepthLevel,
} from './interfaces';

const logger = new Logger('TickParser');

/**
 * Parse a numeric string field to a number, returning the default if invalid.
 */
function parseNumeric(value: string | undefined, defaultValue: number = 0): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Transform a RawHsmTick into a NormalizedTick.
 * Returns null if required fields are missing or invalid.
 */
export function parseTick(raw: RawHsmTick): NormalizedTick | null {
  // Validate required fields
  if (!raw.tk) {
    logger.warn('Invalid tick: missing token (tk)', JSON.stringify(raw));
    return null;
  }

  if (!raw.lp) {
    logger.warn('Invalid tick: missing lastPrice (lp)', JSON.stringify(raw));
    return null;
  }

  const lastPrice = parseFloat(raw.lp);
  if (isNaN(lastPrice) || lastPrice <= 0) {
    logger.warn(
      `Invalid tick: lastPrice must be positive, got "${raw.lp}"`,
      JSON.stringify(raw),
    );
    return null;
  }

  const timestamp = raw.ts ? new Date(raw.ts).toISOString() : new Date().toISOString();

  return {
    instrumentToken: raw.tk,
    lastPrice,
    open: parseNumeric(raw.op),
    high: parseNumeric(raw.hp),
    low: parseNumeric(raw.lop),
    previousClose: parseNumeric(raw.pc),
    volume: parseNumeric(raw.v),
    oi: parseNumeric(raw.oi),
    bid: parseNumeric(raw.bp1),
    ask: parseNumeric(raw.sp1),
    exchange: raw.e ?? '',
    symbol: raw.n ?? '',
    timestamp,
  };
}

/**
 * Transform a RawHsmDepth into a NormalizedDepth.
 * Parses 5 bid levels and 5 ask levels, sorts them, and computes spread.
 */
export function parseDepth(raw: RawHsmDepth): NormalizedDepth {
  const bids: DepthLevel[] = [];
  const asks: DepthLevel[] = [];

  const rawRecord = raw as unknown as Record<string, string | undefined>;

  // Parse 5 bid levels
  for (let i = 1; i <= 5; i++) {
    const price = parseNumeric(rawRecord[`bp${i}`]);
    const quantity = parseNumeric(rawRecord[`bq${i}`]);
    const orders = parseNumeric(rawRecord[`bo${i}`]);
    if (price > 0 || quantity > 0) {
      bids.push({ price, quantity, orders });
    }
  }

  // Parse 5 ask levels
  for (let i = 1; i <= 5; i++) {
    const price = parseNumeric(rawRecord[`sp${i}`]);
    const quantity = parseNumeric(rawRecord[`sq${i}`]);
    const orders = parseNumeric(rawRecord[`so${i}`]);
    if (price > 0 || quantity > 0) {
      asks.push({ price, quantity, orders });
    }
  }

  // Sort bids descending by price, asks ascending by price
  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);

  const bestBid = bids.length > 0 ? bids[0].price : 0;
  const bestAsk = asks.length > 0 ? asks[0].price : 0;
  const spread = bestBid > 0 && bestAsk > 0 ? Math.max(0, bestAsk - bestBid) : 0;

  const timestamp = raw.ts ? new Date(raw.ts).toISOString() : new Date().toISOString();

  return {
    instrumentToken: raw.tk,
    bids,
    asks,
    bestBid,
    bestAsk,
    spread,
    timestamp,
  };
}
