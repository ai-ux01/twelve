import { Test, TestingModule } from '@nestjs/testing';
import { PromptBuilderService } from './prompt-builder.service';
import { ParsedPrompt } from '../prompt/prompt.service';
import { QuantAnalysisResult } from '../quant/quant.service';
import { PortfolioResponse } from '../portfolio/portfolio.service';
import { OptionsAnalysisResultDto } from '../options/dto/options-analyze.dto';

// Helper function to create complete indicator structure
function createCompleteIndicators(basePrice: number = 2450): QuantAnalysisResult['indicators'] {
  return {
    rsi: 65.5,
    macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
    sma_20: basePrice,
    sma_50: basePrice - 30,
    sma_200: basePrice - 70,
    ema_5: basePrice + 5,
    ema_15: basePrice + 3,
    ema_20: basePrice + 5,
    ema_50: basePrice - 28,
    ema_200: basePrice - 68,
    bollingerBands: { upper: basePrice + 50, middle: basePrice, lower: basePrice - 50 },
    adx: 25.0,
    atr: 15.0,
    vwap: basePrice + 10,
    volume_ma: 1000000,
    relative_volume: 1.2,
    week_52_high: basePrice + 150,
    week_52_low: basePrice - 250,
    momentum: 5.0,
  };
}

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptBuilderService],
    }).compile();

    service = module.get<PromptBuilderService>(PromptBuilderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildTradeRecommendationPrompt', () => {
    it('should build a structured prompt for trade recommendation', () => {
      const parsedPrompt: ParsedPrompt = {
        intent: 'FIND_TRADE',
        symbols: ['RELIANCE'],
        timeframe: 'SWING',
        assetType: 'STOCK',
      };

      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'RELIANCE',
        timeframe: '1d',
        indicators: createCompleteIndicators(2450),
        supportResistance: [
          { level: 2400, strength: 0.85 },
          { level: 2500, strength: 0.75 },
        ],
        trendlines: [{ slope: 2.5, intercept: 2350, rSquared: 0.89 }],
      };

      const result = service.buildTradeRecommendationPrompt(parsedPrompt, quantAnalysis);

      expect(result).toBeDefined();
      expect(result.systemPrompt).toContain('expert trading analyst');
      expect(result.systemPrompt).toContain('Swing trading');
      expect(result.userPrompt).toContain('RELIANCE');
      expect(result.userPrompt).toContain('RSI: 65.50');
      expect(result.userPrompt).toContain('MACD');
      expect(result.context.symbol).toBe('RELIANCE');
      expect(result.context.timeframe).toBe('SWING');
    });

    it('should include portfolio state when provided', () => {
      const parsedPrompt: ParsedPrompt = {
        intent: 'FIND_TRADE',
        symbols: ['TCS'],
        timeframe: 'INTRADAY',
        assetType: 'STOCK',
      };

      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'TCS',
        timeframe: '15m',
        indicators: createCompleteIndicators(3500),
        supportResistance: [],
        trendlines: [],
      };

      const portfolioState: PortfolioResponse = {
        totalValue: 1000000,
        cashBalance: 500000,
        investedValue: 500000,
        positions: [],
        totalPnL: 25000,
        dailyPnL: 1200,
        metrics: {
          totalExposure: 0.5,
          openPositions: 2,
          winRate: 68,
          avgWin: 3500,
          avgLoss: -1200,
        },
      };

      const result = service.buildTradeRecommendationPrompt(
        parsedPrompt,
        quantAnalysis,
        portfolioState
      );

      expect(result.userPrompt).toContain('Current Portfolio State');
      expect(result.userPrompt).toContain('Total Value');
      expect(result.context.portfolioState).toBeDefined();
    });

    it('should never include raw OHLCV data in prompts', () => {
      const parsedPrompt: ParsedPrompt = {
        intent: 'FIND_TRADE',
        symbols: ['INFY'],
        timeframe: 'SWING',
        assetType: 'STOCK',
      };

      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'INFY',
        timeframe: '1d',
        indicators: createCompleteIndicators(1450),
        supportResistance: [],
        trendlines: [],
      };

      const result = service.buildTradeRecommendationPrompt(parsedPrompt, quantAnalysis);

      // Should NOT contain raw OHLCV keywords
      expect(result.userPrompt).not.toContain('open');
      expect(result.userPrompt).not.toContain('high');
      expect(result.userPrompt).not.toContain('low');
      expect(result.userPrompt).not.toContain('close');
      expect(result.userPrompt).not.toContain('volume');
      expect(result.userPrompt).not.toContain('OHLCV');

      // Should contain processed indicators
      expect(result.userPrompt).toContain('RSI');
      expect(result.userPrompt).toContain('MACD');
      expect(result.userPrompt).toContain('SMA');
    });
  });

  describe('buildPortfolioAnalysisPrompt', () => {
    it('should build a structured prompt for portfolio analysis', () => {
      const portfolioState: PortfolioResponse = {
        totalValue: 1000000,
        cashBalance: 400000,
        investedValue: 600000,
        positions: [
          {
            id: '1',
            symbol: 'RELIANCE',
            quantity: 100,
            averagePrice: 2450,
            currentPrice: 2480,
            unrealizedPnL: 3000,
            unrealizedPnLPercent: 1.22,
            isPaper: false,
          },
        ],
        totalPnL: 35000,
        dailyPnL: 1500,
        metrics: {
          totalExposure: 0.6,
          openPositions: 1,
          winRate: 72,
          avgWin: 4000,
          avgLoss: -1000,
        },
      };

      const quantAnalyses: QuantAnalysisResult[] = [
        {
          symbol: 'RELIANCE',
          timeframe: '1d',
          indicators: createCompleteIndicators(2470),
          supportResistance: [],
          trendlines: [],
        },
      ];

      const result = service.buildPortfolioAnalysisPrompt(
        'Analyze my portfolio',
        portfolioState,
        quantAnalyses
      );

      expect(result).toBeDefined();
      expect(result.systemPrompt).toContain('portfolio manager');
      expect(result.userPrompt).toContain('Analyze my portfolio');
      expect(result.userPrompt).toContain('Total Value');
      expect(result.userPrompt).toContain('RELIANCE');
      expect(result.context.userIntent).toBe('ANALYZE_PORTFOLIO');
    });
  });

  describe('buildStrategyGenerationPrompt', () => {
    it('should build a structured prompt for strategy generation', () => {
      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'NIFTY',
        timeframe: '1d',
        indicators: createCompleteIndicators(21500),
        supportResistance: [
          { level: 21000, strength: 0.9 },
          { level: 22000, strength: 0.8 },
        ],
        trendlines: [{ slope: 10, intercept: 20000, rSquared: 0.85 }],
      };

      const result = service.buildStrategyGenerationPrompt(
        'Create a momentum strategy for NIFTY',
        quantAnalysis
      );

      expect(result).toBeDefined();
      expect(result.systemPrompt).toContain('quantitative trading strategist');
      expect(result.userPrompt).toContain('Create a momentum strategy');
      expect(result.userPrompt).toContain('NIFTY');
      expect(result.context.userIntent).toBe('GENERATE_STRATEGY');
      expect(result.context.symbol).toBe('NIFTY');
    });
  });

  describe('prompt content validation', () => {
    it('should format RSI with interpretation', () => {
      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'TEST',
        timeframe: '1d',
        indicators: {
          ...createCompleteIndicators(100),
          rsi: 75, // Overbought - override for this test
        },
        supportResistance: [],
        trendlines: [],
      };

      const parsedPrompt: ParsedPrompt = {
        intent: 'FIND_TRADE',
        symbols: ['TEST'],
        timeframe: 'SWING',
        assetType: 'STOCK',
      };

      const result = service.buildTradeRecommendationPrompt(parsedPrompt, quantAnalysis);

      expect(result.userPrompt).toContain('RSI: 75.00 (Overbought)');
    });

    it('should format support/resistance levels sorted by strength', () => {
      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'TEST',
        timeframe: '1d',
        indicators: createCompleteIndicators(100),
        supportResistance: [
          { level: 2500, strength: 0.6 },
          { level: 2400, strength: 0.85 }, // Strongest
          { level: 2600, strength: 0.7 },
          { level: 2300, strength: 0.5 },
        ],
        trendlines: [],
      };

      const parsedPrompt: ParsedPrompt = {
        intent: 'FIND_TRADE',
        symbols: ['TEST'],
        timeframe: 'SWING',
        assetType: 'STOCK',
      };

      const result = service.buildTradeRecommendationPrompt(parsedPrompt, quantAnalysis);

      // Should show top 3 levels sorted by strength
      const lines = result.userPrompt.split('\n');
      const srSection = lines.filter((line) => line.includes('2400.00')); // Strongest level
      expect(srSection.length).toBeGreaterThan(0);
    });

    it('should include options Greeks when available', () => {
      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'NIFTY_CALL_21500',
        timeframe: '5m',
        indicators: createCompleteIndicators(100),
        supportResistance: [],
        trendlines: [],
        optionsGreeks: {
          delta: 0.52,
          gamma: 0.003,
          theta: -12.5,
          vega: 45.2,
        },
      };

      const parsedPrompt: ParsedPrompt = {
        intent: 'FIND_TRADE',
        symbols: ['NIFTY_CALL_21500'],
        timeframe: 'SCALPING',
        assetType: 'OPTION_CALL',
      };

      const result = service.buildTradeRecommendationPrompt(parsedPrompt, quantAnalysis);

      expect(result.userPrompt).toContain('Options Greeks');
      expect(result.userPrompt).toContain('Delta: 0.5200');
      expect(result.userPrompt).toContain('Theta: -12.5000');
    });
  });

  describe('options analysis integration (Task 74.1)', () => {
    it('should include options analysis data in prompt when provided', () => {
      const parsedPrompt: ParsedPrompt = {
        intent: 'FIND_TRADE',
        symbols: ['NIFTY'],
        timeframe: 'SCALPING',
        assetType: 'OPTION_CALL',
      };

      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'NIFTY',
        timeframe: '5m',
        indicators: createCompleteIndicators(21500),
        supportResistance: [],
        trendlines: [],
      };

      const optionsAnalysis: OptionsAnalysisResultDto = {
        symbol: 'NIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 21500,
        timestamp: new Date('2024-12-20T10:30:00Z'),
        pcrAnalysis: {
          pcrByOI: 1.35,
          pcrByVolume: 1.15,
          sentiment: 'BULLISH',
          totalCallOI: 5000000,
          totalPutOI: 6750000,
          totalCallVolume: 120000,
          totalPutVolume: 138000,
        },
        atmAnalysis: {
          spotPrice: 21500,
          atmStrike: 21500,
          strikeInterval: 50,
          nearATMStrikes: [
            {
              strike: 21450,
              distanceFromSpot: -50,
              callOI: 450000,
              putOI: 380000,
              callVolume: 12000,
              putVolume: 10000,
            },
            {
              strike: 21500,
              distanceFromSpot: 0,
              callOI: 520000,
              putOI: 490000,
              callVolume: 15000,
              putVolume: 14000,
            },
            {
              strike: 21550,
              distanceFromSpot: 50,
              callOI: 410000,
              putOI: 520000,
              callVolume: 11000,
              putVolume: 16000,
            },
          ],
        },
        oiAnalysis: {
          buildupType: 'LONG_BUILDUP',
          explanation: 'Price increasing with OI buildup indicates fresh long positions',
          supportLevels: [
            {
              strike: 21400,
              strength: 0.85,
              reason: 'High PUT OI concentration',
            },
            {
              strike: 21300,
              strength: 0.72,
              reason: 'Significant PUT writing activity',
            },
          ],
          resistanceLevels: [
            {
              strike: 21600,
              strength: 0.78,
              reason: 'High CALL OI concentration',
            },
            {
              strike: 21700,
              strength: 0.65,
              reason: 'Significant CALL writing activity',
            },
          ],
          maxCallOIStrike: 21600,
          maxPutOIStrike: 21400,
          oiChangeAnalysis: [
            {
              strike: 21500,
              callOIChange: 50000,
              putOIChange: -20000,
              interpretation: 'Fresh CALL buying, PUT unwinding - bullish signal',
            },
          ],
        },
      };

      const result = service.buildTradeRecommendationPrompt(
        parsedPrompt,
        quantAnalysis,
        undefined,
        optionsAnalysis
      );

      // Verify options analysis is included in user prompt
      expect(result.userPrompt).toContain('Options Chain Analysis');
      expect(result.userPrompt).toContain('PUT-CALL RATIO (PCR) ANALYSIS');
      expect(result.userPrompt).toContain('PCR by Open Interest: 1.35');
      expect(result.userPrompt).toContain('Market Sentiment: BULLISH');

      // Verify ATM analysis
      expect(result.userPrompt).toContain('AT-THE-MONEY (ATM) ANALYSIS');
      expect(result.userPrompt).toContain('ATM Strike: ₹21500');

      // Verify OI buildup
      expect(result.userPrompt).toContain('OPEN INTEREST (OI) BUILDUP ANALYSIS');
      expect(result.userPrompt).toContain('Buildup Pattern: LONG_BUILDUP');

      // Verify support/resistance levels
      expect(result.userPrompt).toContain('SUPPORT LEVELS');
      expect(result.userPrompt).toContain('₹21400');
      expect(result.userPrompt).toContain('RESISTANCE LEVELS');
      expect(result.userPrompt).toContain('₹21600');

      // Verify context includes options analysis
      expect(result.context.optionsAnalysis).toBeDefined();
      expect(result.context.optionsAnalysis).toContain('LONG_BUILDUP');
    });

    it('should include options-specific system prompt guidance when options analysis provided', () => {
      const parsedPrompt: ParsedPrompt = {
        intent: 'FIND_TRADE',
        symbols: ['BANKNIFTY'],
        timeframe: 'SCALPING',
        assetType: 'OPTION_PUT',
      };

      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'BANKNIFTY',
        timeframe: '5m',
        indicators: createCompleteIndicators(46500),
        supportResistance: [],
        trendlines: [],
      };

      const optionsAnalysis: OptionsAnalysisResultDto = {
        symbol: 'BANKNIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 46500,
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 0.75,
          pcrByVolume: 0.8,
          sentiment: 'BEARISH',
          totalCallOI: 8000000,
          totalPutOI: 6000000,
          totalCallVolume: 200000,
          totalPutVolume: 160000,
        },
        atmAnalysis: {
          spotPrice: 46500,
          atmStrike: 46500,
          strikeInterval: 100,
          nearATMStrikes: [],
        },
        oiAnalysis: {
          buildupType: 'SHORT_BUILDUP',
          explanation: 'Price decreasing with OI buildup indicates fresh short positions',
          supportLevels: [],
          resistanceLevels: [],
          maxCallOIStrike: 46700,
          maxPutOIStrike: 46300,
          oiChangeAnalysis: [],
        },
      };

      const result = service.buildTradeRecommendationPrompt(
        parsedPrompt,
        quantAnalysis,
        undefined,
        optionsAnalysis
      );

      // Verify options-specific system prompt instructions are included
      expect(result.systemPrompt).toContain('OPTIONS ANALYSIS PRIORITY');
      expect(result.systemPrompt).toContain('PCR (Put-Call Ratio) indicates market sentiment');
      expect(result.systemPrompt).toContain('LONG_BUILDUP');
      expect(result.systemPrompt).toContain('SHORT_BUILDUP');
      expect(result.systemPrompt).toContain('Support levels from high PUT OI');
      expect(result.systemPrompt).toContain('Resistance levels from high CALL OI');
    });

    it('should NOT include raw options chain data in prompt (architectural constraint)', () => {
      const parsedPrompt: ParsedPrompt = {
        intent: 'FIND_TRADE',
        symbols: ['NIFTY'],
        timeframe: 'SCALPING',
        assetType: 'OPTION_CALL',
      };

      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'NIFTY',
        timeframe: '5m',
        indicators: createCompleteIndicators(21500),
        supportResistance: [],
        trendlines: [],
      };

      const optionsAnalysis: OptionsAnalysisResultDto = {
        symbol: 'NIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 21500,
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 1.2,
          pcrByVolume: 1.1,
          sentiment: 'BULLISH',
          totalCallOI: 5000000,
          totalPutOI: 6000000,
          totalCallVolume: 120000,
          totalPutVolume: 132000,
        },
        atmAnalysis: {
          spotPrice: 21500,
          atmStrike: 21500,
          strikeInterval: 50,
          nearATMStrikes: [],
        },
        oiAnalysis: {
          buildupType: 'LONG_BUILDUP',
          explanation: 'Fresh long buildup',
          supportLevels: [],
          resistanceLevels: [],
          maxCallOIStrike: 21600,
          maxPutOIStrike: 21400,
          oiChangeAnalysis: [],
        },
      };

      const result = service.buildTradeRecommendationPrompt(
        parsedPrompt,
        quantAnalysis,
        undefined,
        optionsAnalysis
      );

      // Should include ONLY processed analysis data
      expect(result.userPrompt).toContain('PCR by Open Interest: 1.20');
      expect(result.userPrompt).toContain('LONG_BUILDUP');
      expect(result.userPrompt).toContain('Max CALL OI: ₹21600');
      expect(result.userPrompt).toContain('Max PUT OI: ₹21400');

      // Should NOT contain raw options chain keywords
      expect(result.userPrompt).not.toContain('bid');
      expect(result.userPrompt).not.toContain('ask');
      expect(result.userPrompt).not.toContain('last traded price');
      expect(result.userPrompt).not.toContain('contract');
      expect(result.userPrompt).not.toContain('premium');

      // Verify AI only receives processed analysis
      expect(result.context.optionsAnalysis).toBeDefined();
      expect(result.context.optionsAnalysis).not.toContain('bid');
      expect(result.context.optionsAnalysis).not.toContain('ask');
    });

    it('should provide appropriate trading implications based on PCR and OI buildup', () => {
      const parsedPrompt: ParsedPrompt = {
        intent: 'FIND_TRADE',
        symbols: ['NIFTY'],
        timeframe: 'SCALPING',
        assetType: 'INDEX',
      };

      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'NIFTY',
        timeframe: '5m',
        indicators: createCompleteIndicators(21500),
        supportResistance: [],
        trendlines: [],
      };

      // Bullish scenario: High PCR + Long Buildup
      const bullishOptionsAnalysis: OptionsAnalysisResultDto = {
        symbol: 'NIFTY',
        expiryDate: '2024-12-26',
        spotPrice: 21500,
        timestamp: new Date(),
        pcrAnalysis: {
          pcrByOI: 1.45,
          pcrByVolume: 1.3,
          sentiment: 'BULLISH',
          totalCallOI: 4500000,
          totalPutOI: 6525000,
          totalCallVolume: 110000,
          totalPutVolume: 143000,
        },
        atmAnalysis: {
          spotPrice: 21500,
          atmStrike: 21500,
          strikeInterval: 50,
          nearATMStrikes: [],
        },
        oiAnalysis: {
          buildupType: 'LONG_BUILDUP',
          explanation: 'Strong bullish buildup',
          supportLevels: [],
          resistanceLevels: [],
          maxCallOIStrike: 21600,
          maxPutOIStrike: 21400,
          oiChangeAnalysis: [],
        },
      };

      const result = service.buildTradeRecommendationPrompt(
        parsedPrompt,
        quantAnalysis,
        undefined,
        bullishOptionsAnalysis
      );

      // Verify bullish trading implications
      expect(result.userPrompt).toContain('BULLISH SIGNAL');
      expect(result.userPrompt).toContain('STRONG BULLISH: Fresh long positions being added');
      expect(result.userPrompt).toContain('Consider CALL options');
      expect(result.userPrompt).toContain('Fresh buying momentum');
    });

    it('should work correctly when options analysis is not provided', () => {
      const parsedPrompt: ParsedPrompt = {
        intent: 'FIND_TRADE',
        symbols: ['RELIANCE'],
        timeframe: 'SWING',
        assetType: 'STOCK',
      };

      const quantAnalysis: QuantAnalysisResult = {
        symbol: 'RELIANCE',
        timeframe: '1d',
        indicators: createCompleteIndicators(2450),
        supportResistance: [],
        trendlines: [],
      };

      const result = service.buildTradeRecommendationPrompt(
        parsedPrompt,
        quantAnalysis,
        undefined,
        undefined
      );

      // Should not include options analysis section
      expect(result.userPrompt).not.toContain('Options Chain Analysis');
      expect(result.userPrompt).not.toContain('PCR');
      expect(result.context.optionsAnalysis).toBeUndefined();

      // System prompt should not include options guidance
      expect(result.systemPrompt).not.toContain('OPTIONS ANALYSIS PRIORITY');
    });
  });
});
