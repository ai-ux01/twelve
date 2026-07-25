import { Test, TestingModule } from '@nestjs/testing';
import { IntradayController } from './intraday.controller';
import { IntradayService } from './intraday.service';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { RiskService } from '../risk/risk.service';
import { AuditLogService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { IntradayRecommendationService } from './intraday-recommendation.service';

/**
 * Test suite for POST /api/intraday/analyze endpoint (Task 61.1)
 *
 * Verifies:
 * 1. Endpoint accepts symbol and optional interval parameter
 * 2. Fetches intraday market data from MarketDataService
 * 3. Calls Quant Engine POST /quant/intraday/analyze
 * 4. Calls IntradayRecommendationService to generate signal
 * 5. Validates with RiskService if BUY/SELL signal generated
 * 6. Returns complete IntradayAnalysisResult with recommendation
 * 7. NO automatic refresh - manual trigger only
 */
describe('IntradayController - POST /api/intraday/analyze (Task 61.1)', () => {
  let controller: IntradayController;
  let service: IntradayService;
  let marketDataService: MarketDataService;
  let quantService: QuantService;
  let riskService: RiskService;
  let recommendationService: IntradayRecommendationService;

  const mockMarketData = {
    symbol: 'RELIANCE',
    timeframe: '5m',
    data: Array.from({ length: 100 }, (_, i) => ({
      timestamp: new Date(Date.now() - (100 - i) * 5 * 60 * 1000),
      open: 2450 + i * 0.5,
      high: 2455 + i * 0.5,
      low: 2445 + i * 0.5,
      close: 2452 + i * 0.5,
      volume: 100000 + i * 1000,
    })),
  };

  const mockQuantAnalysis = {
    symbol: 'RELIANCE',
    interval: '5m',
    data_freshness: {
      timestamp: new Date().toISOString(),
      age_seconds: 120, // 2 minutes old - fresh
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
      components: {
        trend_score: 75,
        momentum_score: 70,
        volume_score: 68,
      },
      signals: ['Bullish EMA alignment', 'Strong volume'],
    },
    recommendation: {
      signal: 'BUY',
      confidence: 0.72,
      entry: 2460,
      stop_loss: 2445,
      target: 2480,
      risk_reward: 2.67,
      rationale: 'Strong bullish setup with EMA alignment',
    },
    current_price: 2460,
    price_change: 10,
    price_change_percent: 0.41,
    opening_range: { high: 2465, low: 2450 },
    prev_day_levels: { high: 2470, low: 2435, close: 2450 },
  };

  const mockRecommendation = {
    signal: 'BUY' as const,
    confidence: 72,
    entry: 2460,
    stopLoss: 2445,
    target: 2480,
    riskReward: 2.67,
    rationale: 'Strong bullish setup with EMA alignment. Intraday score: 72.5/100.',
    isStale: false,
    dataTimestamp: new Date().toISOString(),
    dataAge: 120, // 2 minutes
    warnings: [],
  };

  const mockRiskValidation = {
    passed: true,
    violations: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntradayController],
      providers: [
        IntradayService,
        {
          provide: MarketDataService,
          useValue: {
            getMarketData: jest.fn().mockResolvedValue(mockMarketData),
          },
        },
        {
          provide: QuantService,
          useValue: {
            analyzeIntraday: jest.fn().mockResolvedValue(mockQuantAnalysis),
          },
        },
        {
          provide: RiskService,
          useValue: {
            validateTrade: jest.fn().mockResolvedValue(mockRiskValidation),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            logMarketDataCall: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: IntradayRecommendationService,
          useValue: {
            generateRecommendation: jest.fn().mockReturnValue(mockRecommendation),
          },
        },
      ],
    }).compile();

    controller = module.get<IntradayController>(IntradayController);
    service = module.get<IntradayService>(IntradayService);
    marketDataService = module.get<MarketDataService>(MarketDataService);
    quantService = module.get<QuantService>(QuantService);
    riskService = module.get<RiskService>(RiskService);
    recommendationService = module.get<IntradayRecommendationService>(
      IntradayRecommendationService
    );
  });

  describe('POST /api/intraday/analyze', () => {
    it('should accept symbol and optional interval parameter', async () => {
      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
        userId: 'test-user-id',
      };

      const result = await controller.analyzeIntraday(request);

      expect(result).toBeDefined();
      expect(result.symbol).toBe('RELIANCE');
      expect(result.interval).toBe('5m');
    });

    it('should use default interval if not provided', async () => {
      const request = {
        symbol: 'RELIANCE',
      };

      const result = await controller.analyzeIntraday(request);

      expect(result).toBeDefined();
      expect(result.interval).toBe('5m'); // Default
    });

    it('should fetch intraday market data from MarketDataService', async () => {
      const request = {
        symbol: 'RELIANCE',
        interval: '15m',
      };

      await controller.analyzeIntraday(request);

      expect(marketDataService.getMarketData).toHaveBeenCalledWith(
        'RELIANCE',
        '15m',
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should call Quant Engine analyzeIntraday', async () => {
      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
      };

      await controller.analyzeIntraday(request);

      expect(quantService.analyzeIntraday).toHaveBeenCalledWith(
        'RELIANCE',
        '5m',
        expect.any(Array),
        true, // include support/resistance
        true, // include opening range
        true // include previous day levels
      );
    });

    it('should call IntradayRecommendationService to generate signal', async () => {
      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
      };

      await controller.analyzeIntraday(request);

      expect(recommendationService.generateRecommendation).toHaveBeenCalledWith(mockQuantAnalysis);
    });

    it('should validate with RiskService if BUY signal generated', async () => {
      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
        userId: 'test-user-id',
      };

      await controller.analyzeIntraday(request);

      expect(riskService.validateTrade).toHaveBeenCalledWith('test-user-id', {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 1,
        price: 2460,
        stopLoss: 2445,
        target: 2480,
      });
    });

    it('should validate with RiskService if SELL signal generated', async () => {
      const sellRecommendation = {
        ...mockRecommendation,
        signal: 'SELL' as const,
      };

      jest
        .spyOn(recommendationService, 'generateRecommendation')
        .mockReturnValueOnce(sellRecommendation);

      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
        userId: 'test-user-id',
      };

      await controller.analyzeIntraday(request);

      expect(riskService.validateTrade).toHaveBeenCalledWith('test-user-id', {
        symbol: 'RELIANCE',
        action: 'SELL',
        quantity: 1,
        price: 2460,
        stopLoss: 2445,
        target: 2480,
      });
    });

    it('should skip risk validation if no userId provided', async () => {
      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
      };

      const result = await controller.analyzeIntraday(request);

      expect(riskService.validateTrade).not.toHaveBeenCalled();
      expect(result.riskValidation.note).toContain('no userId provided');
    });

    it('should not validate with RiskService if HOLD signal generated', async () => {
      const holdRecommendation = {
        ...mockRecommendation,
        signal: 'HOLD' as const,
      };

      jest
        .spyOn(recommendationService, 'generateRecommendation')
        .mockReturnValueOnce(holdRecommendation);

      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
        userId: 'test-user-id',
      };

      await controller.analyzeIntraday(request);

      expect(riskService.validateTrade).not.toHaveBeenCalled();
    });

    it('should not validate with RiskService if NO_TRADE signal generated', async () => {
      const noTradeRecommendation = {
        ...mockRecommendation,
        signal: 'NO_TRADE' as const,
      };

      jest
        .spyOn(recommendationService, 'generateRecommendation')
        .mockReturnValueOnce(noTradeRecommendation);

      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
        userId: 'test-user-id',
      };

      await controller.analyzeIntraday(request);

      expect(riskService.validateTrade).not.toHaveBeenCalled();
    });

    it('should return complete IntradayAnalysisResult with recommendation', async () => {
      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
        userId: 'test-user-id',
      };

      const result = await controller.analyzeIntraday(request);

      // Verify structure
      expect(result).toHaveProperty('symbol', 'RELIANCE');
      expect(result).toHaveProperty('interval', '5m');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('lastRefreshTime'); // Task 61.2: Server time when analysis ran
      expect(result).toHaveProperty('dataFreshness');
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('recommendation');
      expect(result).toHaveProperty('riskValidation');

      // Verify data freshness
      expect(result.dataFreshness).toHaveProperty('isFresh', true);
      expect(result.dataFreshness).toHaveProperty('ageMinutes');

      // Verify analysis
      expect(result.analysis).toHaveProperty('score', 72.5);
      expect(result.analysis).toHaveProperty('technical');
      expect(result.analysis).toHaveProperty('currentPrice', 2460);

      // Verify recommendation
      expect(result.recommendation).toHaveProperty('signal', 'BUY');
      expect(result.recommendation).toHaveProperty('confidence', 72);
      expect(result.recommendation).toHaveProperty('entry', 2460);
      expect(result.recommendation).toHaveProperty('stopLoss', 2445);
      expect(result.recommendation).toHaveProperty('target', 2480);
      expect(result.recommendation).toHaveProperty('riskReward', 2.67);
      expect(result.recommendation).toHaveProperty('isStale', false); // Task 61.2
      expect(result.recommendation).toHaveProperty('dataTimestamp'); // Task 61.2
      expect(result.recommendation).toHaveProperty('dataAge', 120); // Task 61.2: Seconds since latest candle

      // Verify risk validation
      expect(result.riskValidation).toHaveProperty('passed', true);
      expect(result.riskValidation).toHaveProperty('violations');
    });

    it('should handle risk validation failures gracefully', async () => {
      const failedRiskValidation = {
        passed: false,
        violations: [
          {
            rule: 'MAX_POSITION_SIZE',
            message: 'Position size exceeds maximum',
            severity: 'ERROR' as const,
          },
        ],
      };

      jest.spyOn(riskService, 'validateTrade').mockResolvedValueOnce(failedRiskValidation);

      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
        userId: 'test-user-id',
      };

      const result = await controller.analyzeIntraday(request);

      expect(result.riskValidation.passed).toBe(false);
      expect(result.riskValidation.violations.length).toBeGreaterThan(0);
      expect(result.recommendation.warnings).toContain(
        'Risk: Position size exceeds maximum (ERROR)'
      );
    });

    it('should enforce manual trigger only (no automatic refresh)', async () => {
      // This endpoint should only be called when explicitly invoked
      // There should be no automatic polling or refresh mechanism
      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
      };

      await controller.analyzeIntraday(request);

      // Verify it only fetches data once per call
      expect(marketDataService.getMarketData).toHaveBeenCalledTimes(1);
    });

    it('should throw error for invalid interval', async () => {
      const request = {
        symbol: 'RELIANCE',
        interval: 'invalid',
      };

      await expect(controller.analyzeIntraday(request)).rejects.toThrow();
    });

    it('should throw error if insufficient market data', async () => {
      const insufficientData = {
        symbol: 'RELIANCE',
        timeframe: '5m',
        data: Array.from({ length: 10 }, (_, i) => ({
          timestamp: new Date(Date.now() - (10 - i) * 5 * 60 * 1000),
          open: 2450,
          high: 2455,
          low: 2445,
          close: 2452,
          volume: 100000,
        })),
      };

      jest.spyOn(marketDataService, 'getMarketData').mockResolvedValueOnce(insufficientData);

      const request = {
        symbol: 'RELIANCE',
        interval: '5m',
      };

      await expect(controller.analyzeIntraday(request)).rejects.toThrow('Insufficient data');
    });
  });
});
