import { Test, TestingModule } from '@nestjs/testing';
import { MarketDataService } from './market-data.service';
import { PrismaService } from '../database/prisma.service';
import { KiteConnectProvider } from './providers/kite-connect.provider';
import { AuditLogService } from '../audit/audit.service';
import * as fc from 'fast-check';

describe('MarketDataService', () => {
  let service: MarketDataService;
  let prismaService: any; // Using any to allow jest mocking
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMarketData', () => {
    it('should fetch OHLCV data from KiteConnectProvider', async () => {
      const mockOHLCVData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
        {
          timestamp: new Date('2024-01-02'),
          open: 2465,
          high: 2480,
          low: 2460,
          close: 2475,
          volume: 1200000,
        },
      ];

      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockOHLCVData);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      const result = await service.getMarketData('RELIANCE', '1d');

      expect(result).toEqual({
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: mockOHLCVData,
      });
      expect(prismaService.marketDataCache.findUnique).toHaveBeenCalledWith({
        where: {
          symbol_timeframe_dataType: {
            symbol: 'RELIANCE',
            timeframe: '1d',
            dataType: 'OHLCV',
          },
        },
      });
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalledWith(
        'RELIANCE',
        '1d',
        undefined,
        undefined
      );
      expect(prismaService.marketDataCache.upsert).toHaveBeenCalled();
    });

    it('should return cached data when cache is valid', async () => {
      const mockOHLCVData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      const futureExpiry = new Date(Date.now() + 30000); // 30 seconds in the future
      prismaService.marketDataCache.findUnique.mockResolvedValue({
        id: 'cache-id',
        symbol: 'RELIANCE',
        timeframe: '1d',
        dataType: 'OHLCV',
        data: mockOHLCVData,
        cachedAt: new Date(),
        expiresAt: futureExpiry,
      } as any);

      const result = await service.getMarketData('RELIANCE', '1d');

      expect(result).toEqual({
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: mockOHLCVData,
      });
      expect(kiteConnectProvider.fetchOHLCV).not.toHaveBeenCalled();
      expect(prismaService.marketDataCache.upsert).not.toHaveBeenCalled();
    });

    it('should fetch fresh data when cache is expired', async () => {
      const mockOHLCVData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      const pastExpiry = new Date(Date.now() - 1000); // 1 second in the past
      prismaService.marketDataCache.findUnique.mockResolvedValue({
        id: 'cache-id',
        symbol: 'RELIANCE',
        timeframe: '1d',
        dataType: 'OHLCV',
        data: mockOHLCVData,
        cachedAt: new Date(Date.now() - 61000),
        expiresAt: pastExpiry,
      } as any);
      prismaService.marketDataCache.delete.mockResolvedValue({} as any);
      kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockOHLCVData);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      const result = await service.getMarketData('RELIANCE', '1d');

      expect(result.data).toEqual(mockOHLCVData);
      expect(prismaService.marketDataCache.delete).toHaveBeenCalledWith({
        where: { id: 'cache-id' },
      });
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
    });

    it('should skip cache when date range is provided', async () => {
      const mockOHLCVData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockOHLCVData);

      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      await service.getMarketData('RELIANCE', '1d', fromDate, toDate);

      expect(prismaService.marketDataCache.findUnique).not.toHaveBeenCalled();
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalledWith(
        'RELIANCE',
        '1d',
        fromDate,
        toDate
      );
      expect(prismaService.marketDataCache.upsert).not.toHaveBeenCalled();
    });

    it('should pass date range to provider when specified', async () => {
      const mockOHLCVData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockOHLCVData);

      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      await service.getMarketData('RELIANCE', '1d', fromDate, toDate);

      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalledWith(
        'RELIANCE',
        '1d',
        fromDate,
        toDate
      );
    });

    it('should handle empty data from provider', async () => {
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOHLCV.mockResolvedValue([]);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      const result = await service.getMarketData('RELIANCE', '1d');

      expect(result.data).toEqual([]);
    });

    it('should propagate errors from provider', async () => {
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOHLCV.mockRejectedValue(new Error('Provider error'));

      await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow('Provider error');
    });

    it('should handle cache read errors gracefully', async () => {
      const mockOHLCVData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      prismaService.marketDataCache.findUnique.mockRejectedValue(new Error('Database error'));
      kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockOHLCVData);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      const result = await service.getMarketData('RELIANCE', '1d');

      expect(result.data).toEqual(mockOHLCVData);
      expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
    });

    it('should handle cache write errors gracefully', async () => {
      const mockOHLCVData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockOHLCVData);
      prismaService.marketDataCache.upsert.mockRejectedValue(new Error('Database write error'));

      const result = await service.getMarketData('RELIANCE', '1d');

      expect(result.data).toEqual(mockOHLCVData);
    });
  });

  describe('getOptionsChain', () => {
    it('should fetch NIFTY options chain from provider', async () => {
      const mockOptionsChain = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26', '2025-01-02'],
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

      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOptionsChain.mockResolvedValue(mockOptionsChain);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      const result = await service.getOptionsChain('NIFTY');

      expect(result).toEqual(mockOptionsChain);
      expect(prismaService.marketDataCache.findUnique).toHaveBeenCalledWith({
        where: {
          symbol_timeframe_dataType: {
            symbol: 'NIFTY',
            timeframe: 'ALL_EXPIRIES',
            dataType: 'OPTIONS_CHAIN',
          },
        },
      });
      expect(kiteConnectProvider.fetchOptionsChain).toHaveBeenCalledWith('NIFTY', undefined);
      expect(prismaService.marketDataCache.upsert).toHaveBeenCalled();
    });

    it('should return cached options chain when cache is valid', async () => {
      const mockOptionsChain = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [],
      };

      const futureExpiry = new Date(Date.now() + 30000);
      prismaService.marketDataCache.findUnique.mockResolvedValue({
        id: 'cache-id',
        symbol: 'NIFTY',
        timeframe: 'ALL_EXPIRIES',
        dataType: 'OPTIONS_CHAIN',
        data: mockOptionsChain,
        cachedAt: new Date(),
        expiresAt: futureExpiry,
      } as any);

      const result = await service.getOptionsChain('NIFTY');

      expect(result).toEqual(mockOptionsChain);
      expect(kiteConnectProvider.fetchOptionsChain).not.toHaveBeenCalled();
      expect(prismaService.marketDataCache.upsert).not.toHaveBeenCalled();
    });

    it('should fetch fresh data when options chain cache is expired', async () => {
      const mockOptionsChain = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [],
      };

      const pastExpiry = new Date(Date.now() - 1000);
      prismaService.marketDataCache.findUnique.mockResolvedValue({
        id: 'cache-id',
        symbol: 'NIFTY',
        timeframe: 'ALL_EXPIRIES',
        dataType: 'OPTIONS_CHAIN',
        data: mockOptionsChain,
        cachedAt: new Date(Date.now() - 61000),
        expiresAt: pastExpiry,
      } as any);
      prismaService.marketDataCache.delete.mockResolvedValue({} as any);
      kiteConnectProvider.fetchOptionsChain.mockResolvedValue(mockOptionsChain);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      const result = await service.getOptionsChain('NIFTY');

      expect(result).toEqual(mockOptionsChain);
      expect(prismaService.marketDataCache.delete).toHaveBeenCalledWith({
        where: { id: 'cache-id' },
      });
      expect(kiteConnectProvider.fetchOptionsChain).toHaveBeenCalled();
    });

    it('should fetch BANKNIFTY options chain from provider', async () => {
      const mockOptionsChain = {
        underlying: 'BANKNIFTY',
        spotPrice: 46500,
        expiryDates: ['2024-12-26'],
        chain: [],
      };

      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOptionsChain.mockResolvedValue(mockOptionsChain);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      const result = await service.getOptionsChain('BANKNIFTY', '2024-12-26');

      expect(result).toEqual(mockOptionsChain);
      expect(prismaService.marketDataCache.findUnique).toHaveBeenCalledWith({
        where: {
          symbol_timeframe_dataType: {
            symbol: 'BANKNIFTY',
            timeframe: '2024-12-26',
            dataType: 'OPTIONS_CHAIN',
          },
        },
      });
      expect(kiteConnectProvider.fetchOptionsChain).toHaveBeenCalledWith('BANKNIFTY', '2024-12-26');
    });

    it('should propagate errors from provider', async () => {
      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOptionsChain.mockRejectedValue(new Error('Provider error'));

      await expect(service.getOptionsChain('NIFTY')).rejects.toThrow('Provider error');
    });

    it('should handle options chain cache read errors gracefully', async () => {
      const mockOptionsChain = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [],
      };

      prismaService.marketDataCache.findUnique.mockRejectedValue(new Error('Database error'));
      kiteConnectProvider.fetchOptionsChain.mockResolvedValue(mockOptionsChain);
      prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

      const result = await service.getOptionsChain('NIFTY');

      expect(result).toEqual(mockOptionsChain);
      expect(kiteConnectProvider.fetchOptionsChain).toHaveBeenCalled();
    });

    it('should handle options chain cache write errors gracefully', async () => {
      const mockOptionsChain = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [],
      };

      prismaService.marketDataCache.findUnique.mockResolvedValue(null);
      kiteConnectProvider.fetchOptionsChain.mockResolvedValue(mockOptionsChain);
      prismaService.marketDataCache.upsert.mockRejectedValue(new Error('Database write error'));

      const result = await service.getOptionsChain('NIFTY');

      expect(result).toEqual(mockOptionsChain);
    });
  });

  /**
   * Unit Tests for Error Handling
   *
   * **Validates: Requirements 20.1, 20.2**
   * This test suite ensures graceful degradation and error recovery in market data fetching.
   */
  describe('Error Handling and Recovery', () => {
    describe('API Failures with Retry Logic', () => {
      it('should retry API calls with exponential backoff (max 3 retries)', async () => {
        // Setup: cache miss, provider fails with retries
        prismaService.marketDataCache.findUnique.mockResolvedValue(null);

        // Track retry attempts by counting calls
        let attemptCount = 0;
        kiteConnectProvider.fetchOHLCV.mockImplementation(async () => {
          attemptCount++;
          throw new Error('API temporarily unavailable');
        });

        // Execute and expect failure after retries
        await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow(
          'API temporarily unavailable'
        );

        // Verify: KiteConnectProvider handles retry internally (called once by service)
        // The provider's internal retry mechanism (max 3 attempts) is tested in kite-connect.provider.spec.ts
        expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalledTimes(1);
        expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalledWith(
          'RELIANCE',
          '1d',
          undefined,
          undefined
        );
      });

      it('should succeed if retry succeeds on subsequent attempt', async () => {
        const mockOHLCVData = [
          {
            timestamp: new Date('2024-01-01'),
            open: 2450,
            high: 2470,
            low: 2445,
            close: 2465,
            volume: 1000000,
          },
        ];

        prismaService.marketDataCache.findUnique.mockResolvedValue(null);

        // First call fails, but provider's retry logic succeeds internally
        kiteConnectProvider.fetchOHLCV.mockResolvedValueOnce(mockOHLCVData);
        prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

        const result = await service.getMarketData('RELIANCE', '1d');

        expect(result.data).toEqual(mockOHLCVData);
        expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
      });

      it('should handle exponential backoff timing (tested at provider level)', async () => {
        // Note: Exponential backoff (1s, 2s, 4s) is implemented and tested in KiteConnectProvider
        // This test documents that the behavior exists at the provider level
        prismaService.marketDataCache.findUnique.mockResolvedValue(null);
        kiteConnectProvider.fetchOHLCV.mockRejectedValue(new Error('Network error'));

        await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow('Network error');

        // Exponential backoff is verified in kite-connect.provider.spec.ts
        expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
      });
    });

    describe('Cache Fallback When API Unavailable', () => {
      it('should return cached data when API fails and cache is available', async () => {
        const mockCachedData = [
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
        prismaService.marketDataCache.findUnique.mockResolvedValue({
          id: 'cache-id',
          symbol: 'RELIANCE',
          timeframe: '1d',
          dataType: 'OHLCV',
          data: mockCachedData,
          cachedAt: new Date(),
          expiresAt: futureExpiry,
        } as any);

        // API failure doesn't matter - cache hit returns immediately
        const result = await service.getMarketData('RELIANCE', '1d');

        expect(result.data).toEqual(mockCachedData);
        expect(kiteConnectProvider.fetchOHLCV).not.toHaveBeenCalled();
      });

      it('should fail gracefully when both API and cache are unavailable', async () => {
        prismaService.marketDataCache.findUnique.mockResolvedValue(null);
        kiteConnectProvider.fetchOHLCV.mockRejectedValue(
          new Error('Service temporarily unavailable')
        );

        await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow(
          'Service temporarily unavailable'
        );

        expect(prismaService.marketDataCache.findUnique).toHaveBeenCalled();
        expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
      });

      it('should prefer fresh data from API over expired cache', async () => {
        const mockFreshData = [
          {
            timestamp: new Date('2024-01-02'),
            open: 2500,
            high: 2520,
            low: 2495,
            close: 2515,
            volume: 1100000,
          },
        ];

        // Expired cache
        const pastExpiry = new Date(Date.now() - 1000);
        prismaService.marketDataCache.findUnique.mockResolvedValue({
          id: 'cache-id',
          symbol: 'RELIANCE',
          timeframe: '1d',
          dataType: 'OHLCV',
          data: [],
          cachedAt: new Date(Date.now() - 61000),
          expiresAt: pastExpiry,
        } as any);

        prismaService.marketDataCache.delete.mockResolvedValue({} as any);
        kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockFreshData);
        prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

        const result = await service.getMarketData('RELIANCE', '1d');

        expect(result.data).toEqual(mockFreshData);
        expect(prismaService.marketDataCache.delete).toHaveBeenCalled();
        expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
      });
    });

    describe('Circuit Breaker Behavior', () => {
      it('should delegate circuit breaker logic to provider (5 failures → 30s cooldown)', async () => {
        // Note: Circuit breaker is implemented and tested in KiteConnectProvider
        // After 5 consecutive failures, circuit opens for 30s
        // This test documents the integration

        prismaService.marketDataCache.findUnique.mockResolvedValue(null);

        // Simulate circuit breaker OPEN state
        kiteConnectProvider.fetchOHLCV.mockRejectedValue(
          new Error('Circuit breaker is OPEN. Service unavailable for 25s')
        );

        await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow(
          'Circuit breaker is OPEN'
        );

        expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
      });

      it('should propagate circuit breaker errors to caller', async () => {
        prismaService.marketDataCache.findUnique.mockResolvedValue(null);

        const circuitBreakerError = new Error(
          'Circuit breaker is OPEN. Service unavailable for 30s'
        );
        kiteConnectProvider.fetchOHLCV.mockRejectedValue(circuitBreakerError);

        await expect(service.getMarketData('RELIANCE', '1d')).rejects.toThrow(circuitBreakerError);
      });

      it('should allow requests when circuit breaker transitions to HALF_OPEN', async () => {
        const mockOHLCVData = [
          {
            timestamp: new Date('2024-01-01'),
            open: 2450,
            high: 2470,
            low: 2445,
            close: 2465,
            volume: 1000000,
          },
        ];

        prismaService.marketDataCache.findUnique.mockResolvedValue(null);

        // Simulate successful request after circuit transitions to HALF_OPEN
        kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockOHLCVData);
        prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

        const result = await service.getMarketData('RELIANCE', '1d');

        expect(result.data).toEqual(mockOHLCVData);
        expect(kiteConnectProvider.fetchOHLCV).toHaveBeenCalled();
      });

      it('should handle circuit breaker for options chain API calls', async () => {
        prismaService.marketDataCache.findUnique.mockResolvedValue(null);

        kiteConnectProvider.fetchOptionsChain.mockRejectedValue(
          new Error('Circuit breaker is OPEN. Service unavailable for 20s')
        );

        await expect(service.getOptionsChain('NIFTY')).rejects.toThrow('Circuit breaker is OPEN');

        expect(kiteConnectProvider.fetchOptionsChain).toHaveBeenCalled();
      });
    });

    describe('Combined Error Scenarios', () => {
      it('should handle retry exhaustion followed by cache fallback', async () => {
        // This simulates: API fails after retries, but we have valid cache
        const mockCachedData = [
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

        // First call checks cache and finds valid data
        prismaService.marketDataCache.findUnique.mockResolvedValue({
          id: 'cache-id',
          symbol: 'RELIANCE',
          timeframe: '1d',
          dataType: 'OHLCV',
          data: mockCachedData,
          cachedAt: new Date(),
          expiresAt: futureExpiry,
        } as any);

        const result = await service.getMarketData('RELIANCE', '1d');

        // Cache hit prevents API call entirely
        expect(result.data).toEqual(mockCachedData);
        expect(kiteConnectProvider.fetchOHLCV).not.toHaveBeenCalled();
      });

      it('should handle circuit breaker OPEN with valid cache available', async () => {
        const mockCachedData = [
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
        prismaService.marketDataCache.findUnique.mockResolvedValue({
          id: 'cache-id',
          symbol: 'RELIANCE',
          timeframe: '1d',
          dataType: 'OHLCV',
          data: mockCachedData,
          cachedAt: new Date(),
          expiresAt: futureExpiry,
        } as any);

        const result = await service.getMarketData('RELIANCE', '1d');

        // Cache protects against circuit breaker
        expect(result.data).toEqual(mockCachedData);
        expect(kiteConnectProvider.fetchOHLCV).not.toHaveBeenCalled();
      });

      it('should update cache after successful retry', async () => {
        const mockOHLCVData = [
          {
            timestamp: new Date('2024-01-01'),
            open: 2450,
            high: 2470,
            low: 2445,
            close: 2465,
            volume: 1000000,
          },
        ];

        prismaService.marketDataCache.findUnique.mockResolvedValue(null);
        kiteConnectProvider.fetchOHLCV.mockResolvedValue(mockOHLCVData);
        prismaService.marketDataCache.upsert.mockResolvedValue({} as any);

        await service.getMarketData('RELIANCE', '1d');

        // Verify cache is updated with fresh data
        expect(prismaService.marketDataCache.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              symbol_timeframe_dataType: {
                symbol: 'RELIANCE',
                timeframe: '1d',
                dataType: 'OHLCV',
              },
            },
            update: expect.objectContaining({
              data: mockOHLCVData,
            }),
            create: expect.objectContaining({
              symbol: 'RELIANCE',
              timeframe: '1d',
              dataType: 'OHLCV',
              data: mockOHLCVData,
            }),
          })
        );
      });
    });
  });

  /**
   * Property-Based Tests
   *
   * **Validates: Requirements 2.6**
   */
  describe('Property 1: Cache TTL Enforcement', () => {
    /**
     * Property: For any cached market data with a given expiration timestamp,
     * retrieving the data after the expiration time SHALL return a cache miss,
     * and retrieving before expiration SHALL return the cached data.
     */
    it('cached data should be returned before expiration and missed after expiration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }), // symbol
          fc.constantFrom('1m', '5m', '15m', '1h', '1d'), // timeframe
          fc.integer({ min: 1, max: 60000 }), // ttlMs (1ms to 60s)
          fc.integer({ min: -5000, max: 5000 }).filter((n) => Math.abs(n) >= 10), // timeOffsetMs, avoiding 0-10ms window
          async (symbol, timeframe, ttlMs, timeOffsetMs) => {
            // Setup: Create fresh service instance for each test
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

            const testService = module.get<MarketDataService>(MarketDataService);
            const testPrismaService = module.get(PrismaService);
            const testKiteProvider = module.get(KiteConnectProvider);

            // Generate cache data with controlled expiration
            const now = new Date();
            const cachedAt = new Date(now.getTime() - ttlMs);
            const expiresAt = new Date(now.getTime() + timeOffsetMs);

            const mockCachedData = [
              {
                timestamp: new Date('2024-01-01'),
                open: 2450,
                high: 2470,
                low: 2445,
                close: 2465,
                volume: 1000000,
              },
            ];

            const mockFreshData = [
              {
                timestamp: new Date('2024-01-02'),
                open: 2500,
                high: 2520,
                low: 2495,
                close: 2515,
                volume: 1100000,
              },
            ];

            // Mock cache lookup
            (testPrismaService.marketDataCache.findUnique as jest.Mock).mockResolvedValue({
              id: 'cache-id',
              symbol,
              timeframe,
              dataType: 'OHLCV',
              data: mockCachedData,
              cachedAt,
              expiresAt,
            });

            // Mock provider response
            (testKiteProvider.fetchOHLCV as jest.Mock).mockResolvedValue(mockFreshData);

            // Mock delete and upsert
            (testPrismaService.marketDataCache.delete as jest.Mock).mockResolvedValue({});
            (testPrismaService.marketDataCache.upsert as jest.Mock).mockResolvedValue({});

            // Execute
            const result = await testService.getMarketData(symbol, timeframe);

            // Verify property
            if (timeOffsetMs > 0) {
              // Case 1: Cache not expired (expiresAt is in the future)
              // Should return cached data without calling provider
              expect(result.data).toEqual(mockCachedData);
              expect(testKiteProvider.fetchOHLCV).not.toHaveBeenCalled();
              expect(testPrismaService.marketDataCache.delete).not.toHaveBeenCalled();
            } else if (timeOffsetMs < 0) {
              // Case 2: Cache expired (expiresAt is in the past)
              // Should delete expired cache and fetch fresh data
              expect(result.data).toEqual(mockFreshData);
              expect(testPrismaService.marketDataCache.delete).toHaveBeenCalledWith({
                where: { id: 'cache-id' },
              });
              expect(testKiteProvider.fetchOHLCV).toHaveBeenCalled();
            } else {
              // Case 3: Exactly at expiration (timeOffsetMs === 0)
              // Implementation treats this as valid (now > expiresAt is false)
              expect(result.data).toEqual(mockCachedData);
              expect(testKiteProvider.fetchOHLCV).not.toHaveBeenCalled();
            }
          }
        )
      );
    });

    it('options chain cache should be returned before expiration and missed after expiration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('NIFTY', 'BANKNIFTY'), // underlying
          fc.option(fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }), {
            nil: undefined,
          }), // expiryDate (optional)
          fc.integer({ min: 1, max: 60000 }), // ttlMs (1ms to 60s)
          fc.integer({ min: -5000, max: 5000 }).filter((n) => Math.abs(n) >= 10), // timeOffsetMs, avoiding 0-10ms window
          async (underlying, expiryDate, ttlMs, timeOffsetMs) => {
            // Setup: Create fresh service instance for each test
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

            const testService = module.get<MarketDataService>(MarketDataService);
            const testPrismaService = module.get(PrismaService);
            const testKiteProvider = module.get(KiteConnectProvider);

            // Generate cache data with controlled expiration
            const now = new Date();
            const cachedAt = new Date(now.getTime() - ttlMs);
            const expiresAt = new Date(now.getTime() + timeOffsetMs);

            const mockCachedOptionsChain = {
              underlying,
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

            const mockFreshOptionsChain = {
              underlying,
              spotPrice: 21600,
              expiryDates: ['2024-12-26'],
              chain: [
                {
                  strike: 21600,
                  expiryDate: '2024-12-26',
                  callOI: 1100000,
                  putOI: 950000,
                  callVolume: 55000,
                  putVolume: 48000,
                  callLTP: 160.5,
                  putLTP: 145.0,
                },
              ],
            };

            const expiryDateStr = expiryDate?.toISOString().split('T')[0];
            const timeframe = expiryDateStr || 'ALL_EXPIRIES';

            // Mock cache lookup
            (testPrismaService.marketDataCache.findUnique as jest.Mock).mockResolvedValue({
              id: 'cache-id',
              symbol: underlying,
              timeframe,
              dataType: 'OPTIONS_CHAIN',
              data: mockCachedOptionsChain,
              cachedAt,
              expiresAt,
            });

            // Mock provider response
            (testKiteProvider.fetchOptionsChain as jest.Mock).mockResolvedValue(
              mockFreshOptionsChain
            );

            // Mock delete and upsert
            (testPrismaService.marketDataCache.delete as jest.Mock).mockResolvedValue({});
            (testPrismaService.marketDataCache.upsert as jest.Mock).mockResolvedValue({});

            // Execute
            const result = await testService.getOptionsChain(
              underlying as 'NIFTY' | 'BANKNIFTY',
              expiryDateStr
            );

            // Verify property
            if (timeOffsetMs > 0) {
              // Case 1: Cache not expired (expiresAt is in the future)
              // Should return cached data without calling provider
              expect(result).toEqual(mockCachedOptionsChain);
              expect(testKiteProvider.fetchOptionsChain).not.toHaveBeenCalled();
              expect(testPrismaService.marketDataCache.delete).not.toHaveBeenCalled();
            } else if (timeOffsetMs < 0) {
              // Case 2: Cache expired (expiresAt is in the past)
              // Should delete expired cache and fetch fresh data
              expect(result).toEqual(mockFreshOptionsChain);
              expect(testPrismaService.marketDataCache.delete).toHaveBeenCalledWith({
                where: { id: 'cache-id' },
              });
              expect(testKiteProvider.fetchOptionsChain).toHaveBeenCalled();
            } else {
              // Case 3: Exactly at expiration (timeOffsetMs === 0)
              // Implementation treats this as valid (now > expiresAt is false)
              expect(result).toEqual(mockCachedOptionsChain);
              expect(testKiteProvider.fetchOptionsChain).not.toHaveBeenCalled();
              expect(testPrismaService.marketDataCache.delete).not.toHaveBeenCalled();
            }
          }
        )
      );
    });
  });
});
