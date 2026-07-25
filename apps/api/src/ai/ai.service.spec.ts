import { Test, TestingModule } from '@nestjs/testing';
import { AiService, Recommendation } from './ai.service';
import { ConfigService as AppConfigService } from '../config/config.service';
import { QuantAnalysisResult } from '../quant/quant.service';
import { ParsedPrompt } from '../prompt/prompt.service';
import { AuditLogService } from '../audit/audit.service';
import { AiProvider } from './providers/ai-provider.interface';

describe('AiService - Error Handling', () => {
  let service: AiService;
  let mockProvider: jest.Mocked<AiProvider>;
  let mockConfigService: jest.Mocked<AppConfigService>;

  // Mock quant analysis data
  const mockQuantAnalysis: QuantAnalysisResult = {
    symbol: 'RELIANCE',
    timeframe: '1d',
    indicators: {
      rsi: 55.5,
      macd: {
        value: 12.5,
        signal: 10.2,
        histogram: 2.3,
      },
      sma_20: 2450.0,
      sma_50: 2400.0,
      sma_200: 2350.0,
      ema_20: 2455.0,
      bollingerBands: {
        upper: 2500.0,
        middle: 2450.0,
        lower: 2400.0,
      },
    },
    supportResistance: [
      { level: 2400.0, strength: 0.85 },
      { level: 2500.0, strength: 0.72 },
    ],
    trendlines: [
      {
        slope: 2.5,
        intercept: 2350.0,
        rSquared: 0.89,
      },
    ],
  };

  const mockParsedPrompt: ParsedPrompt = {
    intent: 'FIND_TRADE',
    symbols: ['RELIANCE'],
    timeframe: 'SWING',
    assetType: 'STOCK',
  };

  beforeEach(async () => {
    // Create mock provider
    mockProvider = {
      generateRecommendation: jest.fn(),
      analyzePortfolio: jest.fn(),
    };

    // Create mock config service
    mockConfigService = {
      aiProvider: 'ollama',
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'OLLAMA_BASE_URL') return 'http://localhost:11434';
        if (key === 'AI_MODEL') return 'llama2';
        return defaultValue;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AiService,
          useFactory: (configService: AppConfigService, auditLogService: any) => {
            const aiService = new AiService(configService, auditLogService);
            // Replace the provider with our mock
            (aiService as any).provider = mockProvider;
            return aiService;
          },
          inject: [AppConfigService, AuditLogService],
        },
        {
          provide: AppConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuditLogService,
          useValue: {
            logAiCall: jest.fn().mockResolvedValue('audit-id'),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  describe('Fallback Behavior When AI Unavailable', () => {
    it('should return HOLD recommendation with aiUnavailable flag when provider throws error', async () => {
      // Arrange
      mockProvider.generateRecommendation.mockRejectedValue(
        new Error('Cannot connect to Ollama at http://localhost:11434. Ensure Ollama is running.')
      );

      // Act
      const result = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert - Requirement 20.3: Return quantitative analysis without AI reasoning
      expect(result).toBeDefined();
      expect(result.action).toBe('HOLD');
      expect(result.symbol).toBe('RELIANCE');
      expect(result.entryPrice).toBe(0);
      expect(result.target).toBe(0);
      expect(result.stopLoss).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toBe('AI analysis unavailable');
      expect(result.aiUnavailable).toBe(true);
      // Critical: quantData should still be available
      expect(result.quantData).toBe(mockQuantAnalysis);
      expect(result.quantData.indicators).toBeDefined();
    });

    it('should return HOLD recommendation with aiUnavailable flag when provider throws network error', async () => {
      // Arrange
      const networkError = new Error('ECONNREFUSED');
      (networkError as any).code = 'ECONNREFUSED';
      mockProvider.generateRecommendation.mockRejectedValue(networkError);

      // Act
      const result = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert - Requirement 20.3
      expect(result).toBeDefined();
      expect(result.action).toBe('HOLD');
      expect(result.symbol).toBe('RELIANCE');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toBe('AI analysis unavailable');
      expect(result.aiUnavailable).toBe(true);
      expect(result.quantData).toBe(mockQuantAnalysis);
    });

    it('should return HOLD recommendation with aiUnavailable flag when provider throws timeout error', async () => {
      // Arrange
      mockProvider.generateRecommendation.mockRejectedValue(new Error('Request timeout'));

      // Act
      const result = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert - Requirement 20.3
      expect(result).toBeDefined();
      expect(result.action).toBe('HOLD');
      expect(result.symbol).toBe('RELIANCE');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toBe('AI analysis unavailable');
      expect(result.aiUnavailable).toBe(true);
      expect(result.quantData).toBe(mockQuantAnalysis);
    });

    it('should return HOLD recommendation with aiUnavailable flag when provider throws model not found error', async () => {
      // Arrange
      mockProvider.generateRecommendation.mockRejectedValue(
        new Error("Model 'llama2' not found. Pull the model using: ollama pull llama2")
      );

      // Act
      const result = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert - Requirement 20.3
      expect(result).toBeDefined();
      expect(result.action).toBe('HOLD');
      expect(result.reasoning).toBe('AI analysis unavailable');
      expect(result.aiUnavailable).toBe(true);
      expect(result.quantData).toBe(mockQuantAnalysis);
    });

    it('should return HOLD recommendation with aiUnavailable flag when provider throws unknown error', async () => {
      // Arrange
      mockProvider.generateRecommendation.mockRejectedValue(new Error('Unknown error occurred'));

      // Act
      const result = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert - Requirement 20.3
      expect(result).toBeDefined();
      expect(result.action).toBe('HOLD');
      expect(result.reasoning).toBe('AI analysis unavailable');
      expect(result.aiUnavailable).toBe(true);
      expect(result.quantData).toBe(mockQuantAnalysis);
    });

    it('should return safe portfolio analysis when analyzePortfolio throws error', async () => {
      // Arrange
      const mockPortfolioState = {
        totalValue: 500000,
        cashBalance: 200000,
        positions: [],
      };
      mockProvider.analyzePortfolio.mockRejectedValue(new Error('AI service unavailable'));

      // Act
      const result = await service.analyzePortfolio(mockPortfolioState as any, [mockQuantAnalysis]);

      // Assert
      expect(result).toBeDefined();
      expect(result.healthScore).toBe(0);
      expect(result.recommendations).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Portfolio analysis error');
      expect(result.warnings[0]).toContain('AI service unavailable');
    });
  });

  describe('AI Only Receives Quant Results (Architectural Constraint)', () => {
    it('should pass only quantitative analysis to provider, not raw market data', async () => {
      // Arrange
      const mockRecommendation: Omit<Recommendation, 'id' | 'quantData'> = {
        action: 'BUY',
        symbol: 'RELIANCE',
        entryPrice: 2460,
        target: 2520,
        stopLoss: 2430,
        confidence: 0.75,
        reasoning: 'Strong uptrend with favorable indicators',
      };
      mockProvider.generateRecommendation.mockResolvedValue(mockRecommendation);

      // Act
      await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(mockProvider.generateRecommendation).toHaveBeenCalledTimes(1);

      // Verify the provider receives quantAnalysis (processed data)
      const callArgs = mockProvider.generateRecommendation.mock.calls[0];
      expect(callArgs[0]).toBe(mockParsedPrompt);
      expect(callArgs[1]).toBe(mockQuantAnalysis);

      // Verify quantAnalysis contains ONLY processed indicators, not raw OHLCV
      const quantAnalysisArg = callArgs[1];
      expect(quantAnalysisArg).toHaveProperty('indicators');
      expect(quantAnalysisArg).toHaveProperty('supportResistance');
      expect(quantAnalysisArg).toHaveProperty('trendlines');

      // Critical: Verify NO raw market data properties exist
      expect(quantAnalysisArg).not.toHaveProperty('ohlcv');
      expect(quantAnalysisArg).not.toHaveProperty('priceData');
      expect(quantAnalysisArg).not.toHaveProperty('candlesticks');
      expect(quantAnalysisArg).not.toHaveProperty('orderBook');
    });

    it('should attach quantData to the final recommendation', async () => {
      // Arrange
      const mockRecommendation: Omit<Recommendation, 'id' | 'quantData'> = {
        action: 'BUY',
        symbol: 'RELIANCE',
        entryPrice: 2460,
        target: 2520,
        stopLoss: 2430,
        confidence: 0.75,
        reasoning: 'Strong uptrend with favorable indicators',
      };
      mockProvider.generateRecommendation.mockResolvedValue(mockRecommendation);

      // Act
      const result = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(result.quantData).toBe(mockQuantAnalysis);
      expect(result.quantData.symbol).toBe('RELIANCE');
      expect(result.quantData.indicators).toBeDefined();
    });

    it('should pass quantAnalysis array to analyzePortfolio, not raw data', async () => {
      // Arrange
      const mockPortfolioState = {
        totalValue: 500000,
        cashBalance: 200000,
        positions: [],
      };
      const mockAnalysis = {
        healthScore: 85,
        recommendations: ['Portfolio is well balanced'],
        warnings: [],
      };
      mockProvider.analyzePortfolio.mockResolvedValue(mockAnalysis);

      const quantAnalysisArray = [mockQuantAnalysis];

      // Act
      await service.analyzePortfolio(mockPortfolioState as any, quantAnalysisArray);

      // Assert
      expect(mockProvider.analyzePortfolio).toHaveBeenCalledTimes(1);

      const callArgs = mockProvider.analyzePortfolio.mock.calls[0];
      expect(callArgs[0]).toBe(mockPortfolioState);
      expect(callArgs[1]).toBe(quantAnalysisArray);

      // Verify each element in the array contains only processed data
      const quantAnalysisArrayArg = callArgs[1];
      expect(Array.isArray(quantAnalysisArrayArg)).toBe(true);
      quantAnalysisArrayArg.forEach((qa: any) => {
        expect(qa).toHaveProperty('indicators');
        expect(qa).not.toHaveProperty('ohlcv');
        expect(qa).not.toHaveProperty('priceData');
      });
    });
  });

  describe('Success Cases (Error Handling Verification)', () => {
    it('should generate recommendation successfully when provider succeeds', async () => {
      // Arrange
      const mockRecommendation: Omit<Recommendation, 'id' | 'quantData'> = {
        action: 'BUY',
        symbol: 'RELIANCE',
        entryPrice: 2460,
        target: 2520,
        stopLoss: 2430,
        confidence: 0.75,
        reasoning: 'Strong uptrend with favorable indicators',
      };
      mockProvider.generateRecommendation.mockResolvedValue(mockRecommendation);

      // Act
      const result = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.id).toContain('rec_');
      expect(result.action).toBe('BUY');
      expect(result.symbol).toBe('RELIANCE');
      expect(result.entryPrice).toBe(2460);
      expect(result.target).toBe(2520);
      expect(result.stopLoss).toBe(2430);
      expect(result.confidence).toBe(0.75);
      expect(result.reasoning).toContain('Strong uptrend');
      expect(result.quantData).toBe(mockQuantAnalysis);
    });

    it('should generate unique IDs for each recommendation', async () => {
      // Arrange
      const mockRecommendation: Omit<Recommendation, 'id' | 'quantData'> = {
        action: 'BUY',
        symbol: 'RELIANCE',
        entryPrice: 2460,
        target: 2520,
        stopLoss: 2430,
        confidence: 0.75,
        reasoning: 'Strong uptrend',
      };
      mockProvider.generateRecommendation.mockResolvedValue(mockRecommendation);

      // Act
      const result1 = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);
      const result2 = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toContain('rec_');
      expect(result2.id).toContain('rec_');
    });

    it('should successfully analyze portfolio when provider succeeds', async () => {
      // Arrange
      const mockPortfolioState = {
        totalValue: 500000,
        cashBalance: 200000,
        positions: [],
      };
      const mockAnalysis = {
        healthScore: 85,
        recommendations: ['Portfolio is well balanced'],
        warnings: [],
      };
      mockProvider.analyzePortfolio.mockResolvedValue(mockAnalysis);

      // Act
      const result = await service.analyzePortfolio(mockPortfolioState as any, [mockQuantAnalysis]);

      // Assert
      expect(result).toBeDefined();
      expect(result.healthScore).toBe(85);
      expect(result.recommendations).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty reasoning in error fallback', async () => {
      // Arrange
      const errorWithoutMessage = {} as Error;
      mockProvider.generateRecommendation.mockRejectedValue(errorWithoutMessage);

      // Act
      const result = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(result.action).toBe('HOLD');
      expect(result.reasoning).toBe('AI analysis unavailable');
      expect(result.aiUnavailable).toBe(true);
      expect(result.quantData).toBe(mockQuantAnalysis);
    });

    it('should handle non-Error objects thrown by provider', async () => {
      // Arrange
      mockProvider.generateRecommendation.mockRejectedValue('String error');

      // Act
      const result = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(result.action).toBe('HOLD');
      expect(result.reasoning).toBe('AI analysis unavailable');
      expect(result.aiUnavailable).toBe(true);
      expect(result.quantData).toBe(mockQuantAnalysis);
    });

    it('should handle HOLD recommendations from provider without aiUnavailable flag', async () => {
      // Arrange
      const holdRecommendation: Omit<Recommendation, 'id' | 'quantData'> = {
        action: 'HOLD',
        symbol: 'RELIANCE',
        entryPrice: 0,
        target: 0,
        stopLoss: 0,
        confidence: 0.5,
        reasoning: 'No favorable trading conditions detected',
      };
      mockProvider.generateRecommendation.mockResolvedValue(holdRecommendation);

      // Act
      const result = await service.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Assert
      expect(result.action).toBe('HOLD');
      expect(result.entryPrice).toBe(0);
      expect(result.target).toBe(0);
      expect(result.stopLoss).toBe(0);
      expect(result.confidence).toBe(0.5);
      expect(result.reasoning).toContain('No favorable trading conditions');
      // When AI successfully returns HOLD, aiUnavailable should not be set
      expect(result.aiUnavailable).toBeUndefined();
    });
  });
});
