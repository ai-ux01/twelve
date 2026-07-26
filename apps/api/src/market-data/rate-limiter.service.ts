import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

/**
 * Token-bucket rate limiter for broker API requests.
 * Throttles outbound requests to stay within the configured requests-per-second limit.
 */
@Injectable()
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;

  constructor(private readonly configService: ConfigService) {
    this.maxTokens = configService.brokerRateLimitRps;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token. Awaits until a token is available.
   * Refills tokens based on elapsed time since last refill.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }

    // No tokens available — wait until one becomes available
    const waitMs = (1 / this.maxTokens) * 1000;
    await this.sleep(waitMs);

    // After waiting, refill and consume
    this.refill();
    this.tokens -= 1;
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   * Tokens accumulate at a rate of maxTokens per second.
   */
  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;

    if (elapsedMs <= 0) {
      return;
    }

    const tokensToAdd = (elapsedMs / 1000) * this.maxTokens;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
