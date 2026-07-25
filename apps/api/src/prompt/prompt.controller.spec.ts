import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException } from '@nestjs/common';
import { PromptController } from './prompt.controller';
import { PromptService, ParsedPrompt } from './prompt.service';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService, QuantAnalysisResult } from '../quant/quant.service';
import { AiService, Recommendation } from '../ai/ai.service';
import { PrismaService } from '../database/prisma.service';

describe('PromptController', () => {
  let controller: PromptController;
  let promptService: jest.Mocked<PromptService>;
  let marketDataService: jest.Mocked<MarketDataService>;
  let quantService: jest.Mocked<QuantService>;
  let aiService: jest.Mocked<AiService>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockParsedPrompt: ParsedPrompt = {
    intent: 'FIND_TRADE',
    symbols: ['RELIANCE'],
    timeframe: 'SWING',
    assetType: 'STOCK',
  };

  const mockMarketData = {
    symbol: 'RELIANCE',
    timeframe: '1d',
    data: [
      {
        timestamp: new Date('2024-01-01'),
        open: 2450,
        high: 2470,
        low: 2445,
        close: 2465,
        volume: 1000000,
      },
    ],
  };

  const mockQuantAnalysis: QuantAnalysisResult = {
    symbol: 'RELIANCE',
    timeframe: '1d',
    indicators: {
      rsi: 45.2,
      macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
      sma_20: 2455.0,
      sma_50: 2450.0,
      sma_200: 2380.0,
      ema_5: 2462.0,
      ema_15: 2458.0,
      ema_20: 2458.0,
      ema_50: 2452.0,
      ema_200: 2382.0,
      bollingerBands: { upper: 2500.0, middle: 2455.0, lower: 2410.0 },
      adx: 25.0,
      atr: 15.0,
      vwap: 2460.0,
      volume_ma: 1000000,
      relative_volume: 1.2,
      week_52_high: 2600.0,
      week_52_low: 2200.0,
      momentum: 5.0,
    },
    supportResistance: [{ level: 2400, strength: 0.85 }],
    trendlines: [{ slope: 2.5, intercept: 2350, rSquared: 0.89 }],
  };

  const mockRecommendation: Recommendation = {
    id: 'rec_123',
    action: 'BUY',
    symbol: 'RELIANCE',
    entryPrice: 2460,
    target: 2520,
    stopLoss: 2430,
    confidence: 0.75,
    reasoning: 'Strong uptrend with RSI at 45',
    quantData: mockQuantAnalysis,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromptController],
      providers: [
        {
          provide: PromptService,
          useValue: {
            parsePrompt: jest.fn(),
          },
        },
        {
          provide: MarketDataService,
          useValue: {
            getMarketData: jest.fn(),
          },
        },
        {
          provide: QuantService,
          useValue: {
            analyzeMarketData: jest.fn(),
          },
        },
        {
          provide: AiService,
          useValue: {
            generateRecommendation: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            instrument: {
              upsert: jest.fn(),
            },
            signal: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<PromptController>(PromptController);
    promptService = module.get(PromptService);
    marketDataService = module.get(MarketDataService);
    quantService = module.get(QuantService);
    aiService = module.get(AiService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('submitPrompt', () => {
    it('should orchestrate the complete flow: Prompt → MarketData → Quant → AI', async () => {
      // Setup mocks
      promptService.parsePrompt.mockReturnValue(mockParsedPrompt);
      marketDataService.getMarketData.mockResolvedValue(mockMarketData);
      quantService.analyzeMarketData.mockResolvedValue(mockQuantAnalysis);
      aiService.generateRecommendation.mockResolvedValue(mockRecommendation);
      (prismaService.instrument.upsert as jest.Mock).mockResolvedValue({
        id: 'instrument-123',
        symbol: 'RELIANCE',
      });
      (prismaService.signal.create as jest.Mock).mockResolvedValue({});

      // Execute
      const result = await controller.submitPrompt({
        prompt: 'Find the best swing trade in RELIANCE',
      });

      // Verify orchestration flow
      expect(promptService.parsePrompt).toHaveBeenCalledWith(
        'Find the best swing trade in RELIANCE'
      );
      expect(marketDataService.getMarketData).toHaveBeenCalledWith(
        'RELIANCE',
        '1d',
        expect.any(Date),
        expect.any(Date)
      );
      expect(quantService.analyzeMarketData).toHaveBeenCalledWith(
        'RELIANCE',
        '1d',
        mockMarketData.data,
        true // Task 41.2: Trendline analysis enabled
      );
      expect(aiService.generateRecommendation).toHaveBeenCalledWith(
        mockParsedPrompt,
        mockQuantAnalysis
      );

      // Verify response structure
      expect(result).toEqual({
        rawPrompt: 'Find the best swing trade in RELIANCE',
        parsed: mockParsedPrompt,
        recommendation: mockRecommendation,
      });
    });

    it('should throw BadRequestException when no symbols found in prompt', async () => {
      // Setup
      promptService.parsePrompt.mockReturnValue({
        intent: 'FIND_TRADE',
        symbols: [], // No symbols
        timeframe: 'SWING',
        assetType: 'STOCK',
      });

      // Execute & Assert
      await expect(
        controller.submitPrompt({
          prompt: 'Find the best trade',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw HttpException when market data service fails', async () => {
      // Setup
      promptService.parsePrompt.mockReturnValue(mockParsedPrompt);
      marketDataService.getMarketData.mockRejectedValue(new Error('API failure'));

      // Execute & Assert
      await expect(
        controller.submitPrompt({
          prompt: 'Find the best swing trade in RELIANCE',
        })
      ).rejects.toThrow(HttpException);
    });

    it('should throw HttpException when no market data available', async () => {
      // Setup
      promptService.parsePrompt.mockReturnValue(mockParsedPrompt);
      marketDataService.getMarketData.mockResolvedValue({
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: [], // No data
      });

      // Execute & Assert
      await expect(
        controller.submitPrompt({
          prompt: 'Find the best swing trade in RELIANCE',
        })
      ).rejects.toThrow(HttpException);
    });

    it('should ensure AI receives only quant results, NOT raw market data', async () => {
      // Setup
      promptService.parsePrompt.mockReturnValue(mockParsedPrompt);
      marketDataService.getMarketData.mockResolvedValue(mockMarketData);
      quantService.analyzeMarketData.mockResolvedValue(mockQuantAnalysis);
      aiService.generateRecommendation.mockResolvedValue(mockRecommendation);
      (prismaService.instrument.upsert as jest.Mock).mockResolvedValue({
        id: 'instrument-123',
      });
      (prismaService.signal.create as jest.Mock).mockResolvedValue({});

      // Execute
      await controller.submitPrompt({
        prompt: 'Find the best swing trade in RELIANCE',
      });

      // CRITICAL: Verify AI service receives quantAnalysis, not raw market data
      expect(aiService.generateRecommendation).toHaveBeenCalledWith(
        mockParsedPrompt,
        mockQuantAnalysis // Quant results, NOT mockMarketData
      );

      // Verify AI service did NOT receive raw market data
      expect(aiService.generateRecommendation).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.any(Array) })
      );
    });

    it('should store recommendation as Signal in database', async () => {
      // Setup
      promptService.parsePrompt.mockReturnValue(mockParsedPrompt);
      marketDataService.getMarketData.mockResolvedValue(mockMarketData);
      quantService.analyzeMarketData.mockResolvedValue(mockQuantAnalysis);
      aiService.generateRecommendation.mockResolvedValue(mockRecommendation);
      (prismaService.instrument.upsert as jest.Mock).mockResolvedValue({
        id: 'instrument-123',
        symbol: 'RELIANCE',
      });
      (prismaService.signal.create as jest.Mock).mockResolvedValue({});

      // Execute
      await controller.submitPrompt({
        prompt: 'Find the best swing trade in RELIANCE',
      });

      // Verify instrument creation
      expect(prismaService.instrument.upsert).toHaveBeenCalledWith({
        where: { symbol: 'RELIANCE' },
        update: {},
        create: {
          symbol: 'RELIANCE',
          exchange: 'NSE',
          name: 'RELIANCE',
          assetType: 'STOCK',
        },
      });

      // Verify signal creation
      expect(prismaService.signal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'rec_123',
          instrumentId: 'instrument-123',
          signalType: 'ENTRY',
          direction: 'LONG',
          entryPrice: 2460,
          stopLoss: 2430,
          target: 2520,
          confidence: 0.75,
        }),
      });
    });

    it('should not fail request if database storage fails', async () => {
      // Setup
      promptService.parsePrompt.mockReturnValue(mockParsedPrompt);
      marketDataService.getMarketData.mockResolvedValue(mockMarketData);
      quantService.analyzeMarketData.mockResolvedValue(mockQuantAnalysis);
      aiService.generateRecommendation.mockResolvedValue(mockRecommendation);
      (prismaService.instrument.upsert as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Execute - should NOT throw
      const result = await controller.submitPrompt({
        prompt: 'Find the best swing trade in RELIANCE',
      });

      // Verify result is still returned despite DB error
      expect(result.recommendation).toEqual(mockRecommendation);
    });
  });
});
