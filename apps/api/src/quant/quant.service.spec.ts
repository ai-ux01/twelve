import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QuantService, QuantAnalysisResult } from './quant.service';
import { OHLCVData } from '../market-data/market-data.service';
import { AuditLogService } from '../audit/audit.service';
import * as fc from 'fast-check';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Helper function to create complete indicator mock
function createCompleteIndicators(basePrice: number = 100): QuantAnalysisResult['indicators'] {
  return {
    rsi: 50,
    macd: { value: 0, signal: 0, histogram: 0 },
    sma_20: basePrice,
    sma_50: basePrice,
    sma_200: basePrice,
    ema_5: basePrice,
    ema_15: basePrice,
    ema_20: basePrice,
    ema_50: basePrice,
    ema_200: basePrice,
    bollingerBands: { upper: basePrice + 10, middle: basePrice, lower: basePrice - 10 },
    adx: 25,
    atr: basePrice * 0.02,
    vwap: basePrice,
    volume_ma: 1000000,
    relative_volume: 1.0,
    week_52_high: basePrice * 1.2,
    week_52_low: basePrice * 0.8,
    momentum: 5.0,
  };
}

describe('QuantService', () => {
  let service: QuantService;
  let mockAxiosInstance: any;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  const mockOHLCVData: OHLCVData[] = [
    {
      timestamp: new Date('2024-01-01T10:00:00Z'),
      open: 100,
      high: 105,
      low: 99,
      close: 103,
      volume: 1000000,
    },
    {
      timestamp: new Date('2024-01-01T11:00:00Z'),
      open: 103,
      high: 107,
      low: 102,
      close: 106,
      volume: 1200000,
    },
  ];

  beforeEach(async () => {
    // Create a mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    // Create mock AuditLogService
    mockAuditLogService = {
      logQuantCall: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuantService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:8000'),
          },
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<QuantService>(QuantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Error Handling - Timeout Handling', () => {
    it('should throw error when analyzeMarketData request times out', async () => {
      // Simulate a timeout error
      const timeoutError = new Error('timeout of 10000ms exceeded');
      timeoutError.name = 'AxiosError';
      (timeoutError as any).code = 'ECONNABORTED';

      mockAxiosInstance.post.mockRejectedValueOnce(timeoutError);

      await expect(service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Quant Engine analysis failed: timeout of 10000ms exceeded'
      );

      // Verify no retry was attempted (should only be called once)
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should throw error when calculateIndicators times out', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      timeoutError.name = 'AxiosError';
      (timeoutError as any).code = 'ECONNABORTED';

      mockAxiosInstance.post.mockRejectedValueOnce(timeoutError);

      await expect(service.calculateIndicators('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Indicator calculation failed: timeout of 10000ms exceeded'
      );

      // Verify no retry was attempted
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should throw error when detectTrendlines times out', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      timeoutError.name = 'AxiosError';
      (timeoutError as any).code = 'ECONNABORTED';

      mockAxiosInstance.post.mockRejectedValueOnce(timeoutError);

      await expect(service.detectTrendlines('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Trendline detection failed: timeout of 10000ms exceeded'
      );

      // Verify no retry was attempted
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling - Malformed Response Handling', () => {
    it('should throw error for response with missing required fields in analyzeMarketData', async () => {
      // Return a response that's missing required fields
      const malformedResponse = {
        data: {
          symbol: 'RELIANCE',
          // Missing timeframe, indicators, supportResistance, trendlines
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(malformedResponse);

      // The service should throw an error when trying to access missing indicators
      await expect(service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Quant Engine analysis failed'
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should handle response with invalid data types gracefully', async () => {
      // Return a response with complete structure but potentially wrong data types
      const malformedResponse = {
        data: {
          symbol: 'RELIANCE',
          timeframe: '1d',
          indicators: {
            rsi: 'invalid', // Should be a number
            macd: { value: 0, signal: 0, histogram: 0 },
            sma_20: 100,
            sma_50: 100,
            sma_200: 100,
            ema_5: 100,
            ema_15: 100,
            ema_20: 100,
            ema_50: 100,
            ema_200: 100,
            bollingerBands: { upper: 110, middle: 100, lower: 90 },
            adx: 25,
            atr: 2,
            vwap: 100,
            volume_ma: 1000000,
            relative_volume: 1.0,
            week_52_high: 120,
            week_52_low: 80,
            momentum: 5.0,
          },
          supportResistance: [],
          trendlines: [],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(malformedResponse);

      // The service should return the data as-is (type validation at higher level)
      const result = await service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData);

      expect(result.symbol).toBe('RELIANCE');
      expect(result.indicators.rsi).toBe('invalid');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should throw error for null response data', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: null });

      await expect(service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Quant Engine analysis failed'
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should throw error for undefined response data', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: undefined });

      await expect(service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Quant Engine analysis failed'
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should throw error when response is not in expected format', async () => {
      // Simulate a network error or HTML error page instead of JSON
      const networkError = new Error('Request failed with status code 500');
      (networkError as any).response = {
        status: 500,
        data: '<html><body>Internal Server Error</body></html>',
      };

      mockAxiosInstance.post.mockRejectedValueOnce(networkError);

      await expect(service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Quant Engine analysis failed: Request failed with status code 500'
      );

      // Verify no retry was attempted
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling - No Retry on Calculation Errors', () => {
    it('should not retry when Quant Engine returns calculation error', async () => {
      const calculationError = new Error(
        'Invalid data: insufficient data points for RSI calculation'
      );
      (calculationError as any).response = {
        status: 400,
        data: { error: 'Invalid data: insufficient data points for RSI calculation' },
      };

      mockAxiosInstance.post.mockRejectedValueOnce(calculationError);

      await expect(service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Quant Engine analysis failed: Invalid data: insufficient data points for RSI calculation'
      );

      // Critical: Verify the request was made only once (no retry)
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should not retry when calculateIndicators fails with validation error', async () => {
      const validationError = new Error('Validation failed: high must be >= low');
      (validationError as any).response = {
        status: 422,
        data: { error: 'Validation failed: high must be >= low' },
      };

      mockAxiosInstance.post.mockRejectedValueOnce(validationError);

      await expect(service.calculateIndicators('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Indicator calculation failed: Validation failed: high must be >= low'
      );

      // Critical: Verify no retry was attempted
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should not retry when detectTrendlines fails with insufficient data', async () => {
      const dataError = new Error(
        'Insufficient data points for trendline detection (minimum 10 required)'
      );
      (dataError as any).response = {
        status: 400,
        data: { error: 'Insufficient data points for trendline detection' },
      };

      mockAxiosInstance.post.mockRejectedValueOnce(dataError);

      await expect(service.detectTrendlines('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Trendline detection failed: Insufficient data points for trendline detection (minimum 10 required)'
      );

      // Critical: Verify no retry was attempted
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should not retry on network connection refused error', async () => {
      const connectionError = new Error('connect ECONNREFUSED 127.0.0.1:8000');
      (connectionError as any).code = 'ECONNREFUSED';

      mockAxiosInstance.post.mockRejectedValueOnce(connectionError);

      await expect(service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Quant Engine analysis failed: connect ECONNREFUSED 127.0.0.1:8000'
      );

      // Verify no retry was attempted
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should not retry on network host unreachable error', async () => {
      const networkError = new Error('getaddrinfo ENOTFOUND localhost');
      (networkError as any).code = 'ENOTFOUND';

      mockAxiosInstance.post.mockRejectedValueOnce(networkError);

      await expect(service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Quant Engine analysis failed: getaddrinfo ENOTFOUND localhost'
      );

      // Verify no retry was attempted (deterministic calculations should not retry)
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 500 Internal Server Error', async () => {
      const serverError = new Error('Request failed with status code 500');
      (serverError as any).response = {
        status: 500,
        data: { error: 'Internal server error during calculation' },
      };

      mockAxiosInstance.post.mockRejectedValueOnce(serverError);

      await expect(service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Quant Engine analysis failed: Request failed with status code 500'
      );

      // Verify no retry was attempted
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling - Request Payload Formatting', () => {
    it('should correctly format OHLCV data in analyzeMarketData request', async () => {
      const mockResponse = {
        data: {
          symbol: 'RELIANCE',
          timeframe: '1d',
          indicators: createCompleteIndicators(102),
          supportResistance: [],
          trendlines: [],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData);

      // Verify the request was made with correctly formatted data
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/quant/analyze',
        {
          symbol: 'RELIANCE',
          timeframe: '1d',
          data: [
            {
              timestamp: '2024-01-01T10:00:00.000Z',
              open: 100,
              high: 105,
              low: 99,
              close: 103,
              volume: 1000000,
            },
            {
              timestamp: '2024-01-01T11:00:00.000Z',
              open: 103,
              high: 107,
              low: 102,
              close: 106,
              volume: 1200000,
            },
          ],
        },
        {
          params: {
            include_trendline: false,
          },
        }
      );
    });
  });

  describe('Error Handling - Error Message Propagation', () => {
    it('should propagate descriptive error messages from Quant Engine', async () => {
      const descriptiveError = new Error(
        'MACD calculation requires at least 26 data points, received 10'
      );
      (descriptiveError as any).response = {
        status: 400,
        data: { detail: 'MACD calculation requires at least 26 data points, received 10' },
      };

      mockAxiosInstance.post.mockRejectedValueOnce(descriptiveError);

      await expect(service.calculateIndicators('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Indicator calculation failed: MACD calculation requires at least 26 data points, received 10'
      );
    });

    it('should handle unknown error types gracefully', async () => {
      // Simulate a non-Error object being thrown
      mockAxiosInstance.post.mockRejectedValueOnce('String error message');

      await expect(service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Quant Engine analysis failed: Unknown error'
      );
    });

    it('should handle Error objects without message', async () => {
      const emptyError = new Error();
      emptyError.message = '';

      mockAxiosInstance.post.mockRejectedValueOnce(emptyError);

      await expect(service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Quant Engine analysis failed: '
      );
    });
  });

  describe('Error Handling - Successful Request Handling', () => {
    it('should successfully process valid response from analyzeMarketData', async () => {
      const mockResponse = {
        data: {
          symbol: 'RELIANCE',
          timeframe: '1d',
          indicators: createCompleteIndicators(102),
          supportResistance: [
            { level: 100, strength: 0.8 },
            { level: 110, strength: 0.6 },
          ],
          trendlines: [{ slope: 1.5, intercept: 95, rSquared: 0.85 }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData);

      expect(result).toEqual(mockResponse.data);
      expect(result.symbol).toBe('RELIANCE');
      expect(result.indicators.rsi).toBe(50);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should include trendline parameter when enabled in analyzeMarketData', async () => {
      const mockResponse = {
        data: {
          symbol: 'RELIANCE',
          timeframe: '1d',
          indicators: createCompleteIndicators(102),
          supportResistance: [
            { level: 100, strength: 0.8 },
            { level: 110, strength: 0.6 },
          ],
          trendlines: [{ slope: 1.5, intercept: 95, rSquared: 0.85 }],
          trendline: {
            support_line: {
              slope: 2.5,
              intercept: 2350.0,
              rSquared: 0.89,
            },
            resistance_line: {
              slope: 1.8,
              intercept: 2400.0,
              rSquared: 0.85,
            },
            swing_points: [],
            breakout_status: 'NONE',
            direction: 'UPTREND',
            support_status: 'ACTIVE',
            resistance_status: 'ACTIVE',
            confidence: 0.75,
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await service.analyzeMarketData('RELIANCE', '1d', mockOHLCVData, true);

      expect(result).toEqual(mockResponse.data);
      expect(result.trendline).toBeDefined();
      expect(result.trendline?.direction).toBe('UPTREND');

      // Verify the request included the trendline parameter
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/quant/analyze', expect.any(Object), {
        params: {
          include_trendline: true,
        },
      });
    });

    it('should successfully process valid response from calculateIndicators', async () => {
      const mockResponse = {
        data: createCompleteIndicators(102),
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await service.calculateIndicators('RELIANCE', '1d', mockOHLCVData);

      expect(result).toEqual(mockResponse.data);
      expect(result.rsi).toBe(50);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should successfully process valid response from detectTrendlines', async () => {
      const mockResponse = {
        data: {
          trendlines: [{ slope: 1.5, intercept: 95, rSquared: 0.85 }],
          supportResistance: [{ level: 100, strength: 0.8 }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await service.detectTrendlines('RELIANCE', '1d', mockOHLCVData);

      expect(result).toEqual(mockResponse.data);
      expect(result.trendlines).toHaveLength(1);
      expect(result.supportResistance).toHaveLength(1);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('analyzeTrendline', () => {
    it('should successfully call /quant/trendline endpoint and return trendline result', async () => {
      const mockResponse = {
        data: {
          support_line: {
            slope: 2.5,
            intercept: 2350.0,
            rSquared: 0.89,
          },
          resistance_line: {
            slope: 1.8,
            intercept: 2400.0,
            rSquared: 0.85,
          },
          swing_points: [
            {
              timestamp: '2024-01-15T09:15:00Z',
              price: 2470.0,
              type: 'HIGH',
              index: 5,
            },
            {
              timestamp: '2024-01-16T14:30:00Z',
              price: 2445.0,
              type: 'LOW',
              index: 12,
            },
          ],
          breakout_status: 'BREAKOUT',
          direction: 'UPTREND',
          support_status: 'ACTIVE',
          resistance_status: 'BROKEN',
          confidence: 0.78,
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await service.analyzeTrendline('RELIANCE', '1d', mockOHLCVData, 3);

      expect(result).toBeDefined();
      expect(result!.swing_points).toHaveLength(2);
      expect(result!.breakout_status).toBe('BREAKOUT');
      expect(result!.direction).toBe('UPTREND');

      // Verify correct endpoint was called with query parameters
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/quant/trendline',
        {
          symbol: 'RELIANCE',
          timeframe: '1d',
          data: expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(String),
              open: expect.any(Number),
              high: expect.any(Number),
              low: expect.any(Number),
              close: expect.any(Number),
              volume: expect.any(Number),
            }),
          ]),
        },
        {
          params: {
            lookback_period: 3,
          },
        }
      );

      // Verify audit logging was called
      expect(mockAuditLogService.logQuantCall).toHaveBeenCalledWith(
        'analyze_trendline',
        'RELIANCE',
        true,
        undefined,
        expect.objectContaining({
          timeframe: '1d',
          dataPoints: 2,
          lookbackPeriod: 3,
          swingPoints: 2,
          breakoutStatus: 'BREAKOUT',
          direction: 'UPTREND',
        })
      );
    });

    it('should use default lookback period of 3 when not specified', async () => {
      const mockResponse = {
        data: {
          support_line: null,
          resistance_line: null,
          swing_points: [],
          breakout_status: 'NONE',
          direction: 'SIDEWAYS',
          support_status: 'ACTIVE',
          resistance_status: 'ACTIVE',
          confidence: 0.5,
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.analyzeTrendline('RELIANCE', '1d', mockOHLCVData);

      // Verify default lookback_period of 3 was used
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/quant/trendline', expect.any(Object), {
        params: {
          lookback_period: 3,
        },
      });
    });

    it('should handle trendline analysis errors', async () => {
      const error = new Error('Insufficient data for trendline analysis');
      mockAxiosInstance.post.mockRejectedValueOnce(error);

      await expect(service.analyzeTrendline('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Trendline analysis failed: Insufficient data for trendline analysis'
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);

      // Verify error was logged in audit
      expect(mockAuditLogService.logQuantCall).toHaveBeenCalledWith(
        'analyze_trendline',
        'RELIANCE',
        false,
        'Insufficient data for trendline analysis'
      );
    });

    it('should handle different breakout statuses', async () => {
      const breakdownResponse = {
        data: {
          support_line: {
            slope: -1.5,
            intercept: 2500.0,
            rSquared: 0.82,
          },
          resistance_line: null,
          swing_points: [],
          breakout_status: 'BREAKDOWN',
          direction: 'DOWNTREND',
          support_status: 'BROKEN',
          resistance_status: 'ACTIVE',
          confidence: 0.85,
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(breakdownResponse);

      const result = await service.analyzeTrendline('RELIANCE', '1d', mockOHLCVData);

      expect(result).toBeDefined();
      expect(result!.breakout_status).toBe('BREAKDOWN');
      expect(result!.direction).toBe('DOWNTREND');
      expect(result!.support_status).toBe('BROKEN');
    });

    it('should handle confirmed breakouts', async () => {
      const confirmedResponse = {
        data: {
          support_line: {
            slope: 2.0,
            intercept: 2300.0,
            rSquared: 0.91,
          },
          resistance_line: {
            slope: 1.5,
            intercept: 2400.0,
            rSquared: 0.88,
          },
          swing_points: [
            {
              timestamp: '2024-01-15T09:15:00Z',
              price: 2470.0,
              type: 'HIGH',
              index: 5,
            },
          ],
          breakout_status: 'CONFIRMED',
          direction: 'UPTREND',
          support_status: 'ACTIVE',
          resistance_status: 'BROKEN',
          confidence: 0.92,
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(confirmedResponse);

      const result = await service.analyzeTrendline('RELIANCE', '1d', mockOHLCVData);

      expect(result).toBeDefined();
      expect(result!.breakout_status).toBe('CONFIRMED');
      expect(result!.confidence).toBeGreaterThan(0.9);
    });

    it('should handle sideways market with no trendlines', async () => {
      const sidewaysResponse = {
        data: {
          support_line: null,
          resistance_line: null,
          swing_points: [],
          breakout_status: 'NONE',
          direction: 'SIDEWAYS',
          support_status: 'ACTIVE',
          resistance_status: 'ACTIVE',
          confidence: 0.45,
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(sidewaysResponse);

      const result = await service.analyzeTrendline('RELIANCE', '1d', mockOHLCVData);

      expect(result).toBeDefined();
      expect(result!.direction).toBe('SIDEWAYS');
      expect(result!.support_line).toBeNull();
      expect(result!.resistance_line).toBeNull();
      expect(result!.breakout_status).toBe('NONE');
    });

    it('should correctly format request with custom lookback period', async () => {
      const mockResponse = {
        data: {
          support_line: null,
          resistance_line: null,
          swing_points: [],
          breakout_status: 'NONE',
          direction: 'SIDEWAYS',
          support_status: 'ACTIVE',
          resistance_status: 'ACTIVE',
          confidence: 0.5,
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.analyzeTrendline('RELIANCE', '1d', mockOHLCVData, 5);

      // Verify custom lookback period was passed
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/quant/trendline',
        expect.objectContaining({
          symbol: 'RELIANCE',
          timeframe: '1d',
        }),
        {
          params: {
            lookback_period: 5,
          },
        }
      );
    });
  });

  describe('scoreMarket', () => {
    it('should successfully call /quant/score endpoint and return score result', async () => {
      const mockResponse = {
        data: {
          trend: 'BULLISH',
          rsi: 65.4,
          adx: 28.5,
          vwap: 2461.0,
          volumeRatio: 1.25,
          score: 78.5,
          signals: [
            'Strong upward trend detected (ADX: 28.5)',
            'RSI in bullish range (65.4)',
            'Above average volume (1.25x average)',
            'Price above VWAP',
          ],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await service.scoreMarket('RELIANCE', '1d', mockOHLCVData);

      expect(result).toEqual(mockResponse.data);
      expect(result.trend).toBe('BULLISH');
      expect(result.score).toBe(78.5);
      expect(result.signals).toHaveLength(4);

      // Verify correct endpoint was called
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/quant/score', {
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: expect.arrayContaining([
          expect.objectContaining({
            timestamp: expect.any(String),
            open: expect.any(Number),
            high: expect.any(Number),
            low: expect.any(Number),
            close: expect.any(Number),
            volume: expect.any(Number),
          }),
        ]),
      });

      // Verify audit logging was called
      expect(mockAuditLogService.logQuantCall).toHaveBeenCalledWith(
        'score_market',
        'RELIANCE',
        true,
        undefined,
        expect.objectContaining({
          timeframe: '1d',
          dataPoints: 2,
          trend: 'BULLISH',
          score: 78.5,
        })
      );
    });

    it('should handle errors from scoring endpoint', async () => {
      const error = new Error('Insufficient data for scoring');
      mockAxiosInstance.post.mockRejectedValueOnce(error);

      await expect(service.scoreMarket('RELIANCE', '1d', mockOHLCVData)).rejects.toThrow(
        'Market scoring failed: Insufficient data for scoring'
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);

      // Verify error was logged in audit
      expect(mockAuditLogService.logQuantCall).toHaveBeenCalledWith(
        'score_market',
        'RELIANCE',
        false,
        'Insufficient data for scoring'
      );
    });

    it('should handle different trend classifications', async () => {
      const bearishResponse = {
        data: {
          trend: 'BEARISH',
          rsi: 32.1,
          adx: 31.2,
          vwap: 2440.0,
          volumeRatio: 1.45,
          score: 25.8,
          signals: ['Strong downward trend detected', 'RSI in bearish range'],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(bearishResponse);

      const result = await service.scoreMarket('RELIANCE', '1d', mockOHLCVData);

      expect(result.trend).toBe('BEARISH');
      expect(result.score).toBeLessThan(50);
    });

    it('should handle NEUTRAL trend classification', async () => {
      const neutralResponse = {
        data: {
          trend: 'NEUTRAL',
          rsi: 48.3,
          adx: 18.7,
          vwap: 2455.0,
          volumeRatio: 0.85,
          score: 50.2,
          signals: ['Weak trend detected', 'RSI neutral'],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(neutralResponse);

      const result = await service.scoreMarket('RELIANCE', '1d', mockOHLCVData);

      expect(result.trend).toBe('NEUTRAL');
      expect(result.score).toBeCloseTo(50.2);
    });
  });

  describe('Property 4: Quantitative Analysis Serialization Round-Trip', () => {
    /**
     * Property 4: Quantitative Analysis Serialization Round-Trip
     * For any valid QuantAnalysisResult object, serializing to JSON and deserializing back
     * SHALL produce an equivalent object with all numerical values preserved within
     * floating-point precision.
     * **Validates: Requirements 3.8**
     */
    it('should preserve all data through JSON serialization round-trip', () => {
      // Arbitraries for generating valid QuantAnalysisResult objects
      const symbolArb = fc
        .string({ minLength: 2, maxLength: 10 })
        .map((s) => s.toUpperCase().replace(/[^A-Z]/g, 'X'))
        .filter((s) => s.length >= 2);

      const timeframeArb = fc.constantFrom('1m', '5m', '15m', '1h', '1d', '1w');

      // Float within reasonable bounds for financial data
      const priceArb = fc.double({ min: 0.01, max: 100000, noNaN: true });
      const percentArb = fc.double({ min: 0, max: 100, noNaN: true });
      const macdValueArb = fc.double({ min: -1000, max: 1000, noNaN: true });
      const levelArb = fc.double({ min: 0.01, max: 100000, noNaN: true });
      const strengthArb = fc.double({ min: 0, max: 1, noNaN: true });
      const slopeArb = fc.double({ min: -100, max: 100, noNaN: true });
      const rSquaredArb = fc.double({ min: 0, max: 1, noNaN: true });
      const greekArb = fc.double({ min: -10, max: 10, noNaN: true });

      const indicatorsArb = fc.record({
        rsi: percentArb,
        macd: fc.record({
          value: macdValueArb,
          signal: macdValueArb,
          histogram: macdValueArb,
        }),
        sma_20: priceArb,
        sma_50: priceArb,
        sma_200: priceArb,
        ema_5: priceArb,
        ema_15: priceArb,
        ema_20: priceArb,
        ema_50: priceArb,
        ema_200: priceArb,
        bollingerBands: fc.record({
          upper: priceArb,
          middle: priceArb,
          lower: priceArb,
        }),
        adx: percentArb,
        atr: fc.double({ min: 0.01, max: 1000, noNaN: true }),
        vwap: priceArb,
        volume_ma: fc.double({ min: 0, max: 1000000000, noNaN: true }),
        relative_volume: fc.double({ min: 0, max: 10, noNaN: true }),
        week_52_high: priceArb,
        week_52_low: priceArb,
        momentum: fc.double({ min: -100, max: 100, noNaN: true }),
      });

      const supportResistanceArb = fc.array(
        fc.record({
          level: levelArb,
          strength: strengthArb,
        }),
        { minLength: 0, maxLength: 10 }
      );

      const trendlinesArb = fc.array(
        fc.record({
          slope: slopeArb,
          intercept: priceArb,
          rSquared: rSquaredArb,
        }),
        { minLength: 0, maxLength: 5 }
      );

      const optionsGreeksArb = fc.option(
        fc.record({
          delta: greekArb,
          gamma: greekArb,
          theta: greekArb,
          vega: greekArb,
        }),
        { nil: undefined }
      );

      const quantAnalysisResultArb = fc.record({
        symbol: symbolArb,
        timeframe: timeframeArb,
        indicators: indicatorsArb,
        supportResistance: supportResistanceArb,
        trendlines: trendlinesArb,
        optionsGreeks: optionsGreeksArb,
      }) as fc.Arbitrary<QuantAnalysisResult>;

      fc.assert(
        fc.property(quantAnalysisResultArb, (original) => {
          // Serialize to JSON
          const json = JSON.stringify(original);

          // Deserialize back
          const deserialized: QuantAnalysisResult = JSON.parse(json);

          // Verify structure is preserved
          expect(deserialized.symbol).toBe(original.symbol);
          expect(deserialized.timeframe).toBe(original.timeframe);

          // Verify indicators are preserved within floating-point precision
          expect(deserialized.indicators.rsi).toBeCloseTo(original.indicators.rsi, 10);
          expect(deserialized.indicators.macd.value).toBeCloseTo(
            original.indicators.macd.value,
            10
          );
          expect(deserialized.indicators.macd.signal).toBeCloseTo(
            original.indicators.macd.signal,
            10
          );
          expect(deserialized.indicators.macd.histogram).toBeCloseTo(
            original.indicators.macd.histogram,
            10
          );
          expect(deserialized.indicators.sma_20).toBeCloseTo(original.indicators.sma_20, 10);
          expect(deserialized.indicators.sma_50).toBeCloseTo(original.indicators.sma_50, 10);
          expect(deserialized.indicators.sma_200).toBeCloseTo(original.indicators.sma_200, 10);
          expect(deserialized.indicators.ema_20).toBeCloseTo(original.indicators.ema_20, 10);
          expect(deserialized.indicators.bollingerBands.upper).toBeCloseTo(
            original.indicators.bollingerBands.upper,
            10
          );
          expect(deserialized.indicators.bollingerBands.middle).toBeCloseTo(
            original.indicators.bollingerBands.middle,
            10
          );
          expect(deserialized.indicators.bollingerBands.lower).toBeCloseTo(
            original.indicators.bollingerBands.lower,
            10
          );

          // Verify support/resistance levels are preserved
          expect(deserialized.supportResistance).toHaveLength(original.supportResistance.length);
          deserialized.supportResistance.forEach((level, i) => {
            expect(level.level).toBeCloseTo(original.supportResistance[i].level, 10);
            expect(level.strength).toBeCloseTo(original.supportResistance[i].strength, 10);
          });

          // Verify trendlines are preserved
          expect(deserialized.trendlines).toHaveLength(original.trendlines.length);
          deserialized.trendlines.forEach((trendline, i) => {
            expect(trendline.slope).toBeCloseTo(original.trendlines[i].slope, 10);
            expect(trendline.intercept).toBeCloseTo(original.trendlines[i].intercept, 10);
            expect(trendline.rSquared).toBeCloseTo(original.trendlines[i].rSquared, 10);
          });

          // Verify optional Greeks are preserved if present
          if (original.optionsGreeks) {
            expect(deserialized.optionsGreeks).toBeDefined();
            expect(deserialized.optionsGreeks!.delta).toBeCloseTo(original.optionsGreeks.delta, 10);
            expect(deserialized.optionsGreeks!.gamma).toBeCloseTo(original.optionsGreeks.gamma, 10);
            expect(deserialized.optionsGreeks!.theta).toBeCloseTo(original.optionsGreeks.theta, 10);
            expect(deserialized.optionsGreeks!.vega).toBeCloseTo(original.optionsGreeks.vega, 10);
          } else {
            expect(deserialized.optionsGreeks).toBeUndefined();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases in serialization round-trip', () => {
      // Test with extreme values
      const extremeValuesArb = fc.constantFrom(
        {
          symbol: 'TEST',
          timeframe: '1d',
          indicators: {
            rsi: 0,
            macd: { value: 0, signal: 0, histogram: 0 },
            sma_20: 0.01,
            sma_50: 0.01,
            sma_200: 0.01,
            ema_5: 0.01,
            ema_15: 0.01,
            ema_20: 0.01,
            ema_50: 0.01,
            ema_200: 0.01,
            bollingerBands: { upper: 0.01, middle: 0.01, lower: 0.01 },
            adx: 0,
            atr: 0.01,
            vwap: 0.01,
            volume_ma: 0,
            relative_volume: 0,
            week_52_high: 0.01,
            week_52_low: 0.01,
            momentum: -100,
          },
          supportResistance: [],
          trendlines: [],
        } as QuantAnalysisResult,
        {
          symbol: 'MAX',
          timeframe: '1w',
          indicators: {
            rsi: 100,
            macd: { value: 1000, signal: 1000, histogram: 1000 },
            sma_20: 100000,
            sma_50: 100000,
            sma_200: 100000,
            ema_5: 100000,
            ema_15: 100000,
            ema_20: 100000,
            ema_50: 100000,
            ema_200: 100000,
            bollingerBands: { upper: 100000, middle: 100000, lower: 100000 },
            adx: 100,
            atr: 1000,
            vwap: 100000,
            volume_ma: 1000000000,
            relative_volume: 10,
            week_52_high: 100000,
            week_52_low: 100000,
            momentum: 100,
          },
          supportResistance: [{ level: 100000, strength: 1 }],
          trendlines: [{ slope: 100, intercept: 100000, rSquared: 1 }],
          optionsGreeks: { delta: 1, gamma: 1, theta: -1, vega: 10 },
        } as QuantAnalysisResult
      );

      fc.assert(
        fc.property(extremeValuesArb, (original) => {
          const json = JSON.stringify(original);
          const deserialized: QuantAnalysisResult = JSON.parse(json);

          // Verify complete structure is preserved
          expect(deserialized).toMatchObject(original);
        }),
        { numRuns: 20 }
      );
    });

    it('should preserve array ordering through serialization', () => {
      const orderedArrayArb = fc.record({
        symbol: fc.constant('TEST'),
        timeframe: fc.constant('1d'),
        indicators: fc.record({
          rsi: fc.constant(50),
          macd: fc.constant({ value: 0, signal: 0, histogram: 0 }),
          sma_20: fc.constant(100),
          sma_50: fc.constant(100),
          sma_200: fc.constant(100),
          ema_20: fc.constant(100),
          bollingerBands: fc.constant({ upper: 110, middle: 100, lower: 90 }),
        }),
        supportResistance: fc
          .array(
            fc.record({
              level: fc.double({ min: 50, max: 150, noNaN: true }),
              strength: fc.double({ min: 0, max: 1, noNaN: true }),
            }),
            { minLength: 3, maxLength: 10 }
          )
          .map((arr) => arr.sort((a, b) => a.level - b.level)), // Sort by level
        trendlines: fc.array(
          fc.record({
            slope: fc.double({ min: -10, max: 10, noNaN: true }),
            intercept: fc.double({ min: 50, max: 150, noNaN: true }),
            rSquared: fc.double({ min: 0, max: 1, noNaN: true }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
      }) as fc.Arbitrary<QuantAnalysisResult>;

      fc.assert(
        fc.property(orderedArrayArb, (original) => {
          const json = JSON.stringify(original);
          const deserialized: QuantAnalysisResult = JSON.parse(json);

          // Verify array ordering is preserved
          deserialized.supportResistance.forEach((level, i) => {
            expect(level.level).toBeCloseTo(original.supportResistance[i].level, 10);
            expect(level.strength).toBeCloseTo(original.supportResistance[i].strength, 10);
          });

          deserialized.trendlines.forEach((trendline, i) => {
            expect(trendline.slope).toBeCloseTo(original.trendlines[i].slope, 10);
            expect(trendline.intercept).toBeCloseTo(original.trendlines[i].intercept, 10);
            expect(trendline.rSquared).toBeCloseTo(original.trendlines[i].rSquared, 10);
          });
        }),
        { numRuns: 50 }
      );
    });
  });
});
