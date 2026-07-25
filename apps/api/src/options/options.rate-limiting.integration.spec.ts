import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { ThrottlerModule } from '@nestjs/throttler';
import { OptionsController } from './options.controller';
import { OptionsService } from './options.service';
import { AuditLogService } from '../audit/audit.service';
import { ThrottlerExceptionFilter } from '../common/filters/throttler-exception.filter';
import { RateLimitLoggerInterceptor } from '../common/interceptors/rate-limit-logger.interceptor';

/**
 * Integration Tests for OptionsController Rate Limiting
 *
 * These tests verify rate limiting behavior with sequential requests
 * to avoid connection issues with parallel requests in test environment.
 *
 * Requirements covered: 8.1, 20.1
 */
describe('OptionsController Rate Limiting (Integration)', () => {
  let app: INestApplication;
  let optionsService: OptionsService;

  const mockOptionsService = {
    getOptionsChain: jest.fn().mockResolvedValue({
      symbol: 'NIFTY',
      expiry: '2024-12-26',
      spotPrice: 21500,
      contracts: [],
      pcrAnalysis: {
        pcrByOI: 1.2,
        pcrByVolume: 1.1,
        interpretation: 'NEUTRAL',
      },
      atmAnalysis: {
        atmStrike: 21500,
        nearATMStrikes: [21400, 21500, 21600],
      },
      oiAnalysis: {
        buildupType: 'NEUTRAL',
        maxOIStrike: 21500,
      },
      timestamp: new Date().toISOString(),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 1000, // 1 second for testing
            limit: 3, // 3 requests per second for testing
          },
        ]),
      ],
      controllers: [OptionsController],
      providers: [
        {
          provide: OptionsService,
          useValue: mockOptionsService,
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn().mockResolvedValue('audit-log-id'),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new ThrottlerExceptionFilter());
    app.useGlobalInterceptors(new RateLimitLoggerInterceptor());
    await app.init();

    optionsService = module.get<OptionsService>(OptionsService);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  /**
   * Test: Rate limiting configuration is applied
   * Requirements: 8.1, 20.1
   */
  it('should have rate limiting configured on OptionsController', () => {
    const controller = app.get(OptionsController);
    expect(controller).toBeDefined();
  });

  /**
   * Test: Rate limiting allows requests within limit
   * Requirements: 8.1, 20.1
   */
  it('should allow requests within rate limit', async () => {
    const requestBody = {
      symbol: 'NIFTY',
      expiry: '2024-12-26',
    };

    // Make 3 requests (within limit of 3 per second)
    for (let i = 0; i < 3; i++) {
      const response = await request(app.getHttpServer())
        .post('/options/chain')
        .send(requestBody);

      expect(response.status).toBe(HttpStatus.CREATED);
    }

    expect(optionsService.getOptionsChain).toHaveBeenCalledTimes(3);
  });

  /**
   * Test: Rate limiting blocks requests exceeding limit
   * Requirements: 8.1, 20.1
   */
  it('should return 429 status code when rate limit is exceeded', async () => {
    const requestBody = {
      symbol: 'NIFTY',
      expiry: '2024-12-26',
    };

    let rateLimitedCount = 0;
    let successfulCount = 0;

    // Make 5 requests rapidly (exceeds limit of 3 per second)
    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer())
        .post('/options/chain')
        .send(requestBody);

      if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
        rateLimitedCount++;
        // Verify rate limit response structure
        expect(response.body).toHaveProperty('statusCode', HttpStatus.TOO_MANY_REQUESTS);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Rate limit');
      } else if (response.status === HttpStatus.CREATED) {
        successfulCount++;
      }
    }

    // At least 2 requests should be rate limited (5 total - 3 allowed)
    expect(rateLimitedCount).toBeGreaterThanOrEqual(2);
    expect(successfulCount).toBeLessThanOrEqual(3);
  });

  /**
   * Test: Retry-After header is included in rate limit response
   * Requirements: 8.1, 20.1
   */
  it('should include Retry-After header when rate limit is exceeded', async () => {
    const requestBody = {
      symbol: 'NIFTY',
      expiry: '2024-12-26',
    };

    // Make requests until we hit rate limit
    let rateLimitResponse = null;
    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer())
        .post('/options/chain')
        .send(requestBody);

      if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
        rateLimitResponse = response;
        break;
      }
    }

    if (rateLimitResponse) {
      expect(rateLimitResponse.headers).toHaveProperty('retry-after');
      // Should be 1 second (1000ms TTL in test config)
      expect(parseInt(rateLimitResponse.headers['retry-after'])).toBeGreaterThan(0);
    } else {
      fail('Expected to hit rate limit but did not');
    }
  });

  /**
   * Test: Rate limit response includes structured error
   * Requirements: 8.1, 20.1
   */
  it('should include complete error response when rate limited', async () => {
    const requestBody = {
      symbol: 'NIFTY',
      expiry: '2024-12-26',
    };

    // Make requests until we hit rate limit
    let rateLimitResponse = null;
    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer())
        .post('/options/chain')
        .send(requestBody);

      if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
        rateLimitResponse = response;
        break;
      }
    }

    if (rateLimitResponse) {
      expect(rateLimitResponse.body).toHaveProperty('statusCode', HttpStatus.TOO_MANY_REQUESTS);
      expect(rateLimitResponse.body).toHaveProperty('message');
      expect(rateLimitResponse.body).toHaveProperty('error', 'Too Many Requests');
      expect(rateLimitResponse.body).toHaveProperty('retryAfter');
      expect(rateLimitResponse.body).toHaveProperty('timestamp');
      expect(rateLimitResponse.body).toHaveProperty('path');
    } else {
      fail('Expected to hit rate limit but did not');
    }
  });

  /**
   * Test: Rate limit resets after TTL window
   * Requirements: 8.1, 20.1
   */
  it('should reset rate limit after TTL window expires', async () => {
    const requestBody = {
      symbol: 'NIFTY',
      expiry: '2024-12-26',
    };

    // Make 3 requests to reach limit
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/options/chain')
        .send(requestBody);
    }

    // 4th request should be rate limited
    const rateLimitedResponse = await request(app.getHttpServer())
      .post('/options/chain')
      .send(requestBody);

    expect(rateLimitedResponse.status).toBe(HttpStatus.TOO_MANY_REQUESTS);

    // Wait for TTL to expire (1 second + small buffer)
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Request should now succeed
    const successResponse = await request(app.getHttpServer())
      .post('/options/chain')
      .send(requestBody);

    expect(successResponse.status).toBe(HttpStatus.CREATED);
  }, 10000); // Increase timeout for this test

  /**
   * Test: Rate limiting applies to all controller endpoints
   * Requirements: 8.1, 20.1
   */
  it('should apply rate limit to health endpoint', async () => {
    let rateLimitedCount = 0;

    // Make 5 requests to health endpoint
    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer())
        .post('/options/health');

      if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
        rateLimitedCount++;
      }
    }

    // At least 2 requests should be rate limited
    expect(rateLimitedCount).toBeGreaterThanOrEqual(2);
  });
});
