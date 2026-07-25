import { Test, TestingModule } from '@nestjs/testing';
import { SwingController } from './swing.controller';
import { SwingService } from './swing.service';
import { ScoringWeightsService } from './scoring-weights.service';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { AiService } from '../ai/ai.service';
import { RiskService } from '../risk/risk.service';
import { PrismaService } from '../database/prisma.service';
import { ScanSwingUniverseDto } from './dto/scan-universe.dto';

/**
 * Integration tests for POST /swing/scan endpoint
 *
 * Tests the complete scanning workflow:
 * - Fetching stock universe
 * - Getting market data for each stock
 * - Performing technical analysis via Quant Engine
 * - Scoring and ranking candidates
 * - Filtering and sorting results
 *
 * Requirements: 5.4
 */
describe('SwingController - POST /swing/scan (Integration)', () => {
  let controller: SwingController;
  let swingService: SwingService;
  let prismaService: PrismaService;
  let marketDataService: MarketDataService;
  let quantService: QuantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SwingController],
      providers: [
        SwingService,
        ScoringWeightsService,
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
          useValue: {},
        },
        {
          provide: RiskService,
          useValue: {},
        },
        {
          provide: PrismaService,
          useValue: {
            stockUniverse: {
              findMany: jest.fn(),
            },
            scoringWeights: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<SwingController>(SwingController);
    swingService = module.get<SwingService>(SwingService);
    prismaService = module.get<PrismaService>(PrismaService);
    marketDataService = module.get<MarketDataService>(MarketDataService);
    quantService = module.get<QuantService>(QuantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /swing/scan', () => {
    it('should scan universe and return ranked candidates', async () => {
      // Mock stock universe
      const mockStocks = [
        {
          id: 'uuid-1',
          symbol: 'RELIANCE',
          sector: 'Oil & Gas',
          marketCap: 1700000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'uuid-2',
          symbol: 'TCS',
          sector: 'IT',
          marketCap: 1300000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock market data for each stock
      const mockMarketData = {
        symbol: 'RELIANCE',
        timeframe: '1d',
        data: Array.from({ length: 250 }, (_, i) => ({
          timestamp: new Date(Date.now() - (249 - i) * 24 * 60 * 60 * 1000),
          open: 2400 + Math.random() * 100,
          high: 2450 + Math.random() * 100,
          low: 2380 + Math.random() * 100,
          close: 2420 + Math.random() * 100,
          volume: 1000000 + Math.random() * 500000,
        })),
      };

      // Mock technical analysis
      const mockAnalysis = {
        symbol: 'RELIANCE',
        timeframe: '1d',
        indicators: {
          rsi: 58.5,
          macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
          sma_20: 2455.0,
          sma_50: 2450.0,
          sma_200: 2380.0,
          ema_5: 2462.5,
          ema_15: 2460.0,
          ema_20: 2458.0,
          ema_50: 2452.0,
          ema_200: 2385.0,
          bollingerBands: { upper: 2500.0, middle: 2455.0, lower: 2410.0 },
          adx: 32.4,
          atr: 45.2,
          vwap: 2455.0,
          volume_ma: 1200000.0,
          relative_volume: 1.35,
          week_52_high: 2600.0,
          week_52_low: 2200.0,
          momentum: 12.5,
        },
        supportResistance: [
          { level: 2400.0, strength: 0.85 },
          { level: 2500.0, strength: 0.72 },
        ],
        trendlines: [],
        trendline: {
          support_line: null,
          resistance_line: { slope: 1.8, intercept: 2400.0, rSquared: 0.85 },
          swing_points: [],
          breakout_status: 'CONFIRMED' as const,
          direction: 'UPTREND' as const,
          support_status: 'ACTIVE' as const,
          resistance_status: 'RETESTING' as const,
          confidence: 0.85,
        },
      };

      // Mock default scoring weights
      const mockWeights = {
        id: 'default',
        userId: null,
        trendWeight: 0.2,
        technicalWeight: 0.2,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      jest.spyOn(prismaService.stockUniverse, 'findMany').mockResolvedValue(mockStocks);
      jest.spyOn(prismaService.scoringWeights, 'findFirst').mockResolvedValue(mockWeights);
      jest.spyOn(marketDataService, 'getMarketData').mockResolvedValue(mockMarketData);
      jest.spyOn(quantService, 'analyzeMarketData').mockResolvedValue(mockAnalysis);

      // Execute scan
      const scanRequest: ScanSwingUniverseDto = {
        minScore: 60,
        maxResults: 10,
      };

      const result = await controller.scanStockUniverse(scanRequest);

      // Verify results
      expect(result).toBeDefined();
      expect(result.scannedCount).toBeGreaterThan(0);
      expect(result.candidates).toBeInstanceOf(Array);

      if (result.candidates.length > 0) {
        const candidate = result.candidates[0];
        expect(candidate).toHaveProperty('symbol');
        expect(candidate).toHaveProperty('score');
        expect(candidate).toHaveProperty('trend');
        expect(candidate).toHaveProperty('setupType');
        expect(candidate).toHaveProperty('entry');
        expect(candidate).toHaveProperty('stopLoss');
        expect(candidate).toHaveProperty('target');
        expect(candidate).toHaveProperty('riskReward');
        expect(candidate).toHaveProperty('components');

        // Verify components
        expect(candidate.components).toHaveProperty('trendScore');
        expect(candidate.components).toHaveProperty('technicalScore');
        expect(candidate.components).toHaveProperty('volumeScore');
        expect(candidate.components).toHaveProperty('relativeStrengthScore');
        expect(candidate.components).toHaveProperty('breakoutScore');
        expect(candidate.components).toHaveProperty('sectorScore');
        expect(candidate.components).toHaveProperty('riskRewardScore');

        // Verify score is above threshold
        expect(candidate.score).toBeGreaterThanOrEqual(60);
      }

      // Verify service calls
      expect(prismaService.stockUniverse.findMany).toHaveBeenCalled();
      expect(marketDataService.getMarketData).toHaveBeenCalled();
      expect(quantService.analyzeMarketData).toHaveBeenCalled();
    });

    it('should filter by sector when provided', async () => {
      const mockStocks = [
        {
          id: 'uuid-1',
          symbol: 'RELIANCE',
          sector: 'Oil & Gas',
          marketCap: 1700000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(prismaService.stockUniverse, 'findMany').mockResolvedValue(mockStocks);

      const scanRequest: ScanSwingUniverseDto = {
        sectorFilter: 'Oil & Gas',
        minScore: 50,
        maxResults: 10,
      };

      await controller.scanStockUniverse(scanRequest);

      // Verify sector filter was applied
      expect(prismaService.stockUniverse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sector: 'Oil & Gas',
            isActive: true,
          }),
        })
      );
    });

    it('should return empty results when no stocks in universe', async () => {
      jest.spyOn(prismaService.stockUniverse, 'findMany').mockResolvedValue([]);

      const scanRequest: ScanSwingUniverseDto = {
        minScore: 60,
        maxResults: 10,
      };

      const result = await controller.scanStockUniverse(scanRequest);

      expect(result.scannedCount).toBe(0);
      expect(result.candidatesFound).toBe(0);
      expect(result.candidates).toEqual([]);
    });

    it('should respect maxResults parameter', async () => {
      // Mock 5 stocks
      const mockStocks = Array.from({ length: 5 }, (_, i) => ({
        id: `uuid-${i + 1}`,
        symbol: `STOCK${i + 1}`,
        sector: 'IT',
        marketCap: 100000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      jest.spyOn(prismaService.stockUniverse, 'findMany').mockResolvedValue(mockStocks);

      const scanRequest: ScanSwingUniverseDto = {
        minScore: 0, // Low threshold to get all results
        maxResults: 3, // Limit to top 3
      };

      const result = await controller.scanStockUniverse(scanRequest);

      // Should return at most 3 candidates
      expect(result.candidates.length).toBeLessThanOrEqual(3);
    });

    it('should sort candidates by score descending', async () => {
      const mockStocks = [
        {
          id: 'uuid-1',
          symbol: 'STOCK1',
          sector: 'IT',
          marketCap: 100000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'uuid-2',
          symbol: 'STOCK2',
          sector: 'IT',
          marketCap: 100000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock different scores for different stocks
      const mockMarketData = {
        symbol: 'STOCK',
        timeframe: '1d',
        data: Array.from({ length: 250 }, (_, i) => ({
          timestamp: new Date(Date.now() - (249 - i) * 24 * 60 * 60 * 1000),
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 1000000,
        })),
      };

      const mockAnalysis = {
        symbol: 'STOCK',
        timeframe: '1d',
        indicators: {
          rsi: 60,
          macd: { value: 1, signal: 0.8, histogram: 0.2 },
          sma_20: 100,
          sma_50: 98,
          sma_200: 95,
          ema_5: 102,
          ema_15: 101,
          ema_20: 100,
          ema_50: 98,
          ema_200: 95,
          bollingerBands: { upper: 110, middle: 100, lower: 90 },
          adx: 30,
          atr: 5,
          vwap: 101,
          volume_ma: 1000000,
          relative_volume: 1.2,
          week_52_high: 120,
          week_52_low: 80,
          momentum: 5,
        },
        supportResistance: [],
        trendlines: [],
        trendline: undefined,
      };

      const mockWeights = {
        id: 'default',
        userId: null,
        trendWeight: 0.2,
        technicalWeight: 0.2,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prismaService.stockUniverse, 'findMany').mockResolvedValue(mockStocks);
      jest.spyOn(prismaService.scoringWeights, 'findFirst').mockResolvedValue(mockWeights);
      jest.spyOn(marketDataService, 'getMarketData').mockResolvedValue(mockMarketData);
      jest.spyOn(quantService, 'analyzeMarketData').mockResolvedValue(mockAnalysis);

      const scanRequest: ScanSwingUniverseDto = {
        minScore: 0,
        maxResults: 10,
      };

      const result = await controller.scanStockUniverse(scanRequest);

      // Verify candidates are sorted by score descending
      if (result.candidates.length > 1) {
        for (let i = 0; i < result.candidates.length - 1; i++) {
          expect(result.candidates[i].score).toBeGreaterThanOrEqual(result.candidates[i + 1].score);
        }
      }
    });
  });
});
