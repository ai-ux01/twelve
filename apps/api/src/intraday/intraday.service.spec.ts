import { Test, TestingModule } from '@nestjs/testing';
import { IntradayService } from './intraday.service';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { RiskService } from '../risk/risk.service';
import { AuditLogService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { IntradayRecommendationService } from './intraday-recommendation.service';

describe('IntradayService', () => {
  let service: IntradayService;
  let marketDataService: MarketDataService;
  let quantService: QuantService;

  const mockMarketDataService = {
    getMarketData: jest.fn(),
  };

  const mockQuantService = {
    analyzeMarketData: jest.fn(),
    analyzeIntraday: jest.fn().mockResolvedValue({
      symbol: 'RELIANCE',
      interval: '5m',
      data_freshness: {
        timestamp: new Date().toISOString(),
        age_seconds: 120,
        is_stale: false,
      },
      technical_analysis: {
        rsi: 58.5,
        macd: { value: 2.5, signal: 2.1, histogram: 0.4 },
        ema_9: 2460,
        ema_21: 2455,
        ema_50: 2450,
        vwap: 2458,
        atr: 15.2,
        volume: 120000,
        relative_volume: 1.25,
        bollinger_bands: { upper: 2470, middle: 2455, lower: 2440 },
        support_levels: [2440, 2430],
        resistance_levels: [2470, 2480],
      },
      score: {
        total_score: 72.5,
        components: {},
        signals: [],
      },
      recommendation: {
        signal: 'BUY',
        confidence: 0.72,
        entry: 2460,
        stop_loss: 2445,
        target: 2480,
        risk_reward: 2.67,
        rationale: 'Strong bullish setup',
      },
      current_price: 2460,
      price_change: 10,
      price_change_percent: 0.41,
      opening_range: { high: 2465, low: 2450 },
      prev_day_levels: { high: 2470, low: 2435, close: 2450 },
    }),
  };

  const mockRiskService = {};

  const mockAuditLogService = {
    logMarketDataCall: jest.fn(),
    logQuantCall: jest.fn(),
  };

  const mockPrismaService = {};

  const mockRecommendationService = {
    generateRecommendation: jest.fn().mockReturnValue({
      signal: 'BUY',
      confidence: 72,
      entry: 2460,
      stopLoss: 2445,
      target: 2480,
      riskReward: 2.67,
      rationale: 'Strong bullish setup',
      isStale: false,
      dataTimestamp: new Date().toISOString(),
      dataAge: 120,
      warnings: [],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntradayService,
        {
          provide: MarketDataService,
          useValue: mockMarketDataService,
        },
        {
          provide: QuantService,
          useValue: mockQuantService,
        },
        {
          provide: RiskService,
          useValue: mockRiskService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntradayRecommendationService,
          useValue: mockRecommendationService,
        },
      ],
    }).compile();

    service = module.get<IntradayService>(IntradayService);
    marketDataService = module.get<MarketDataService>(MarketDataService);
    quantService = module.get<QuantService>(QuantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeSymbol', () => {
    it('should fetch market data and perform analysis for default timeframes', async () => {
      // Arrange
      const symbol = 'RELIANCE';
      const mockMarketData = [
        {
          timestamp: new Date(),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
        // ... more data points to reach 50 candles
        ...Array(49).fill({
          timestamp: new Date(),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        }),
      ];

      const mockAnalysis = {
        symbol,
        timeframe: '5m',
        indicators: {
          rsi: 55.0,
          macd: { value: 10.0, signal: 8.0, histogram: 2.0 },
          vwap: 2460.0,
          ema_20: 2455.0,
          ema_50: 2450.0,
          atr: 20.0,
          relative_volume: 1.2,
        },
        supportResistance: [
          { level: 2400, strength: 0.8 },
          { level: 2500, strength: 0.7 },
        ],
        trendlines: [],
      };

      mockMarketDataService.getMarketData.mockResolvedValue({
        data: mockMarketData,
      });

      mockQuantService.analyzeMarketData.mockResolvedValue(mockAnalysis);

      mockAuditLogService.logMarketDataCall.mockResolvedValue('audit-id-1');
      mockAuditLogService.logQuantCall.mockResolvedValue('audit-id-2');

      // Act
      const result = await service.analyzeSymbol(symbol);

      // Assert
      expect(result).toBeDefined();
      expect(result.symbol).toBe(symbol);
      expect(result.dataFreshness).toBeDefined();
      expect(result.recommendation).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(mockMarketDataService.getMarketData).toHaveBeenCalled();
      expect(mockQuantService.analyzeIntraday).toHaveBeenCalled();
    });

    it('should validate data freshness and warn on stale data', async () => {
      // Arrange
      const symbol = 'RELIANCE';
      const staleTimestamp = new Date();
      staleTimestamp.setMinutes(staleTimestamp.getMinutes() - 10); // 10 minutes old

      const mockMarketData = [
        {
          timestamp: staleTimestamp,
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
        // ... more data points
        ...Array(49).fill({
          timestamp: staleTimestamp,
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        }),
      ];

      // Mock stale data
      const staleAnalysis = {
        ...(mockQuantService.analyzeIntraday.mock.results[0]?.value || {}),
        data_freshness: {
          timestamp: staleTimestamp.toISOString(),
          age_seconds: 600, // 10 minutes old
          is_stale: true,
        },
      };

      mockMarketDataService.getMarketData.mockResolvedValue({
        symbol,
        timeframe: '5m',
        data: mockMarketData,
      });

      mockQuantService.analyzeIntraday.mockResolvedValueOnce(staleAnalysis);

      mockRecommendationService.generateRecommendation.mockResolvedValueOnce({
        signal: 'NO_TRADE',
        confidence: 0,
        entry: null,
        stopLoss: null,
        target: null,
        riskReward: null,
        rationale: 'Data is stale',
        isStale: true,
        dataTimestamp: staleTimestamp.toISOString(),
        dataAge: 600,
        warnings: ['Data is 10.0 minutes old'],
      });

      mockAuditLogService.logMarketDataCall.mockResolvedValue('audit-id-1');

      // Act
      const result = await service.analyzeSymbol(symbol);

      // Assert
      expect(result).toBeDefined();
      expect(result.dataFreshness.isFresh).toBe(false);
      expect(result.dataFreshness.warning).toBeDefined();
    });

    it('should handle custom timeframes', async () => {
      // Arrange
      const symbol = 'RELIANCE';
      const customTimeframes = ['1m', '5m', '15m', '1h'];
      const mockMarketData = [
        {
          timestamp: new Date(),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
        ...Array(49).fill({
          timestamp: new Date(),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        }),
      ];

      const mockAnalysis = {
        symbol,
        timeframe: '1m',
        indicators: {
          rsi: 55.0,
          macd: { value: 10.0, signal: 8.0, histogram: 2.0 },
          vwap: 2460.0,
          ema_20: 2455.0,
          ema_50: 2450.0,
          atr: 20.0,
          relative_volume: 1.2,
        },
        supportResistance: [],
        trendlines: [],
      };

      mockMarketDataService.getMarketData.mockResolvedValue({
        data: mockMarketData,
      });

      mockQuantService.analyzeMarketData.mockResolvedValue(mockAnalysis);

      mockAuditLogService.logMarketDataCall.mockResolvedValue('audit-id-1');
      mockAuditLogService.logQuantCall.mockResolvedValue('audit-id-2');

      // Act
      const result = await service.analyzeSymbol(symbol, {
        interval: '5m',
      });

      // Assert
      expect(result).toBeDefined();
      expect(mockMarketDataService.getMarketData).toHaveBeenCalled();
    });
  });

  describe('checkDataFreshness', () => {
    it('should return freshness status for a symbol', async () => {
      // Arrange
      const symbol = 'RELIANCE';
      const freshTimestamp = new Date();
      const mockMarketData = [
        {
          timestamp: freshTimestamp,
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      mockMarketDataService.getMarketData.mockResolvedValue({
        data: mockMarketData,
      });

      // Act
      const result = await service.checkDataFreshness(symbol);

      // Assert
      expect(result).toBeDefined();
      expect(result.symbol).toBe(symbol);
      expect(result.isFresh).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });
  });
});
