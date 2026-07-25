import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIProvider } from './openai.provider';
import { ConfigService } from '../../config/config.service';
import { QuantAnalysisResult } from '../../quant/quant.service';
import { ParsedPrompt } from '../../prompt/prompt.service';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let configService: ConfigService;

  const mockQuantAnalysis: QuantAnalysisResult = {
    symbol: 'RELIANCE',
    timeframe: '1d',
    indicators: {
      rsi: 45.2,
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
      openaiApiKey: undefined, // No API key for unit tests
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
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should throw error when API key is not configured', async () => {
    await expect(
      provider.generateRecommendation(mockParsedPrompt, mockQuantAnalysis)
    ).rejects.toThrow('OpenAI API key not configured');
  });

  describe('with API key configured', () => {
    beforeEach(() => {
      // Re-create the provider with API key configured
      const mockConfigServiceWithKey = {
        openaiApiKey: 'test-api-key',
        aiModel: 'gpt-4',
        aiProvider: 'openai',
      };

      // We need to reinitialize the provider, but for testing private methods
      // we'll just test them directly without the client being initialized
    });

    it('should build structured prompt with quantitative data only', () => {
      // Access private method via type assertion for testing
      const prompt = (provider as any).buildPrompt(mockParsedPrompt, mockQuantAnalysis);

      expect(prompt).toContain('RELIANCE');
      expect(prompt).toContain('RSI: 45.20');
      expect(prompt).toContain('MACD');
      expect(prompt).toContain('Support & Resistance');
      expect(prompt).toContain('Trendlines');
      expect(prompt).not.toContain('OHLCV'); // Should NOT contain raw market data
    });

    it('should validate BUY price relationships', () => {
      const invalidBuyResponse = JSON.stringify({
        action: 'BUY',
        entryPrice: 2460,
        target: 2450, // Invalid: target should be > entryPrice
        stopLoss: 2430,
        confidence: 0.75,
        reasoning: 'Test reasoning',
      });

      const result = (provider as any).parseResponse(invalidBuyResponse, mockQuantAnalysis);

      expect(result.action).toBe('HOLD'); // Should be corrected to HOLD
      expect(result.entryPrice).toBe(0);
      expect(result.target).toBe(0);
      expect(result.stopLoss).toBe(0);
    });

    it('should validate SELL price relationships', () => {
      const invalidSellResponse = JSON.stringify({
        action: 'SELL',
        entryPrice: 2460,
        target: 2470, // Invalid: target should be < entryPrice for SELL
        stopLoss: 2480,
        confidence: 0.75,
        reasoning: 'Test reasoning',
      });

      const result = (provider as any).parseResponse(invalidSellResponse, mockQuantAnalysis);

      expect(result.action).toBe('HOLD'); // Should be corrected to HOLD
    });

    it('should clamp confidence to 0-1 range', () => {
      const responseWithInvalidConfidence = JSON.stringify({
        action: 'BUY',
        entryPrice: 2460,
        target: 2520,
        stopLoss: 2430,
        confidence: 1.5, // Invalid: > 1.0
        reasoning: 'Test reasoning',
      });

      const result = (provider as any).parseResponse(
        responseWithInvalidConfidence,
        mockQuantAnalysis
      );

      expect(result.confidence).toBe(1.0); // Should be clamped to 1.0
    });

    it('should return HOLD recommendation on parse failure', () => {
      const invalidJson = 'not valid json';

      const result = (provider as any).parseResponse(invalidJson, mockQuantAnalysis);

      expect(result.action).toBe('HOLD');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Failed to parse');
    });

    it('should generate unique recommendation IDs', () => {
      const id1 = (provider as any).generateId();
      const id2 = (provider as any).generateId();

      expect(id1).toMatch(/^rec_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^rec_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('retry logic', () => {
    it('should implement delay utility', async () => {
      const startTime = Date.now();
      await (provider as any).delay(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });
});
