/**
 * Unit tests for API Client
 *
 * Tests the typed API client methods and error handling
 */

import { ApiClient } from './api-client';

describe('ApiClient', () => {
  let client: ApiClient;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    // Create a new client instance for each test
    client = new ApiClient('http://localhost:4000');

    // Mock global fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('submitPrompt', () => {
    it('should send POST request with prompt and return response', async () => {
      const mockResponse = {
        rawPrompt: 'Find swing trade in RELIANCE',
        parsed: {
          intent: 'FIND_TRADE',
          symbols: ['RELIANCE'],
          timeframe: 'SWING',
          assetType: 'STOCK',
        },
        recommendation: {
          id: 'rec_123',
          action: 'BUY',
          symbol: 'RELIANCE',
          entryPrice: 2460,
          target: 2520,
          stopLoss: 2430,
          confidence: 0.75,
          reasoning: 'Strong uptrend...',
          quantData: {} as any,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.submitPrompt('Find swing trade in RELIANCE');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/prompt',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ prompt: 'Find swing trade in RELIANCE' }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid prompt',
      });

      await expect(client.submitPrompt('invalid')).rejects.toThrow(
        'API request failed: 400 Bad Request - Invalid prompt'
      );
    });
  });

  describe('getPortfolio', () => {
    it('should send GET request with userId and return portfolio', async () => {
      const mockPortfolio = {
        totalValue: 1000000,
        cashBalance: 500000,
        investedValue: 500000,
        positions: [],
        totalPnL: 0,
        dailyPnL: 0,
        metrics: {
          totalExposure: 0.5,
          openPositions: 0,
          winRate: 0,
          avgWin: 0,
          avgLoss: 0,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPortfolio,
      });

      const result = await client.getPortfolio('user123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/portfolio?userId=user123',
        expect.any(Object)
      );
      expect(result).toEqual(mockPortfolio);
    });
  });

  describe('executePaperTrade', () => {
    it('should send POST request with trade details', async () => {
      const mockResult = {
        tradeId: 'trade_123',
        status: 'EXECUTED' as const,
        executedPrice: 2460,
        slippage: 0.5,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      const tradeRequest = {
        userId: 'user123',
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460,
        stopLoss: 2430,
        target: 2520,
      };

      const result = await client.executePaperTrade(tradeRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/trade/paper',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(tradeRequest),
        })
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('executeLiveTrade', () => {
    it('should send POST request with userConfirmed flag', async () => {
      const mockResult = {
        tradeId: 'trade_456',
        status: 'PENDING' as const,
        brokerOrderId: 'NEO123',
        message: 'Order submitted to broker',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      const tradeRequest = {
        userId: 'user123',
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460,
        userConfirmed: true,
      };

      const result = await client.executeLiveTrade(tradeRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/trade/live',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(tradeRequest),
        })
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getMarketData', () => {
    it('should send GET request with symbol and timeframe', async () => {
      const mockData = {
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: [
          {
            timestamp: '2024-01-01T00:00:00Z',
            open: 2450,
            high: 2470,
            low: 2445,
            close: 2465,
            volume: 1000000,
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await client.getMarketData('RELIANCE', '1d');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/market-data?symbol=RELIANCE&timeframe=1d',
        expect.any(Object)
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('getOptionsChain', () => {
    it('should send GET request for NIFTY options chain', async () => {
      const mockChain = {
        underlying: 'NIFTY' as const,
        expiryDate: '2024-12-26',
        spotPrice: 21500,
        strikes: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockChain,
      });

      const result = await client.getOptionsChain('NIFTY', '2024-12-26');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/market-data/options-chain?underlying=NIFTY&expiryDate=2024-12-26',
        expect.any(Object)
      );
      expect(result).toEqual(mockChain);
    });

    it('should handle optional expiryDate parameter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await client.getOptionsChain('BANKNIFTY');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/market-data/options-chain?underlying=BANKNIFTY',
        expect.any(Object)
      );
    });
  });

  describe('validateTrade', () => {
    it('should send POST request with trade details for validation', async () => {
      const mockValidation = {
        passed: false,
        violations: [
          {
            rule: 'MAX_POSITION_SIZE',
            message: 'Position size exceeds limit',
            severity: 'ERROR' as const,
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockValidation,
      });

      const tradeRequest = {
        userId: 'user123',
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 100,
        price: 2460,
      };

      const result = await client.validateTrade(tradeRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/risk/validate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(tradeRequest),
        })
      );
      expect(result).toEqual(mockValidation);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      await expect(client.submitPrompt('test')).rejects.toThrow('Network failure');
    });

    it('should handle non-JSON error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error details',
      });

      await expect(client.getPortfolio('user123')).rejects.toThrow(
        'API request failed: 500 Internal Server Error - Server error details'
      );
    });
  });

  describe('custom base URL', () => {
    it('should support custom base URL', async () => {
      const customClient = new ApiClient('http://api.example.com:8080');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await customClient.submitPrompt('test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.example.com:8080/prompt',
        expect.any(Object)
      );
    });
  });
});
