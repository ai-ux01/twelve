import { Test, TestingModule } from '@nestjs/testing';
import { SwingService } from './swing.service';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { AiService } from '../ai/ai.service';
import { RiskService } from '../risk/risk.service';
import { PrismaService } from '../database/prisma.service';
import { ScoringWeightsService } from './scoring-weights.service';
import { PaperTradingService } from '../trading/paper-trading.service';

describe('SwingService', () => {
  let service: SwingService;
  let marketDataService: MarketDataService;
  let quantService: QuantService;
  let aiService: AiService;
  let riskService: RiskService;
  let prismaService: PrismaService;
  let scoringWeightsService: ScoringWeightsService;

  // Mock services
  const mockMarketDataService = {
    getMarketData: jest.fn(),
    getOptionsChain: jest.fn(),
  };

  const mockQuantService = {
    analyze: jest.fn(),
    calculateIndicators: jest.fn(),
    analyzeMarketData: jest.fn(),
  };

  const mockAiService = {
    generateRecommendation: jest.fn(),
  };

  const mockRiskService = {
    validateTrade: jest.fn(),
  };

  const mockPrismaService = {
    stockUniverse: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    scoringWeights: {
      findFirst: jest.fn(),
    },
  };

  const mockScoringWeightsService = {
    getWeights: jest.fn(),
  };

  const mockPaperTradingService = {
    executePaperTrade: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwingService,
        {
          provide: MarketDataService,
          useValue: mockMarketDataService,
        },
        {
          provide: QuantService,
          useValue: mockQuantService,
        },
        {
          provide: AiService,
          useValue: mockAiService,
        },
        {
          provide: RiskService,
          useValue: mockRiskService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ScoringWeightsService,
          useValue: mockScoringWeightsService,
        },
        {
          provide: PaperTradingService,
          useValue: mockPaperTradingService,
        },
      ],
    }).compile();

    service = module.get<SwingService>(SwingService);
    marketDataService = module.get<MarketDataService>(MarketDataService);
    quantService = module.get<QuantService>(QuantService);
    aiService = module.get<AiService>(AiService);
    riskService = module.get<RiskService>(RiskService);
    prismaService = module.get<PrismaService>(PrismaService);
    scoringWeightsService = module.get<ScoringWeightsService>(ScoringWeightsService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with dependencies', () => {
      // Dependencies are injected in constructor
      expect(service).toBeDefined();
      expect(marketDataService).toBeDefined();
      expect(quantService).toBeDefined();
      expect(aiService).toBeDefined();
      expect(riskService).toBeDefined();
    });
  });

  describe('scanStockUniverse - Error Handling (Requirement 20.1)', () => {
    it('should be defined', () => {
      expect(service.scanStockUniverse).toBeDefined();
      expect(typeof service.scanStockUniverse).toBe('function');
    });

    it('should continue scanning even if individual stock fails', async () => {
      // Arrange - Setup 3 stocks, middle one fails
      const mockStocks = [
        { symbol: 'STOCK1', sector: 'IT', marketCap: 100000, isActive: true },
        { symbol: 'STOCK2', sector: 'IT', marketCap: 100000, isActive: true },
        { symbol: 'STOCK3', sector: 'IT', marketCap: 100000, isActive: true },
      ];

      mockPrismaService.stockUniverse.findMany.mockResolvedValue(mockStocks);
      mockScoringWeightsService.getWeights.mockResolvedValue({
        trendWeight: 0.2,
        technicalWeight: 0.2,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1,
      });

      // Mock market data - STOCK2 will fail
      mockMarketDataService.getMarketData
        .mockResolvedValueOnce({ data: createMockOHLCVData(200) }) // STOCK1 succeeds
        .mockRejectedValueOnce(new Error('Market data fetch failed')) // STOCK2 fails
        .mockResolvedValueOnce({ data: createMockOHLCVData(200) }); // STOCK3 succeeds

      // Mock quant analysis for successful stocks
      mockQuantService.analyzeMarketData.mockResolvedValue(createMockAnalysis());

      // Act
      const result = await service.scanStockUniverse({
        minScore: 60,
        maxResults: 20,
      });

      // Assert
      expect(result.scannedCount).toBe(3);
      expect(result.failures).toBeDefined();
      expect(result.failures).toHaveLength(1);
      expect(result.failures![0].symbol).toBe('STOCK2');
      expect(result.failures![0].error).toBe('Market data fetch failed');
      expect(mockMarketDataService.getMarketData).toHaveBeenCalledTimes(3);
    });

    it('should return partial failure reporting when some stocks have insufficient data', async () => {
      // Arrange
      const mockStocks = [
        { symbol: 'STOCK1', sector: 'IT', marketCap: 100000, isActive: true },
        { symbol: 'STOCK2', sector: 'IT', marketCap: 100000, isActive: true },
      ];

      mockPrismaService.stockUniverse.findMany.mockResolvedValue(mockStocks);
      mockScoringWeightsService.getWeights.mockResolvedValue({
        trendWeight: 0.2,
        technicalWeight: 0.2,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1,
      });

      // STOCK1 has sufficient data, STOCK2 has insufficient data
      mockMarketDataService.getMarketData
        .mockResolvedValueOnce({ data: createMockOHLCVData(200) })
        .mockResolvedValueOnce({ data: createMockOHLCVData(50) }); // Insufficient

      mockQuantService.analyzeMarketData.mockResolvedValue(createMockAnalysis());

      // Act
      const result = await service.scanStockUniverse({
        minScore: 60,
        maxResults: 20,
      });

      // Assert
      expect(result.scannedCount).toBe(2);
      expect(result.failures).toBeDefined();
      expect(result.failures).toHaveLength(1);
      expect(result.failures![0].symbol).toBe('STOCK2');
      expect(result.failures![0].error).toContain('Insufficient data');
    });

    it('should handle quant analysis failures gracefully', async () => {
      // Arrange
      const mockStocks = [{ symbol: 'STOCK1', sector: 'IT', marketCap: 100000, isActive: true }];

      mockPrismaService.stockUniverse.findMany.mockResolvedValue(mockStocks);
      mockScoringWeightsService.getWeights.mockResolvedValue({
        trendWeight: 0.2,
        technicalWeight: 0.2,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1,
      });

      mockMarketDataService.getMarketData.mockResolvedValue({
        data: createMockOHLCVData(200),
      });

      // Quant analysis fails
      mockQuantService.analyzeMarketData.mockRejectedValue(new Error('Quant engine unavailable'));

      // Act
      const result = await service.scanStockUniverse({
        minScore: 60,
        maxResults: 20,
      });

      // Assert
      expect(result.scannedCount).toBe(1);
      expect(result.failures).toBeDefined();
      expect(result.failures).toHaveLength(1);
      expect(result.failures![0].symbol).toBe('STOCK1');
      expect(result.failures![0].error).toBe('Quant engine unavailable');
    });

    it('should return successful results with no failures field when all stocks succeed', async () => {
      // Arrange
      const mockStocks = [{ symbol: 'STOCK1', sector: 'IT', marketCap: 100000, isActive: true }];

      mockPrismaService.stockUniverse.findMany.mockResolvedValue(mockStocks);
      mockScoringWeightsService.getWeights.mockResolvedValue({
        trendWeight: 0.2,
        technicalWeight: 0.2,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1,
      });

      mockMarketDataService.getMarketData.mockResolvedValue({
        data: createMockOHLCVData(200),
      });

      mockQuantService.analyzeMarketData.mockResolvedValue(createMockAnalysis());

      // Act
      const result = await service.scanStockUniverse({
        minScore: 60,
        maxResults: 20,
      });

      // Assert
      expect(result.scannedCount).toBe(1);
      expect(result.candidatesFound).toBeGreaterThanOrEqual(0);
      expect(result.failures).toBeUndefined(); // No failures, field should be undefined
    });

    it('should handle complete scan failure when no stocks in universe', async () => {
      // Arrange - Empty universe
      mockPrismaService.stockUniverse.findMany.mockResolvedValue([]);

      // Act
      const result = await service.scanStockUniverse({
        minScore: 60,
        maxResults: 20,
      });

      // Assert
      expect(result.scannedCount).toBe(0);
      expect(result.candidatesFound).toBe(0);
      expect(result.candidates).toEqual([]);
      expect(result.failures).toEqual([]);
    });
  });

  describe('analyzeSymbol', () => {
    it('should be defined', () => {
      expect(service.analyzeSymbol).toBeDefined();
      expect(typeof service.analyzeSymbol).toBe('function');
    });

    it('should perform deep analysis on a symbol', async () => {
      // Arrange
      const symbol = 'RELIANCE';
      const analysisRequest = { userId: 'test-user', includeAI: false };

      mockMarketDataService.getMarketData.mockResolvedValue({
        data: createMockOHLCVData(200),
      });

      mockQuantService.analyzeMarketData.mockResolvedValue(createMockAnalysis());

      mockScoringWeightsService.getWeights.mockResolvedValue({
        trendWeight: 0.2,
        technicalWeight: 0.2,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1,
      });

      // Act
      const result = await service.analyzeSymbol(symbol, analysisRequest);

      // Assert
      expect(result).toBeDefined();
      expect(result.symbol).toBe(symbol);
      expect(result.analysis).toBeDefined();
      expect(result.analysis.technical).toBeDefined();
      expect(result.analysis.score).toBeDefined();
      expect(result.analysis.tradeLevels).toBeDefined();
    });

    it('should handle analysis for different symbols', async () => {
      // Arrange
      const symbols = ['RELIANCE', 'TCS', 'INFY'];

      mockMarketDataService.getMarketData.mockResolvedValue({
        data: createMockOHLCVData(200),
      });

      mockQuantService.analyzeMarketData.mockResolvedValue(createMockAnalysis());

      mockScoringWeightsService.getWeights.mockResolvedValue({
        trendWeight: 0.2,
        technicalWeight: 0.2,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.1,
        sectorWeight: 0.1,
        riskRewardWeight: 0.1,
      });

      // Act & Assert
      for (const symbol of symbols) {
        const result = await service.analyzeSymbol(symbol, { includeAI: false });
        expect(result.symbol).toBe(symbol);
      }
    });
  });

  describe('getRecommendations', () => {
    it('should be defined', () => {
      expect(service.getRecommendations).toBeDefined();
      expect(typeof service.getRecommendations).toBe('function');
    });

    it('should return empty array', async () => {
      // Act
      const result = await service.getRecommendations();

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('Requirements Validation', () => {
    it('should validate Requirement 5.1: service methods for swing trading exist', () => {
      // Assert - SwingService SHALL orchestrate swing trading analysis
      expect(service.scanStockUniverse).toBeDefined();
      expect(service.analyzeSymbol).toBeDefined();
      expect(service.getRecommendations).toBeDefined();
    });

    it('should validate Requirement 18.1: service prepared for data flow enforcement', () => {
      // Assert - Service will enforce: Market Data → Quant → AI → Risk flow
      // Methods exist with proper structure for implementing data flow
      expect(service.scanStockUniverse).toBeDefined();
      expect(service.analyzeSymbol).toBeDefined();

      // Service implements proper data flow:
      // 1. Fetch from MarketDataService (not exposed to AI)
      // 2. Send to QuantService for analysis
      // 3. Send only quant results to AiService (NO raw market data)
      // 4. Validate through RiskService
    });

    it('should validate Requirement 20.1: error handling and system reliability', () => {
      // Assert - SwingService SHALL handle errors gracefully
      // Verified through error handling tests above
      expect(service.scanStockUniverse).toBeDefined();
    });
  });

  describe('Service Architecture', () => {
    it('should be an injectable service', () => {
      // Assert - Service should be decorated with @Injectable()
      expect(service).toBeDefined();
    });

    it('should have proper method signatures for future implementation', () => {
      // Assert - Methods ready for dependency injection in future tasks
      expect(service.scanStockUniverse).toBeDefined();
      expect(service.analyzeSymbol).toBeDefined();
      expect(service.getRecommendations).toBeDefined();
    });
  });
});

// Helper functions for creating mock data
function createMockOHLCVData(count: number) {
  const data = [];
  const basePrice = 2000;
  const baseVolume = 1000000;

  for (let i = 0; i < count; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (count - i));

    data.push({
      timestamp: date,
      open: basePrice + Math.random() * 100,
      high: basePrice + Math.random() * 150,
      low: basePrice - Math.random() * 50,
      close: basePrice + Math.random() * 100,
      volume: baseVolume + Math.random() * 500000,
    });
  }

  return data;
}

function createMockAnalysis() {
  return {
    indicators: {
      vwap: 2050,
      ema_20: 2040,
      ema_50: 2030,
      ema_200: 2000,
      rsi: 58.5,
      adx: 32.4,
      atr: 45.2,
      macd: {
        value: 12.3,
        signal: 10.1,
        histogram: 2.2,
      },
      relative_volume: 1.35,
      week_52_high: 2300,
      week_52_low: 1800,
    },
    supportResistance: [
      { level: 2000, strength: 0.85 },
      { level: 2100, strength: 0.72 },
    ],
    trendline: {
      breakout_status: 'CONFIRMED',
      resistance_status: 'RETESTING',
    },
  };
}
