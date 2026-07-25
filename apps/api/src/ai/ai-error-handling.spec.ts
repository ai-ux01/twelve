import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIProvider } from './providers/openai.provider';
import { ConfigService } from '../config/config.service';
import { QuantAnalysisResult } from '../quant/quant.service';
import { ParsedPrompt } from '../prompt/prompt.service';
import OpenAI from 'openai';

/**
 * AI Service Error Handling Tests
 *
 * Tests for Task 11.4: AI Service Error Handling
 * - Test retry logic on AI failure
 * - Test fallback behavior when AI unavailable
 * - Verify AI only receives quant results, not raw market data
 *
 * Requirements: 20.3, 18.1
 */
describe('AI Service Error Handling (Task 11.4)', () => {
  let provider: OpenAIProvider;
  let mockCreateFn: jest.Mock;

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

  beforeEach(async () => {
    const mockConfigService = {
      openaiApiKey: 'test-api-key',
      aiModel: 'gpt-4',
      aiProvider: 'openai',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIProvider,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    provider = module.get<OpenAIProvider>(OpenAIProvider);

    // Create mock function for chat.completions.create
    mockCreateFn = jest.fn();

    // Create mock OpenAI client
    const mockClient = {
      chat: {
        completions: {
          create: mockCreateFn,
        },
      },
    };

    // Replace the client with our mock
    (provider as any).client = mockClient;
  });

  describe('Sub-task: Test retry logic on AI failure', () => {
    it('should retry once after initial failure (Requirement 20.3)', async () => {
      // Arrange: First call fails, second call succeeds
      const successResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'BUY',
                entryPrice: 2460,
                target: 2520,
                stopLoss: 2430,
                confidence: 0.75,
                reasoning: 'Strong uptrend after retry',
              }),
            },
          },
        ],
      };

      mockCreateFn
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(successResponse as any);

      const startTime = Date.now();

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);
      const endTime = Date.now();

      // Assert
      expect(mockCreateFn).toHaveBeenCalledTimes(2);
      expect(result.action).toBe('BUY');
      expect(result.entryPrice).toBe(2460);
      expect(result.reasoning).toContain('Strong uptrend after retry');

      // Verify retry delay (should be at least 2 seconds)
      const elapsed = endTime - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(2000);
    });

    it('should wait 2 seconds before retry (Requirement 20.3)', async () => {
      // Arrange
      mockCreateFn
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Still failing'));

      const startTime = Date.now();

      // Act & Assert
      await expect(
        provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
      ).rejects.toThrow('Failed to generate recommendation from OpenAI');

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Verify delay between attempts
      expect(elapsed).toBeGreaterThanOrEqual(2000);
      expect(mockCreateFn).toHaveBeenCalledTimes(2);
    });

    it('should throw error after retry fails (Requirement 20.3)', async () => {
      // Arrange: Both attempts fail
      mockCreateFn
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(
        provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
      ).rejects.toThrow('Failed to generate recommendation from OpenAI: Network error');

      expect(mockCreateFn).toHaveBeenCalledTimes(2);
    });

    it('should succeed without retry if initial request succeeds', async () => {
      // Arrange
      const successResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'BUY',
                entryPrice: 2460,
                target: 2520,
                stopLoss: 2430,
                confidence: 0.75,
                reasoning: 'Strong uptrend',
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValueOnce(successResponse as any);

      const startTime = Date.now();

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);
      const endTime = Date.now();

      // Assert
      expect(mockCreateFn).toHaveBeenCalledTimes(1);
      expect(result.action).toBe('BUY');

      // Should complete quickly (no retry delay)
      const elapsed = endTime - startTime;
      expect(elapsed).toBeLessThan(2000);
    });

    it('should handle different error types during retry', async () => {
      // Arrange: Different errors on each attempt
      mockCreateFn
        .mockRejectedValueOnce(new Error('Timeout error'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'));

      // Act & Assert
      await expect(
        provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
      ).rejects.toThrow('Failed to generate recommendation from OpenAI: Rate limit exceeded');

      expect(mockCreateFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Sub-task: Test fallback behavior when AI unavailable', () => {
    it('should throw error when OpenAI API is unavailable (Requirement 20.3)', async () => {
      // Arrange: Simulate complete API unavailability
      mockCreateFn
        .mockRejectedValueOnce(new Error('API unavailable'))
        .mockRejectedValueOnce(new Error('API unavailable'));

      // Act & Assert
      await expect(
        provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
      ).rejects.toThrow('Failed to generate recommendation from OpenAI: API unavailable');
    });

    it('should handle empty response from OpenAI', async () => {
      // Arrange: Empty response
      const emptyResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };

      mockCreateFn
        .mockResolvedValueOnce(emptyResponse as any)
        .mockResolvedValueOnce(emptyResponse as any);

      // Act & Assert
      await expect(
        provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
      ).rejects.toThrow(
        'Failed to generate recommendation from OpenAI: Empty response from OpenAI'
      );
    });

    it('should handle malformed JSON response', async () => {
      // Arrange: Malformed JSON response
      const malformedResponse = {
        choices: [
          {
            message: {
              content: 'This is not valid JSON',
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValueOnce(malformedResponse as any);

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert: Should return HOLD recommendation on parse failure
      expect(result.action).toBe('HOLD');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Failed to parse AI response');
    });

    it('should handle incomplete recommendation fields', async () => {
      // Arrange: Missing required fields
      const incompleteResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'BUY',
                // Missing entryPrice, target, stopLoss, confidence, reasoning
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValueOnce(incompleteResponse as any);

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert: Should return HOLD recommendation on validation failure
      expect(result.action).toBe('HOLD');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Failed to parse AI response');
    });

    it('should handle invalid action in response', async () => {
      // Arrange: Invalid action
      const invalidActionResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'INVALID_ACTION',
                entryPrice: 2460,
                target: 2520,
                stopLoss: 2430,
                confidence: 0.75,
                reasoning: 'Test',
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValueOnce(invalidActionResponse as any);

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert: Should return HOLD recommendation
      expect(result.action).toBe('HOLD');
      expect(result.confidence).toBe(0);
    });
  });

  describe('Sub-task: Verify AI only receives quant results, not raw market data', () => {
    it('should send only quantitative indicators to OpenAI, not raw OHLCV (Requirement 18.1)', async () => {
      // Arrange
      const successResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'BUY',
                entryPrice: 2460,
                target: 2520,
                stopLoss: 2430,
                confidence: 0.75,
                reasoning: 'Test',
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValueOnce(successResponse as any);

      // Act
      await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      const callArgs = mockCreateFn.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      const promptContent = userMessage?.content;

      // Verify ONLY quantitative indicators are included
      expect(promptContent).toContain('RSI: 55.50');
      expect(promptContent).toContain('MACD');
      expect(promptContent).toContain('SMA');
      expect(promptContent).toContain('Bollinger Bands');
      expect(promptContent).toContain('Support & Resistance');
      expect(promptContent).toContain('Trendlines');

      // CRITICAL: Verify NO raw market data is included
      expect(promptContent).not.toMatch(/\bopen\b/i);
      expect(promptContent).not.toMatch(/\bhigh\b/i);
      expect(promptContent).not.toMatch(/\blow\b/i);
      expect(promptContent).not.toMatch(/\bclose\b/i);
      expect(promptContent).not.toContain('volume');
      expect(promptContent).not.toContain('OHLCV');
      expect(promptContent).not.toContain('candlestick');
      expect(promptContent).not.toContain('orderBook');
      expect(promptContent).not.toContain('priceData');
    });

    it('should include options Greeks when provided in quant analysis (Requirement 18.1)', async () => {
      // Arrange
      const quantAnalysisWithGreeks: QuantAnalysisResult = {
        ...mockQuantAnalysis,
        optionsGreeks: {
          delta: 0.52,
          gamma: 0.003,
          theta: -12.5,
          vega: 45.2,
        },
      };

      const successResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'BUY',
                entryPrice: 21600,
                target: 21800,
                stopLoss: 21500,
                confidence: 0.7,
                reasoning: 'Favorable Greeks',
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValueOnce(successResponse as any);

      // Act
      await provider.generateRecommendation(mockParsedPrompt, quantAnalysisWithGreeks);

      // Assert
      const callArgs = mockCreateFn.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      const promptContent = userMessage?.content;

      // Verify options Greeks are included (processed data)
      expect(promptContent).toContain('Options Greeks');
      expect(promptContent).toContain('Delta: 0.5200');
      expect(promptContent).toContain('Gamma: 0.0030');
      expect(promptContent).toContain('Theta: -12.5000');
      expect(promptContent).toContain('Vega: 45.2000');

      // Still verify no raw market data
      expect(promptContent).not.toContain('OHLCV');
    });

    it('should include support/resistance levels with strength scores (Requirement 18.1)', async () => {
      // Arrange
      const successResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'BUY',
                entryPrice: 2460,
                target: 2520,
                stopLoss: 2430,
                confidence: 0.75,
                reasoning: 'Test',
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValueOnce(successResponse as any);

      // Act
      await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      const callArgs = mockCreateFn.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      const promptContent = userMessage?.content;

      // Verify support/resistance data (processed data from Quant Engine)
      expect(promptContent).toContain('Support & Resistance');
      expect(promptContent).toContain('2400.00');
      expect(promptContent).toContain('85%'); // Strength
      expect(promptContent).toContain('2500.00');
      expect(promptContent).toContain('72%'); // Strength
    });

    it('should include trendline analysis with slope and R² (Requirement 18.1)', async () => {
      // Arrange
      const successResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'BUY',
                entryPrice: 2460,
                target: 2520,
                stopLoss: 2430,
                confidence: 0.75,
                reasoning: 'Test',
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValueOnce(successResponse as any);

      // Act
      await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      const callArgs = mockCreateFn.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      const promptContent = userMessage?.content;

      // Verify trendline data (processed data from Quant Engine)
      expect(promptContent).toContain('Trendlines');
      expect(promptContent).toContain('Uptrend'); // Positive slope
      expect(promptContent).toContain('Slope=2.5000');
      expect(promptContent).toContain('R²=0.890');
    });

    it('should send system prompt with architectural constraints (Requirement 18.1)', async () => {
      // Arrange
      const successResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'HOLD',
                entryPrice: 0,
                target: 0,
                stopLoss: 0,
                confidence: 0.5,
                reasoning: 'Test',
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValueOnce(successResponse as any);

      // Act
      await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      const callArgs = mockCreateFn.mock.calls[0][0];
      const systemMessage = callArgs.messages.find((m: any) => m.role === 'system');
      const systemContent = systemMessage?.content;

      // Verify system prompt enforces architectural constraints
      expect(systemContent).toContain('ONLY quantitative analysis results');
      expect(systemContent).toContain('NEVER receive raw market data');
      expect(systemContent).toContain('recommendations, NOT trading orders');
      expect(systemContent).toContain('Risk Engine validation');
    });
  });

  describe('Integration: Complete error handling flow', () => {
    it('should handle complete failure scenario with retry and fallback', async () => {
      // Arrange: Simulate complete API failure
      mockCreateFn
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'));

      // Act & Assert
      await expect(
        provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
      ).rejects.toThrow('Failed to generate recommendation from OpenAI');

      // Verify retry was attempted
      expect(mockCreateFn).toHaveBeenCalledTimes(2);
    });

    it('should recover from first failure and succeed on retry', async () => {
      // Arrange
      const successResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'BUY',
                entryPrice: 2460,
                target: 2520,
                stopLoss: 2430,
                confidence: 0.75,
                reasoning: 'Recovered after retry',
              }),
            },
          },
        ],
      };

      mockCreateFn
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(successResponse as any);

      // Act
      const result = await provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(result.action).toBe('BUY');
      expect(result.reasoning).toContain('Recovered after retry');
      expect(mockCreateFn).toHaveBeenCalledTimes(2);
    });
  });
});
