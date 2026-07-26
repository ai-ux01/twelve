import { Injectable } from '@nestjs/common';
import { NormalizedDepth } from './interfaces';

const MAX_DEPTH_LEVELS = 5;

@Injectable()
export class DepthCache {
  private readonly latestDepths: Map<string, NormalizedDepth> = new Map();

  set(token: string, depth: NormalizedDepth): void {
    const normalized = this.normalize(depth);
    this.latestDepths.set(token, normalized);
  }

  get(token: string): NormalizedDepth | null {
    return this.latestDepths.get(token) ?? null;
  }

  remove(token: string): void {
    this.latestDepths.delete(token);
  }

  private normalize(depth: NormalizedDepth): NormalizedDepth {
    // Sort bids descending by price, asks ascending by price
    const bids = [...depth.bids]
      .sort((a, b) => b.price - a.price)
      .slice(0, MAX_DEPTH_LEVELS);

    const asks = [...depth.asks]
      .sort((a, b) => a.price - b.price)
      .slice(0, MAX_DEPTH_LEVELS);

    const bestBid = bids.length > 0 ? bids[0].price : 0;
    const bestAsk = asks.length > 0 ? asks[0].price : 0;
    const spread = Math.max(0, bestAsk - bestBid);

    return {
      instrumentToken: depth.instrumentToken,
      bids,
      asks,
      bestBid,
      bestAsk,
      spread,
      timestamp: depth.timestamp,
    };
  }
}
