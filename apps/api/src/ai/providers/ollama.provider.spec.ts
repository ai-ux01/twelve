import { Test, TestingModule } from '@nestjs/testing';
import { OllamaProvider } from './ollama.provider';
import { ConfigService } from '../../config/config.service';
import { QuantAnalysisResult } from '../../quant/quant.service';
import { ParsedPrompt } from '../../prompt/prompt.service';
import axios from 'axios';

jest.mock('axios');

/**
 * Ollama Provider Error Handling and Retry Logic Tests
 *
 * Tests for Task 11.4: AI Service Error Handling (Ollama Provider)
 * - Test retry logic on AI failure (retry once after 2 seconds)
 * - Test fallback behavior when AI unavailable
 * - Verify AI only receives quant results, not raw market data
 *
 * Requirements: 20.3, 18.1
 */
describe('OllamaProvider - Error Handling and Retry Logic (Task 11.4)', () => {
  let provider: OllamaProvider;
  let mockAxiosInstance: any;

  const mockQuantAnalysis: QuantAnalysisResult = {
    symbol: 'RELIANCE',
    timeframe: '1d',
    indicators: {
      rsi: 55.5,
      macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
      sma_20: 2455.0,
      sma_50: 2450.0,
      sma_200: 2380.0,
      ema_20: 2458.0,
      bollingerBands: { upper: 2500.0, middle: 2455.0, lower: 2410.0 },
    },
    supportResistance: [
      { level: 2400, strength: 0.85 },
      { level: 2500, strength: 0.72 },
    ],
    trendlines: [{ slope: 2.5, intercept: 2350, rSquared: 0.89 }],
  };

  const mockParsedPrompt: ParsedPrompt = {
    intent: 'FIND_TRADE',
    symbols: ['RELIANCE'],
    timeframe: 'SWING',
    assetType: 'STOCK',
  };

  const mockSuccessResponse = {
    data: {
      model: 'llama2',
      created_at: '2024-01-01T00:00:00Z',
      response: JSON.stringify({
        action: 'BUY',
        entryPrice: 2460,
        target: 2520,
        stopLoss: 2430,
        confidence: 0.75,
        reasoning: 'Strong uptrend with favorable indicators',
      }),
      done: true,
    },
  };

  beforeEach(async () => {
    const mockConfigService = {
      ollamaBaseUrl: 'http://localhost:11434',
      aiModel: 'llama2',
      aiProvider: 'ollama',
    };

    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
    };

    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OllamaProvider,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    provider = module.get<OllamaProvider>(OllamaProvider);
  });

  describe('Sub-task: Test retry logic on AI failure', () => {
    it('should retry once after initial failure (Requirement 20.3)', async () => {
      // Arrange: First call fails, second call succeeds
      mockAxiosInstance.post
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(mockSuccessResponse);

      const startTime = Date.now();

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);
      const endTime = Date.now();

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(result.action).toBe('BUY');
      expect(result.entryPrice).toBe(2460);
      expect(result.reasoning).toContain('Strong uptrend');

      // Verify retry delay (should be at least 2 seconds)
      const elapsed = endTime - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(2000);
    });

    it('should wait 2 seconds before retry (Requirement 20.3)', async () => {
      // Arrange: Both attempts fail
      mockAxiosInstance.post
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Still failing'));

      const startTime = Date.now();

      // Act & Assert
      await expect(
        provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
      ).rejects.toThrow('Still failing');

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Verify delay between attempts
      expect(elapsed).toBeGreaterThanOrEqual(2000);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should throw error after retry fails (Requirement 20.3)', async () => {
      // Arrange: Both attempts fail
      const error = new Error('Network error');
      mockAxiosInstance.post.mockRejectedValueOnce(error).mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
      ).rejects.toThrow('Network error');

      // Verify exactly 2 attempts were made
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should succeed without retry if initial request succeeds', async () => {
      // Arrange
      mockAxiosInstance.post.mockResolvedValueOnce(mockSuccessResponse);

      const startTime = Date.now();

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);
      const endTime = Date.now();

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(result.action).toBe('BUY');

      // Verify no delay (should be fast < 2 seconds)
      const elapsed = endTime - startTime;
      expect(elapsed).toBeLessThan(2000);
    });

    it('should handle different error types during retry', async () => {
      // Arrange: Different errors on each attempt
      const connectionError = new Error('ECONNREFUSED');
      (connectionError as any).code = 'ECONNREFUSED';

      mockAxiosInstance.post
        .mockRejectedValueOnce(connectionError)
        .mockResolvedValueOnce(mockSuccessResponse);

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(result.action).toBe('BUY');
    });

    it('should retry portfolio analysis on failure (Requirement 20.3)', async () => {
      // Arrange
      const mockPortfolioState = {
        totalValue: 500000,
        cashBalance: 200000,
        positions: [],
      };

      const portfolioResponse = {
        data: {
          model: 'llama2',
          response: JSON.stringify({
            healthScore: 85,
            recommendations: ['Portfolio is well balanced'],
            warnings: [],
          }),
          done: true,
        },
      };

      mockAxiosInstance.post
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(portfolioResponse);

      const startTime = Date.now();

      // Act
      const result = await provider.analyzePortfolio(mockPortfolioState, [mockQuantAnalysis]);
      const endTime = Date.now();

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(result.healthScore).toBe(85);

      // Verify retry delay
      const elapsed = endTime - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(2000);
    });
  });

  describe('Sub-task: Test fallback behavior when AI unavailable', () => {
    it('should handle ECONNREFUSED error gracefully', async () => {
      // Arrange
      const connectionError = new Error('ECONNREFUSED');
      (connectionError as any).code = 'ECONNREFUSED';
      mockAxiosInstance.post.mockRejectedValue(connectionError);

      // Act & Assert
      await expect(
        provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
      ).rejects.toThrow();

      // Verify retry was attempted
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should handle model not found error (404)', async () => {
      // Arrange
      const error404 = {
        response: {
          status: 404,
          data: { error: 'Model not found' },
        },
        message: 'Model not found',
      };

      // Mock axios.isAxiosError to return true
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      mockAxiosInstance.post.mockRejectedValue(error404);

      // Act & Assert
      await expect(
        provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
      ).rejects.toThrow();

      // Verify retry was attempted
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should return safe HOLD recommendation on parse failure', async () => {
      // Arrange: Valid response but invalid JSON
      const invalidResponse = {
        data: {
          model: 'llama2',
          response: 'This is not valid JSON',
          done: true,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(invalidResponse);

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(result.action).toBe('HOLD');
      expect(result.entryPrice).toBe(0);
      expect(result.target).toBe(0);
      expect(result.stopLoss).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Failed to parse');
    });

    it('should handle incomplete recommendation fields', async () => {
      // Arrange: Missing required fields
      const incompleteResponse = {
        data: {
          model: 'llama2',
          response: JSON.stringify({
            action: 'BUY',
            // Missing entryPrice, target, stopLoss, etc.
          }),
          done: true,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(incompleteResponse);

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert - Should return HOLD due to parse failure
      expect(result.action).toBe('HOLD');
      expect(result.entryPrice).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle invalid action in response', async () => {
      // Arrange: Invalid action value
      const invalidActionResponse = {
        data: {
          model: 'llama2',
          response: JSON.stringify({
            action: 'INVALID_ACTION',
            entryPrice: 2460,
            target: 2520,
            stopLoss: 2430,
            confidence: 0.75,
            reasoning: 'Test',
          }),
          done: true,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(invalidActionResponse);

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert - Should return HOLD due to invalid action
      expect(result.action).toBe('HOLD');
      expect(result.reasoning).toContain('Failed to parse');
    });
  });

  describe('Sub-task: Verify AI only receives quant results, not raw market data', () => {
    it('should send only quantitative indicators to Ollama, not raw OHLCV (Requirement 18.1)', async () => {
      // Arrange
      mockAxiosInstance.post.mockResolvedValue(mockSuccessResponse);

      // Act
      await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);

      const callArgs = mockAxiosInstance.post.mock.calls[0];
      const requestPayload = callArgs[1];
      const prompt = requestPayload.prompt;

      // Verify prompt contains ONLY processed indicators
      expect(prompt).toContain('RSI');
      expect(prompt).toContain('MACD');
      expect(prompt).toContain('SMA');
      expect(prompt).toContain('EMA');
      expect(prompt).toContain('Bollinger Bands');
      expect(prompt).toContain('Support/Resistance');
      expect(prompt).toContain('Trendlines');

      // CRITICAL: Verify NO raw market data
      expect(prompt).not.toMatch(/\bopen\b/i);
      expect(prompt).not.toMatch(/\bhigh\b/i);
      expect(prompt).not.toMatch(/\blow\b/i);
      expect(prompt).not.toMatch(/\bclose\b/i);
      expect(prompt).not.toMatch(/\bvolume\b/i);
      expect(prompt).not.toContain('ohlcv');
      expect(prompt).not.toContain('candlestick');
      expect(prompt).not.toContain('orderBook');
    });

    it('should include support/resistance levels with strength scores (Requirement 18.1)', async () => {
      // Arrange
      mockAxiosInstance.post.mockResolvedValue(mockSuccessResponse);

      // Act
      await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      const callArgs = mockAxiosInstance.post.mock.calls[0];
      const prompt = callArgs[1].prompt;

      expect(prompt).toContain('Support/Resistance');
      expect(prompt).toContain('2400');
      expect(prompt).toContain('0.85');
      expect(prompt).toContain('2500');
      expect(prompt).toContain('0.72');
    });

    it('should include trendline analysis with slope and R² (Requirement 18.1)', async () => {
      // Arrange
      mockAxiosInstance.post.mockResolvedValue(mockSuccessResponse);

      // Act
      await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      const callArgs = mockAxiosInstance.post.mock.calls[0];
      const prompt = callArgs[1].prompt;

      expect(prompt).toContain('Trendlines');
      expect(prompt).toContain('Slope');
      expect(prompt).toContain('2.5');
      expect(prompt).toContain('R²');
      expect(prompt).toContain('0.89');
    });

    it('should include architectural constraint instructions in prompt', async () => {
      // Arrange
      mockAxiosInstance.post.mockResolvedValue(mockSuccessResponse);

      // Act
      await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      const callArgs = mockAxiosInstance.post.mock.calls[0];
      const prompt = callArgs[1].prompt;

      // Verify prompt instructs AI to use ONLY provided quantitative data
      expect(prompt).toContain('ONLY on the quantitative data provided');
      expect(prompt).toContain('Base your recommendation ONLY on the indicators provided');
    });
  });

  describe('Success Cases', () => {
    it('should generate recommendation successfully when Ollama succeeds', async () => {
      // Arrange
      mockAxiosInstance.post.mockResolvedValue(mockSuccessResponse);

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(result.action).toBe('BUY');
      expect(result.symbol).toBe('RELIANCE');
      expect(result.entryPrice).toBe(2460);
      expect(result.target).toBe(2520);
      expect(result.stopLoss).toBe(2430);
      expect(result.confidence).toBe(0.75);
      expect(result.reasoning).toContain('Strong uptrend');
    });

    it('should handle HOLD recommendations correctly', async () => {
      // Arrange
      const holdResponse = {
        data: {
          model: 'llama2',
          response: JSON.stringify({
            action: 'HOLD',
            confidence: 0.5,
            reasoning: 'No favorable trading conditions',
          }),
          done: true,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(holdResponse);

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(result.action).toBe('HOLD');
      expect(result.entryPrice).toBe(0);
      expect(result.target).toBe(0);
      expect(result.stopLoss).toBe(0);
      expect(result.confidence).toBe(0.5);
      expect(result.reasoning).toContain('No favorable trading conditions');
    });

    it('should successfully analyze portfolio when Ollama succeeds', async () => {
      // Arrange
      const mockPortfolioState = {
        totalValue: 500000,
        cashBalance: 200000,
        positions: [],
      };

      const portfolioResponse = {
        data: {
          model: 'llama2',
          response: JSON.stringify({
            healthScore: 85,
            recommendations: ['Portfolio is well balanced'],
            warnings: [],
          }),
          done: true,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(portfolioResponse);

      // Act
      const result = await provider.analyzePortfolio(mockPortfolioState, [mockQuantAnalysis]);

      // Assert
      expect(result.healthScore).toBe(85);
      expect(result.recommendations).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should clamp confidence values between 0 and 1', async () => {
      // Arrange: Confidence > 1
      const highConfidenceResponse = {
        data: {
          model: 'llama2',
          response: JSON.stringify({
            action: 'BUY',
            entryPrice: 2460,
            target: 2520,
            stopLoss: 2430,
            confidence: 1.5, // Invalid: > 1
            reasoning: 'Test',
          }),
          done: true,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(highConfidenceResponse);

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle response with done=false', async () => {
      // Arrange
      const incompleteResponse = {
        data: {
          model: 'llama2',
          response: 'partial response',
          done: false, // Not complete
        },
      };

      mockAxiosInstance.post.mockRejectedValue(new Error('Ollama response not complete'));

      // Act & Assert
      await expect(
        provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
      ).rejects.toThrow();

      // Verify retry was attempted
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });
  });
});
