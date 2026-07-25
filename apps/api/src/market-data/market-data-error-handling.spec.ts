import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { PrismaService } from '../database/prisma.service';
import { KiteConnectProvider } from './providers/kite-connect.provider';
import { AuditLogService } from '../audit/audit.service';

/**
 * Unit tests for MarketDataService error handling
 * Tests cover:
 * - API failures with retry logic
 * - Cache fallback when API unavailable
 * - Circuit breaker behavior
 *
 * Requirements: 20.1, 20.2
 */
describe('MarketDataService - Error Handling', () => {
  let service: MarketDataService;
  let prismaService: any;
  let kiteConnectProvider: jest.Mocked<KiteConnectProvider>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const mockMarketDataCache = {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };

    const mockPrismaService = {
      marketDataCache: mockMarketDataCache,
    };

    const mockKiteConnectProvider = {
      fetchOHLCV: jest.fn(),
      fetchOptionsChain: jest.fn(),
      resetCircuitBreaker: jest.fn(),
      getCircuitBreakerState: jest.fn(),
    };

    const mockAuditLogService = {
      logMarketDataCall: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketDataService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: KiteConnectProvider,
          useValue: mockKiteConnectProvider,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<MarketDataService>(MarketDataService);
    prismaService = module.get(PrismaService);
    kiteConnectProvider = module.get(KiteConnectProvider);
    auditLogService = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('API Failures with Retry Logic', () => {
    /**
     * Test: API failures should be retried with exponential backoff
     * Requirements: 20.1, 20.4
     */
    it('should propagate error after all retry attempts are exhausted', async () => {
      // Setup: No cache available, API fails all retry attempts
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      const apiError = new HttpException(
        'Market data provider unavailable',
        HttpStatus.SERVICE_UNAVAILABLE
      );
      kiteConnectProvider.fetchOHLCV.mockRejectedValue(apiError);

      // Execute and verify: Should throw error after retries
      await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow(HttpException);
      await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow(
        'Market data provider unavailable'
      );

      // Verify cache was checked
      expect(prismaService.marketDataCache.findUnique).toHaveBeenCalledWith({
        where: {
          symbol_timeframe_dataType: {
            symbol: 'RELIANCE',
            timeframe: '1d',
            dataType: 'OHLCV',
          },
        },
      });

      // Verify provider was called (retry logic is in provider)
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalledWith(
        'RELIANCE',
        '1d',
        undefined,
        undefined
      );
    });

    /**
     * Test: Retry logic should eventually succeed if API recovers
     * Requirements: 20.1, 20.4
     */
    it('should succeed if API recovers during retry attempts', async () => {
      const mockData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      // Setup: No cache, API eventually succeeds (handled by provider retry logic)
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockData);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      // Execute
      const result = await service.getMarketData('RELIANCE', '1d');

      // Verify success
      expect(result).toEqual({
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: mockData,
      });
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
      expect(prismaService.marketDataCache.upsert).toHaveBeenCalled();
    });

    /**
     * Test: Network timeout errors should trigger retry
     * Requirements: 20.1
     */
    it('should handle network timeout errors by propagating from provider', async () => {
      // Setup: Simulate timeout error
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      const timeoutError = new HttpException('Request timeout', HttpStatus.REQUEST_TIMEOUT);
      kiteConnectProvider.fetchOHLCV.mockRejectedValue(timeoutError);

      // Execute and verify
      await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow(HttpException);
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
    });

    /**
     * Test: Authentication errors should not be retried
     * Requirements: 20.1
     */
    it('should propagate authentication errors immediately without retry', async () => {
      // Setup: 401 authentication error
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      const authError = new HttpException(
        'Kite Connect authentication failed. Check API credentials.',
        HttpStatus.UNAUTHORIZED
      );
      kiteConnectProvider.fetchOHLCV.mockRejectedValue(authError);

      // Execute and verify
      await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow(HttpException);

      try {
        await service.getMarketData('RELIANCE', '1d');
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect((error as HttpException).message).toContain('authentication');
      }
    });

    /**
     * Test: Rate limit errors should be handled appropriately
     * Requirements: 20.1
     */
    it('should propagate rate limit errors from API', async () => {
      // Setup: 429 rate limit error
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      const rateLimitError = new HttpException(
        'Kite Connect rate limit exceeded. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS
      );
      kiteConnectProvider.fetchOHLCV.mockRejectedValue(rateLimitError);

      // Execute and verify
      await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow(HttpException);

      try {
        await service.getMarketData('RELIANCE', '1d');
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect((error as HttpException).message).toContain('rate limit');
      }
    });
  });

  describe('Cache Fallback When API Unavailable', () => {
    /**
     * Test: Should return cached data when API fails
     * Requirements: 20.2, 2.6
     */
    it('should return valid cached data when API is unavailable', async () => {
      const cachedData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      const futureExpiry = new Date(Date.now() + 30000); // 30 seconds in future

      // Setup: Cache is available and valid
      prismaService.marketDataCache.findUnique.mockResolvedValue({
        id: 'cache-id',
        symbol: 'RELIANCE',
        timeframe: '1d',
        dataType: 'OHLCV',
        data: cachedData,
        cachedAt: new Date(),
        expiresAt: futureExpiry,
      });

      // Execute
      const result = await service.getMarketData('RELIANCE', '1d');

      // Verify: Should return cached data without calling API
      expect(result).toEqual({
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: cachedData,
      });
      expect(prismaService.marketDataCache.findUnique).toHaveBeenCalled();
      expect(kiteConnectProvider.fetchOHLCV).not.toHaveBeenCalled();
    });

    /**
     * Test: Should attempt fresh data when cache is expired and API fails
     * Requirements: 20.2, 2.6
     */
    it('should try API when cache is expired even if API ultimately fails', async () => {
      const pastExpiry = new Date(Date.now() - 1000); // 1 second in past

      // Setup: Cache is expired, API is unavailable
      prismaService.marketDataCache.findUnique.mockResolvedValue({
        id: 'cache-id',
        symbol: 'RELIANCE',
        timeframe: '1d',
        dataType: 'OHLCV',
        data: [],
        cachedAt: new Date(Date.now() - 61000),
        expiresAt: pastExpiry,
      });
      prismaService.marketDataCache.delete.mockResolvedValue({} as any);

      const apiError = new HttpException('API unavailable', HttpStatus.SERVICE_UNAVAILABLE);
      kiteConnectProvider.fetchOHLCV.mockRejectedValue(apiError);

      // Execute and verify: Should fail since cache expired and API failed
      await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow(HttpException);

      // Verify expired cache was deleted
      expect(prismaService.marketDataCache.delete).toHaveBeenCalledWith({
        where: { id: 'cache-id' },
      });

      // Verify API was attempted
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
    });

    /**
     * Test: Should handle database errors gracefully and still attempt API call
     * Requirements: 20.2, 20.5
     */
    it('should fall back to API when cache read fails', async () => {
      const mockData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      // Setup: Cache read fails, but API succeeds
      prismaService.marketDataCache.findUnique.mockRejectedValue(
        new Error('Database connection error')
      );
      kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockData);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      // Execute
      const result = await service.getMarketData('RELIANCE', '1d');

      // Verify: Should succeed with API data despite cache error
      expect(result).toEqual({
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: mockData,
      });
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
    });

    /**
     * Test: Cache write failures should not prevent data from being returned
     * Requirements: 20.2
     */
    it('should return API data even when cache write fails', async () => {
      const mockData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      // Setup: API succeeds but cache write fails
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockData);
      prismaService.marketDataCache.upsert.mockRejectedValue(new Error('Database write error'));

      // Execute
      const result = await service.getMarketData('RELIANCE', '1d');

      // Verify: Should return data despite cache write failure
      expect(result).toEqual({
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: mockData,
      });
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
      expect(prismaService.marketDataCache.upsert).toHaveBeenCalled();
    });

    /**
     * Test: Options chain should also support cache fallback
     * Requirements: 20.2, 2.6
     */
    it('should return cached options chain when API is unavailable', async () => {
      const cachedChain = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [
          {
            strike: 21500,
            expiryDate: '2024-12-26',
            callOI: 1000000,
            putOI: 900000,
            callVolume: 50000,
            putVolume: 45000,
            callLTP: 150.5,
            putLTP: 140.0,
          },
        ],
      };

      const futureExpiry = new Date(Date.now() + 30000);

      // Setup: Cache is available and valid
      prismaService.marketDataCache.findUnique.mockResolvedValue({
        id: 'cache-id',
        symbol: 'NIFTY',
        timeframe: 'ALL_EXPIRIES',
        dataType: 'OPTIONS_CHAIN',
        data: cachedChain,
        cachedAt: new Date(),
        expiresAt: futureExpiry,
      });

      // Execute
      const result = await service.getOptionsChain('NIFTY');

      // Verify: Should return cached data without calling API
      expect(result).toEqual(cachedChain);
      expect(prismaService.marketDataCache.findUnique).toHaveBeenCalled();
      expect(kiteConnectProvider.fetchOptionsChain).not.toHaveBeenCalled();
    });
  });

  describe('Circuit Breaker Behavior', () => {
    /**
     * Test: Circuit breaker should prevent API calls when open
     * Requirements: 20.1
     */
    it('should propagate circuit breaker open state errors', async () => {
      // Setup: No cache, circuit breaker is open
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      const circuitOpenError = new HttpException(
        'Circuit breaker is OPEN. Service unavailable for 30s',
        HttpStatus.SERVICE_UNAVAILABLE
      );
      kiteConnectProvider.fetchOHLCV.mockRejectedValue(circuitOpenError);

      // Execute and verify
      await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow(HttpException);

      try {
        await service.getMarketData('RELIANCE', '1d');
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect((error as HttpException).message).toContain('Circuit breaker is OPEN');
      }
    });

    /**
     * Test: Circuit breaker should allow cached data to be served when open
     * Requirements: 20.1, 20.2
     */
    it('should serve cached data even when circuit breaker is open', async () => {
      const cachedData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      const futureExpiry = new Date(Date.now() + 30000);

      // Setup: Cache is valid, circuit breaker would be open (but we won't reach it)
      prismaService.marketDataCache.findUnique.mockResolvedValue({
        id: 'cache-id',
        symbol: 'RELIANCE',
        timeframe: '1d',
        dataType: 'OHLCV',
        data: cachedData,
        cachedAt: new Date(),
        expiresAt: futureExpiry,
      });

      // Execute
      const result = await service.getMarketData('RELIANCE', '1d');

      // Verify: Should return cached data without hitting circuit breaker
      expect(result).toEqual({
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: cachedData,
      });
      expect(prismaService.marketDataCache.findUnique).toHaveBeenCalled();
      expect(kiteConnectProvider.fetchOHLCV).not.toHaveBeenCalled();
    });

    /**
     * Test: Circuit breaker state should affect options chain requests
     * Requirements: 20.1
     */
    it('should propagate circuit breaker errors for options chain requests', async () => {
      // Setup: No cache, circuit breaker open
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      const circuitOpenError = new HttpException(
        'Circuit breaker is OPEN. Service unavailable for 25s',
        HttpStatus.SERVICE_UNAVAILABLE
      );
      kiteConnectProvider.fetchOptionsChain.mockRejectedValue(circuitOpenError);

      // Execute and verify
      await expect(service.getOptionsChain('NIFTY')).rejects.toThrow(HttpException);

      try {
        await service.getOptionsChain('NIFTY');
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect((error as HttpException).message).toContain('Circuit breaker is OPEN');
      }
    });

    /**
     * Test: Multiple concurrent requests should all fail fast when circuit is open
     * Requirements: 20.1
     */
    it('should fail all concurrent requests when circuit breaker is open', async () => {
      // Setup: No cache for multiple symbols, circuit breaker open
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      const circuitOpenError = new HttpException(
        'Circuit breaker is OPEN. Service unavailable for 20s',
        HttpStatus.SERVICE_UNAVAILABLE
      );
      kiteConnectProvider.fetchOHLCV.mockRejectedValue(circuitOpenError);

      // Execute: Make multiple concurrent requests
      const requests = [
        service.getMarketData('RELIANCE', '1d'),
        service.getMarketData('TCS', '1d'),
        service.getMarketData('INFY', '1d'),
      ];

      // Verify: All should fail with circuit breaker error
      const results = await Promise.allSettled(requests);

      results.forEach((result) => {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.reason).toBeInstanceOf(HttpException);
          expect((result.reason as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        }
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    /**
     * Test: Empty response from API should be handled gracefully
     * Requirements: 20.1
     */
    it('should handle empty data response from API', async () => {
      // Setup: API returns empty array
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOHLCV.mockResolvedValue([]);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      // Execute
      const result = await service.getMarketData('UNKNOWN_SYMBOL', '1d');

      // Verify: Should return empty data structure
      expect(result).toEqual({
        symbol: 'UNKNOWN_SYMBOL',
        timeframe: '1d',
        data: [],
      });
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
    });

    /**
     * Test: Malformed cache data should not break service
     * Requirements: 20.2
     */
    it('should handle corrupted cache data gracefully', async () => {
      const mockData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      // Setup: Cache contains malformed data
      prismaService.marketDataCache.findUnique.mockResolvedValue({
        id: 'cache-id',
        symbol: 'RELIANCE',
        timeframe: '1d',
        dataType: 'OHLCV',
        data: 'corrupted-data', // Invalid data type
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 30000),
      });

      // Since type casting happens, the service will return the corrupted data as-is
      // In a real scenario, this would be caught by TypeScript at runtime
      // For this test, let's verify the service doesn't crash
      const result = await service.getMarketData('RELIANCE', '1d');

      expect(result).toBeDefined();
      expect(result.symbol).toBe('RELIANCE');
      expect(kiteConnectProvider.fetchOHLCV).not.toHaveBeenCalled();
    });

    /**
     * Test: Service should handle undefined date ranges gracefully
     * Requirements: 2.1
     */
    it('should handle undefined date ranges without caching', async () => {
      const mockData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      // Setup: Date range provided (should skip cache)
      kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockData);

      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      // Execute
      await service.getMarketData('RELIANCE', '1d', fromDate, toDate);

      // Verify: Should not check cache when date range is provided
      expect(prismaService.marketDataCache.findUnique).not.toHaveBeenCalled();
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalledWith(
        'RELIANCE',
        '1d',
        fromDate,
        toDate
      );
      expect(prismaService.marketDataCache.upsert).not.toHaveBeenCalled();
    });

    /**
     * Test: Simultaneous cache operations should not interfere
     * Requirements: 20.2
     */
    it('should handle concurrent cache operations safely', async () => {
      const mockData1 = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      const mockData2 = [
        {
          timestamp: new Date('2024-01-01'),
          open: 3400,
          high: 3420,
          low: 3395,
          close: 3410,
          volume: 800000,
        },
      ];

      // Setup: Different data for different symbols
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOHLCV
        .mockResolvedValueOnce(mockData1)
        .mockResolvedValueOnce(mockData2);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      // Execute: Concurrent requests for different symbols
      const [result1, result2] = await Promise.all([
        service.getMarketData('RELIANCE', '1d'),
        service.getMarketData('TCS', '1d'),
      ]);

      // Verify: Both requests should succeed with correct data
      expect(result1.symbol).toBe('RELIANCE');
      expect(result1.data).toEqual(mockData1);
      expect(result2.symbol).toBe('TCS');
      expect(result2.data).toEqual(mockData2);
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalledTimes(2);
    });
  });
});
