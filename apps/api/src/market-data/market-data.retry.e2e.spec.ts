import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { KiteConnectProvider } from './providers/kite-connect.provider';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';

/**
 * End-to-End Integration Test for Exponential Backoff Retry
 * Task 24.1: Verify exponential backoff retry for Market Data API works end-to-end
 *
 * This test verifies that:
 * 1. Retry mechanism triggers on transient failures
 * 2. Exponential backoff delays are applied (1s, 2s, 4s)
 * 3. Circuit breaker prevents cascading failures
 * 4. Successful retries return valid data
 * 5. Max retry limit is respected (3 attempts)
 *
 * Requirements: 20.1
 */
describe('Market Data API - Exponential Backoff Retry (E2E)', () => {
  let marketDataService: MarketDataService;
  let kiteConnectProvider: KiteConnectProvider;
  let prismaService: jest.Mocked<PrismaService>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    // Create mocked services
    const mockPrismaService = {
      marketDataCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    };

    const mockAuditLogService = {
      logMarketDataCall: jest.fn().mockResolvedValue({}),
    };

    const mockConfigService = {
      kiteApiKey: 'test-api-key',
      kiteApiSecret: 'test-api-secret',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketDataService,
        KiteConnectProvider,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    marketDataService = module.get<MarketDataService>(MarketDataService);
    kiteConnectProvider = module.get<KiteConnectProvider>(KiteConnectProvider);
    prismaService = module.get(PrismaService);
    auditLogService = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    kiteConnectProvider.resetCircuitBreaker();
  });

  describe('Retry Mechanism', () => {
    it('should retry up to 3 times on transient network errors', async () => {
      // Mock the HTTP client to fail all attempts
      const mockHttpClient = (kiteConnectProvider as any).httpClient;
      mockHttpClient.get = jest.fn().mockRejectedValue(new Error('Network timeout'));

      // Mock sleep to avoid actual delays
      jest.spyOn(kiteConnectProvider as any, 'sleep').mockResolvedValue(undefined);

      // Attempt to fetch market data
      await expect(marketDataService.getMarketData('RELIANCE', '1d')).rejects.toThrow(
        HttpException
      );

      // Verify the HTTP client was called 3 times (initial + 2 retries)
      expect(mockHttpClient.get).toHaveBeenCalledTimes(3);

      // Verify audit log captured the failure
      expect(auditLogService.logMarketDataCall).toHaveBeenCalledWith(
        'fetch_ohlcv',
        'RELIANCE',
        false,
        expect.any(String)
      );
    }, 10000);

    it('should succeed if retry succeeds before max attempts', async () => {
      const mockHttpClient = (kiteConnectProvider as any).httpClient;

      // Fail first 2 attempts, succeed on 3rd
      mockHttpClient.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          data: {
            data: {
              candles: [
                ['2024-01-01T00:00:00Z', 2450, 2470, 2445, 2465, 1000000],
                ['2024-01-02T00:00:00Z', 2465, 2480, 2460, 2475, 1200000],
              ],
            },
          },
        });

      // Mock sleep to avoid actual delays
      jest.spyOn(kiteConnectProvider as any, 'sleep').mockResolvedValue(undefined);

      const result = await marketDataService.getMarketData('RELIANCE', '1d');

      // Verify successful result
      expect(result.symbol).toBe('RELIANCE');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].open).toBe(2450);

      // Verify it took 3 attempts
      expect(mockHttpClient.get).toHaveBeenCalledTimes(3);

      // Verify successful audit log
      expect(auditLogService.logMarketDataCall).toHaveBeenCalledWith(
        'fetch_ohlcv',
        'RELIANCE',
        true,
        undefined,
        { timeframe: '1d', dataPoints: 2 }
      );

      // Verify data was cached
      expect(prismaService.marketDataCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            symbol_timeframe_dataType: {
              symbol: 'RELIANCE',
              timeframe: '1d',
              dataType: 'OHLCV',
            },
          },
        })
      );
    }, 10000);

    it('should apply exponential backoff delays between retries', async () => {
      const mockHttpClient = (kiteConnectProvider as any).httpClient;
      mockHttpClient.get = jest.fn().mockRejectedValue(new Error('Network error'));

      const sleepSpy = jest.spyOn(kiteConnectProvider as any, 'sleep').mockResolvedValue(undefined);

      await expect(marketDataService.getMarketData('RELIANCE', '1d')).rejects.toThrow();

      // Verify exponential backoff: 1000ms, 2000ms
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000); // First retry: 1s delay
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000); // Second retry: 2s delay
    }, 10000);
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit after 5 consecutive failures', async () => {
      const mockHttpClient = (kiteConnectProvider as any).httpClient;
      mockHttpClient.get = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      // Mock sleep to avoid actual delays
      jest.spyOn(kiteConnectProvider as any, 'sleep').mockResolvedValue(undefined);

      // Cause 5 consecutive failures (each attempt makes 3 retries)
      for (let i = 0; i < 5; i++) {
        try {
          await marketDataService.getMarketData('RELIANCE', '1d');
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should now be OPEN
      const circuitState = kiteConnectProvider.getCircuitBreakerState();
      expect(circuitState.state).toBe('OPEN');
      expect(circuitState.failureCount).toBe(5);

      // Next request should fail immediately without retries
      await expect(marketDataService.getMarketData('RELIANCE', '1d')).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.SERVICE_UNAVAILABLE,
        })
      );
    }, 15000);

    it('should transition from OPEN to HALF_OPEN after timeout', async () => {
      const mockHttpClient = (kiteConnectProvider as any).httpClient;
      mockHttpClient.get = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      // Mock sleep to avoid actual delays
      jest.spyOn(kiteConnectProvider as any, 'sleep').mockResolvedValue(undefined);

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await marketDataService.getMarketData('RELIANCE', '1d');
        } catch (error) {
          // Expected
        }
      }

      expect(kiteConnectProvider.getCircuitBreakerState().state).toBe('OPEN');

      // Simulate timeout by manipulating lastFailureTime
      const circuitBreaker = (kiteConnectProvider as any).circuitBreaker;
      circuitBreaker.lastFailureTime = Date.now() - 31000; // 31 seconds ago

      // Mock successful response for next attempt
      mockHttpClient.get = jest.fn().mockResolvedValue({
        data: {
          data: {
            candles: [['2024-01-01T00:00:00Z', 2450, 2470, 2445, 2465, 1000000]],
          },
        },
      });

      // Next request should transition to HALF_OPEN and succeed
      const result = await marketDataService.getMarketData('RELIANCE', '1d');

      expect(result.data).toHaveLength(1);

      // Circuit should now be CLOSED (success in HALF_OPEN closes it)
      const state = kiteConnectProvider.getCircuitBreakerState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    }, 15000);
  });

  describe('Error Type Handling', () => {
    it('should retry on transient errors (5xx, network timeouts)', async () => {
      const mockHttpClient = (kiteConnectProvider as any).httpClient;
      const axiosError: any = {
        isAxiosError: true,
        response: {
          status: 503,
          data: 'Service temporarily unavailable',
        },
        message: 'Request failed with status code 503',
      };

      // Fail twice with 503, then succeed
      mockHttpClient.get = jest
        .fn()
        .mockRejectedValueOnce(axiosError)
        .mockRejectedValueOnce(axiosError)
        .mockResolvedValueOnce({
          data: {
            data: {
              candles: [['2024-01-01T00:00:00Z', 2450, 2470, 2445, 2465, 1000000]],
            },
          },
        });

      jest.spyOn(kiteConnectProvider as any, 'sleep').mockResolvedValue(undefined);

      // Mock axios.isAxiosError
      const axios = require('axios');
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      const result = await marketDataService.getMarketData('RELIANCE', '1d');

      expect(result.data).toHaveLength(1);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should handle rate limit errors (429) with retry', async () => {
      const mockHttpClient = (kiteConnectProvider as any).httpClient;
      const rateLimitError: any = {
        isAxiosError: true,
        response: {
          status: 429,
          data: 'Rate limit exceeded',
        },
        message: 'Request failed with status code 429',
      };

      mockHttpClient.get = jest.fn().mockRejectedValue(rateLimitError);
      jest.spyOn(kiteConnectProvider as any, 'sleep').mockResolvedValue(undefined);

      // Mock axios.isAxiosError
      const axios = require('axios');
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      await expect(marketDataService.getMarketData('RELIANCE', '1d')).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.TOO_MANY_REQUESTS,
        })
      );

      // Should have retried 3 times
      expect(mockHttpClient.get).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  describe('Options Chain Retry', () => {
    it('should apply retry logic to options chain fetching', async () => {
      const mockHttpClient = (kiteConnectProvider as any).httpClient;

      // Fail first attempt, succeed on second
      mockHttpClient.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          data: {
            // Mock options data
          },
        });

      jest.spyOn(kiteConnectProvider as any, 'sleep').mockResolvedValue(undefined);

      const result = await marketDataService.getOptionsChain('NIFTY');

      expect(result.underlying).toBe('NIFTY');
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);

      // Verify successful audit log
      expect(auditLogService.logMarketDataCall).toHaveBeenCalledWith(
        'fetch_options_chain',
        'NIFTY',
        true,
        undefined,
        expect.any(Object)
      );
    }, 10000);
  });

  describe('End-to-End Flow Verification', () => {
    it('should complete full flow: attempt -> retry -> success -> cache -> audit', async () => {
      const mockHttpClient = (kiteConnectProvider as any).httpClient;

      // Simulate one failure then success
      mockHttpClient.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce({
          data: {
            data: {
              candles: [['2024-01-15T09:15:00Z', 21500, 21550, 21480, 21530, 5000000]],
            },
          },
        });

      jest.spyOn(kiteConnectProvider as any, 'sleep').mockResolvedValue(undefined);

      const result = await marketDataService.getMarketData('NIFTY', '5m');

      // Verify successful result
      expect(result.symbol).toBe('NIFTY');
      expect(result.timeframe).toBe('5m');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].open).toBe(21500);

      // Verify retry occurred
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);

      // Verify caching happened
      expect(prismaService.marketDataCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            symbol_timeframe_dataType: {
              symbol: 'NIFTY',
              timeframe: '5m',
              dataType: 'OHLCV',
            },
          },
          update: expect.objectContaining({
            data: expect.arrayContaining([
              expect.objectContaining({
                open: 21500,
              }),
            ]),
          }),
        })
      );

      // Verify audit logging
      expect(auditLogService.logMarketDataCall).toHaveBeenCalledWith(
        'fetch_ohlcv',
        'NIFTY',
        true,
        undefined,
        { timeframe: '5m', dataPoints: 1 }
      );
    }, 10000);
  });
});
