import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { KiteConnectProvider } from './kite-connect.provider';
import { ConfigService } from '../../config/config.service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KiteConnectProvider', () => {
  let provider: KiteConnectProvider;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Create mock config service
    configService = {
      kiteApiKey: 'test-api-key',
      kiteApiSecret: 'test-api-secret',
    } as any;

    // Mock axios.create to return a mock instance
    const mockAxiosInstance = {
      get: jest.fn(),
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn() },
      },
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KiteConnectProvider,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    provider = module.get<KiteConnectProvider>(KiteConnectProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
    provider.resetCircuitBreaker();
  });

  describe('Circuit Breaker', () => {
    it('should start in CLOSED state', () => {
      const state = provider.getCircuitBreakerState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });

    it('should open circuit after 5 consecutive failures', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      // Mock sleep to avoid actual delays
      jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);

      // Cause 5 failures
      for (let i = 0; i < 5; i++) {
        try {
          await provider.fetchOHLCV('RELIANCE', '1d');
        } catch (error) {
          // Expected to fail
        }
      }

      const state = provider.getCircuitBreakerState();
      expect(state.state).toBe('OPEN');
      expect(state.failureCount).toBe(5);
    }, 10000);

    it('should reject requests immediately when circuit is OPEN', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      // Mock sleep to avoid actual delays
      jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);

      // Cause 5 failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await provider.fetchOHLCV('RELIANCE', '1d');
        } catch (error) {
          // Expected
        }
      }

      // Next request should fail immediately with SERVICE_UNAVAILABLE
      await expect(provider.fetchOHLCV('RELIANCE', '1d')).rejects.toThrow(HttpException);

      try {
        await provider.fetchOHLCV('RELIANCE', '1d');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    }, 10000);

    it('should transition to HALF_OPEN after timeout period', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      // Mock sleep to avoid actual delays
      jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);

      // Cause 5 failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await provider.fetchOHLCV('RELIANCE', '1d');
        } catch (error) {
          // Expected
        }
      }

      expect(provider.getCircuitBreakerState().state).toBe('OPEN');

      // Manually advance time by setting lastFailureTime
      const circuitBreaker = (provider as any).circuitBreaker;
      circuitBreaker.lastFailureTime = Date.now() - 31000; // 31 seconds ago

      // Mock successful response for next attempt
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            candles: [['2024-01-01T00:00:00Z', 2450, 2470, 2445, 2465, 1000000]],
          },
        },
      });

      // Next request should transition to HALF_OPEN and succeed
      await provider.fetchOHLCV('RELIANCE', '1d');

      const state = provider.getCircuitBreakerState();
      expect(state.state).toBe('CLOSED'); // Success in HALF_OPEN closes circuit
      expect(state.failureCount).toBe(0);
    }, 10000);

    it('should reset circuit breaker on manual reset', () => {
      const circuitBreaker = (provider as any).circuitBreaker;
      circuitBreaker.state = 'OPEN';
      circuitBreaker.failureCount = 5;
      circuitBreaker.lastFailureTime = Date.now();

      provider.resetCircuitBreaker();

      const state = provider.getCircuitBreakerState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      expect(state.lastFailureTime).toBeNull();
    });
  });

  describe('Retry with Exponential Backoff', () => {
    it('should retry up to 3 times on failure', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      // Mock sleep to avoid actual delays in tests
      jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);

      try {
        await provider.fetchOHLCV('RELIANCE', '1d');
      } catch (error) {
        // Expected to fail after 3 attempts
      }

      // Should have been called 3 times (initial + 2 retries)
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    it('should succeed if retry succeeds', async () => {
      const mockAxiosInstance = (provider as any).httpClient;

      // Fail first two attempts, succeed on third
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: {
            data: {
              candles: [['2024-01-01T00:00:00Z', 2450, 2470, 2445, 2465, 1000000]],
            },
          },
        });

      // Mock sleep to avoid actual delays
      jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);

      const result = await provider.fetchOHLCV('RELIANCE', '1d');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff delays', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const sleepSpy = jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);

      try {
        await provider.fetchOHLCV('RELIANCE', '1d');
      } catch (error) {
        // Expected
      }

      // Should have called sleep with exponential backoff: 1000ms, 2000ms
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000); // First retry: 1s
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000); // Second retry: 2s
    });
  });

  describe('Error Handling', () => {
    it('should throw UNAUTHORIZED on 401 error', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      const axiosError: any = {
        isAxiosError: true,
        response: {
          status: 401,
          data: 'Invalid API key',
        },
        message: 'Request failed with status code 401',
      };

      // Mock sleep to avoid actual delays
      jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);
      (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValue(axiosError);

      await expect(provider.fetchOHLCV('RELIANCE', '1d')).rejects.toThrow(HttpException);

      try {
        await provider.fetchOHLCV('RELIANCE', '1d');
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect((error as HttpException).message).toContain('authentication');
      }
    }, 10000);

    it('should throw TOO_MANY_REQUESTS on 429 error', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      const axiosError: any = {
        isAxiosError: true,
        response: {
          status: 429,
          data: 'Rate limit exceeded',
        },
        message: 'Request failed with status code 429',
      };

      // Mock sleep to avoid actual delays
      jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);
      (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValue(axiosError);

      await expect(provider.fetchOHLCV('RELIANCE', '1d')).rejects.toThrow(HttpException);

      try {
        await provider.fetchOHLCV('RELIANCE', '1d');
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect((error as HttpException).message).toContain('rate limit');
      }
    }, 10000);

    it('should throw SERVICE_UNAVAILABLE on network error', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      const networkError = new Error('Network error');

      // Mock sleep to avoid actual delays
      jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);
      (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(false);
      mockAxiosInstance.get.mockRejectedValue(networkError);

      await expect(provider.fetchOHLCV('RELIANCE', '1d')).rejects.toThrow(HttpException);

      try {
        await provider.fetchOHLCV('RELIANCE', '1d');
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    }, 10000);
  });

  describe('OHLCV Data Fetching', () => {
    it('should fetch and transform OHLCV data successfully', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      const mockResponse = {
        data: {
          data: {
            candles: [
              ['2024-01-01T00:00:00Z', 2450.0, 2470.0, 2445.0, 2465.0, 1000000],
              ['2024-01-02T00:00:00Z', 2465.0, 2480.0, 2460.0, 2475.0, 1200000],
            ],
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await provider.fetchOHLCV('RELIANCE', '1d');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        open: 2450.0,
        high: 2470.0,
        low: 2445.0,
        close: 2465.0,
        volume: 1000000,
      });
      expect(result[0].timestamp).toBeInstanceOf(Date);
    });

    it('should return empty array for invalid response', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      const result = await provider.fetchOHLCV('RELIANCE', '1d');

      expect(result).toEqual([]);
    });
  });

  describe('Options Chain Fetching', () => {
    it('should fetch options chain for NIFTY', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          // Mock Kite Connect options response
        },
      });

      const result = await provider.fetchOptionsChain('NIFTY');

      expect(result).toBeDefined();
      expect(result.underlying).toBe('NIFTY');
      expect(mockAxiosInstance.get).toHaveBeenCalled();
    });

    it('should fetch options chain for BANKNIFTY', async () => {
      const mockAxiosInstance = (provider as any).httpClient;
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          // Mock Kite Connect options response
        },
      });

      const result = await provider.fetchOptionsChain('BANKNIFTY');

      expect(result).toBeDefined();
      expect(result.underlying).toBe('BANKNIFTY');
      expect(mockAxiosInstance.get).toHaveBeenCalled();
    });
  });
});
