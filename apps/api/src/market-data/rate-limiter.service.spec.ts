import { RateLimiter } from './rate-limiter.service';
import { ConfigService } from '../config/config.service';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  const mockConfigService = {
    brokerRateLimitRps: 10,
  } as unknown as ConfigService;

  beforeEach(() => {
    rateLimiter = new RateLimiter(mockConfigService);
  });

  it('should be defined', () => {
    expect(rateLimiter).toBeDefined();
  });

  it('should allow immediate acquisition when tokens are available', async () => {
    const start = Date.now();
    await rateLimiter.acquire();
    const elapsed = Date.now() - start;
    // Should return nearly instantly
    expect(elapsed).toBeLessThan(50);
  });

  it('should allow up to maxTokens acquisitions immediately', async () => {
    const start = Date.now();
    // Acquire all 10 tokens
    for (let i = 0; i < 10; i++) {
      await rateLimiter.acquire();
    }
    const elapsed = Date.now() - start;
    // All 10 should be near-instant
    expect(elapsed).toBeLessThan(100);
  });

  it('should block when tokens are exhausted', async () => {
    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      await rateLimiter.acquire();
    }

    // Next acquire should wait
    const start = Date.now();
    await rateLimiter.acquire();
    const elapsed = Date.now() - start;
    // Should have waited approximately 100ms (1/10 second for 10 RPS)
    expect(elapsed).toBeGreaterThanOrEqual(80);
    expect(elapsed).toBeLessThan(200);
  });

  it('should refill tokens over time', async () => {
    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      await rateLimiter.acquire();
    }

    // Wait for refill (200ms should give ~2 tokens at 10 RPS)
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Should be able to acquire without blocking
    const start = Date.now();
    await rateLimiter.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('should respect configurable rate limit', async () => {
    const slowConfig = {
      brokerRateLimitRps: 2,
    } as unknown as ConfigService;
    const slowLimiter = new RateLimiter(slowConfig);

    // Exhaust 2 tokens
    await slowLimiter.acquire();
    await slowLimiter.acquire();

    // Next acquire should wait ~500ms (1/2 second for 2 RPS)
    const start = Date.now();
    await slowLimiter.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(400);
    expect(elapsed).toBeLessThan(700);
  });
});
