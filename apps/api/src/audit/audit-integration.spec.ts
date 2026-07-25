import { Test, TestingModule } from '@nestjs/testing';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { AiService } from '../ai/ai.service';
import { RiskService } from '../risk/risk.service';
import { TradingService } from '../trading/trading.service';
import { AuditLogService } from './audit.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ConfigService as AppConfigService } from '../config/config.service';
import { KiteConnectProvider } from '../market-data/providers/kite-connect.provider';
import { PaperTradingService } from '../trading/paper-trading.service';
import { KotakNeoProvider } from '../trading/brokers/kotak-neo.provider';

/**
 * Integration tests for audit logging in critical paths
 * Task 23.2: Verify audit logging is properly integrated in:
 * - Market Data API calls
 * - Quant Engine calls
 * - AI Service calls
 * - Risk Engine validations
 * - Broker API calls
 *
 * Requirement 18.6: Backend SHALL log all data flow for audit purposes
 */
describe('Audit Logging Integration (Task 23.2)', () => {
  let auditLogService: AuditLogService;
  let marketDataService: MarketDataService;
  let quantService: QuantService;
  let aiService: AiService;
  let riskService: RiskService;
  let tradingService: TradingService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    marketDataCache: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    riskProfile: {
      findUnique: jest.fn(),
    },
    portfolio: {
      findUnique: jest.fn(),
    },
    position: {
      count: jest.fn(),
    },
    liveTrade: {
      create: jest.fn(),
    },
  };

  const mockKiteConnectProvider = {
    fetchOHLCV: jest.fn(),
    fetchOptionsChain: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        QUANT_ENGINE_URL: 'http://localhost:8000',
        AI_PROVIDER: 'ollama',
        OLLAMA_BASE_URL: 'http://localhost:11434',
        OLLAMA_MODEL: 'llama3.2',
      };
      return config[key] ?? defaultValue;
    }),
  };

  const mockAppConfigService = {
    aiProvider: 'ollama' as const,
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
  };

  const mockPaperTradingService = {
    executePaperTrade: jest.fn(),
  };

  const mockKotakNeoProvider = {
    placeOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        MarketDataService,
        QuantService,
        AiService,
        RiskService,
        TradingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: KiteConnectProvider,
          useValue: mockKiteConnectProvider,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AppConfigService,
          useValue: mockAppConfigService,
        },
        {
          provide: PaperTradingService,
          useValue: mockPaperTradingService,
        },
        {
          provide: KotakNeoProvider,
          useValue: mockKotakNeoProvider,
        },
      ],
    }).compile();

    auditLogService = module.get<AuditLogService>(AuditLogService);
    marketDataService = module.get<MarketDataService>(MarketDataService);
    quantService = module.get<QuantService>(QuantService);
    aiService = module.get<AiService>(AiService);
    riskService = module.get<RiskService>(RiskService);
    tradingService = module.get<TradingService>(TradingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Market Data API Call Logging', () => {
    it('should log successful market data fetch', async () => {
      const mockOHLCVData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      mockKiteConnectProvider.fetchOHLCV.mockResolvedValue(mockOHLCVData);
      mockPrismaService.marketDataCache.findUnique.mockResolvedValue(null);
      mockPrismaService.marketDataCache.upsert.mockResolvedValue({});
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      await marketDataService.getMarketData('RELIANCE', '1d');

      // Verify audit log was created
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            service: 'market-data',
            action: 'fetch_ohlcv',
            entityType: 'symbol',
            entityId: 'RELIANCE',
            success: true,
            result: expect.objectContaining({
              timeframe: '1d',
              dataPoints: 1,
            }),
          }),
        })
      );
    });

    it('should log failed market data fetch', async () => {
      mockKiteConnectProvider.fetchOHLCV.mockRejectedValue(new Error('API rate limit exceeded'));
      mockPrismaService.marketDataCache.findUnique.mockResolvedValue(null);
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-2' });

      await expect(marketDataService.getMarketData('RELIANCE', '1d')).rejects.toThrow();

      // Verify audit log was created for failure
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            service: 'market-data',
            action: 'fetch_ohlcv',
            entityId: 'RELIANCE',
            success: false,
            error: 'API rate limit exceeded',
          }),
        })
      );
    });

    it('should log successful options chain fetch', async () => {
      const mockOptionsChain = {
        underlying: 'NIFTY',
        spotPrice: 21500,
        expiryDates: ['2024-12-26'],
        chain: [
          { strike: 21500, premium: 120, optionType: 'CALL' },
          { strike: 21500, premium: 110, optionType: 'PUT' },
        ],
      };

      mockKiteConnectProvider.fetchOptionsChain.mockResolvedValue(mockOptionsChain);
      mockPrismaService.marketDataCache.findUnique.mockResolvedValue(null);
      mockPrismaService.marketDataCache.upsert.mockResolvedValue({});
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-3' });

      await marketDataService.getOptionsChain('NIFTY');

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            service: 'market-data',
            action: 'fetch_options_chain',
            entityId: 'NIFTY',
            success: true,
            result: expect.objectContaining({
              contractsCount: 2,
            }),
          }),
        })
      );
    });
  });

  describe('Quant Engine Call Logging', () => {
    it('should log successful quant analysis', async () => {
      const mockAnalysisResult = {
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
        supportResistance: [],
        trendlines: [],
      };

      // Mock logQuantCall directly to verify it's being called
      jest.spyOn(auditLogService, 'logQuantCall').mockResolvedValue('audit-4');

      // Replace the httpClient with a mock
      (quantService as any).httpClient = {
        post: jest.fn().mockResolvedValue({ data: mockAnalysisResult }),
      };

      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-4' });

      const mockData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      await quantService.analyzeMarketData('RELIANCE', '1d', mockData);

      expect(auditLogService.logQuantCall).toHaveBeenCalledWith(
        'analyze_market_data',
        'RELIANCE',
        true,
        undefined,
        expect.objectContaining({
          timeframe: '1d',
          dataPoints: 1,
        })
      );
    });

    it('should log failed quant analysis', async () => {
      // Mock logQuantCall directly to verify it's being called
      jest.spyOn(auditLogService, 'logQuantCall').mockResolvedValue('audit-5');

      // Replace the httpClient with a mock that throws
      (quantService as any).httpClient = {
        post: jest.fn().mockRejectedValue(new Error('Quant engine timeout')),
      };

      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-5' });

      const mockData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 2450,
          high: 2470,
          low: 2445,
          close: 2465,
          volume: 1000000,
        },
      ];

      await expect(quantService.analyzeMarketData('RELIANCE', '1d', mockData)).rejects.toThrow();

      expect(auditLogService.logQuantCall).toHaveBeenCalledWith(
        'analyze_market_data',
        'RELIANCE',
        false,
        expect.stringContaining('Quant engine timeout')
      );
    });
  });

  describe('AI Service Call Logging', () => {
    it('should log successful AI recommendation generation', async () => {
      const mockParsedPrompt = {
        intent: 'FIND_TRADE' as const,
        symbols: ['RELIANCE'],
        timeframe: 'SWING' as const,
        assetType: 'STOCK' as const,
      };

      const mockQuantAnalysis = {
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
        supportResistance: [],
        trendlines: [],
      };

      // Mock logAiCall directly
      jest.spyOn(auditLogService, 'logAiCall').mockResolvedValue('audit-6');

      // Mock the AI provider's generateRecommendation method
      const mockProvider = (aiService as any).provider;
      jest.spyOn(mockProvider, 'generateRecommendation').mockResolvedValue({
        action: 'BUY',
        symbol: 'RELIANCE',
        entryPrice: 2460,
        target: 2520,
        stopLoss: 2430,
        confidence: 0.75,
        reasoning: 'Test reasoning',
      });

      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-6' });

      await aiService.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      expect(auditLogService.logAiCall).toHaveBeenCalledWith(
        'generate_recommendation',
        expect.objectContaining({
          symbol: 'RELIANCE',
          intent: 'FIND_TRADE',
        }),
        true,
        undefined,
        expect.objectContaining({
          action: 'BUY',
          confidence: 0.75,
        })
      );
    });

    it('should log failed AI call', async () => {
      const mockParsedPrompt = {
        intent: 'FIND_TRADE' as const,
        symbols: ['RELIANCE'],
        timeframe: 'SWING' as const,
        assetType: 'STOCK' as const,
      };

      const mockQuantAnalysis = {
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
        supportResistance: [],
        trendlines: [],
      };

      // Mock logAiCall directly
      jest.spyOn(auditLogService, 'logAiCall').mockResolvedValue('audit-7');

      // Mock the AI provider to throw an error
      const mockProvider = (aiService as any).provider;
      jest
        .spyOn(mockProvider, 'generateRecommendation')
        .mockRejectedValue(new Error('AI provider unavailable'));

      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-7' });

      const result = await aiService.generateRecommendation(mockParsedPrompt, mockQuantAnalysis);

      // Should return HOLD recommendation on error
      expect(result.action).toBe('HOLD');

      expect(auditLogService.logAiCall).toHaveBeenCalledWith(
        'generate_recommendation',
        expect.objectContaining({
          symbol: 'RELIANCE',
          intent: 'FIND_TRADE',
        }),
        false,
        expect.stringContaining('AI provider unavailable')
      );
    });
  });

  describe('Risk Engine Validation Logging', () => {
    it('should log successful risk validation', async () => {
      const mockRiskProfile = {
        userId: 'user-123',
        maxPositionSize: 100000,
        maxPortfolioExposure: 0.3,
        maxDrawdown: 0.05,
        maxOpenPositions: 5,
      };

      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.position.count.mockResolvedValue(2);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-8' });

      const tradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460,
        stopLoss: 2430,
      };

      const result = await riskService.validateTrade('user-123', tradeRequest);

      expect(result.passed).toBe(true);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            service: 'risk',
            action: 'validate_trade',
            success: true,
            payload: tradeRequest,
            result: expect.objectContaining({
              passed: true,
            }),
          }),
        })
      );
    });

    it('should log failed risk validation', async () => {
      const mockRiskProfile = {
        userId: 'user-123',
        maxPositionSize: 10000, // Low limit to trigger violation
        maxPortfolioExposure: 0.3,
        maxDrawdown: 0.05,
        maxOpenPositions: 5,
      };

      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.position.count.mockResolvedValue(2);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-9' });

      const tradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460, // 2460 * 10 = 24600 > 10000
        stopLoss: 2430,
      };

      const result = await riskService.validateTrade('user-123', tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            service: 'risk',
            action: 'validate_trade',
            success: false,
            result: expect.objectContaining({
              passed: false,
              violations: expect.arrayContaining([
                expect.objectContaining({
                  rule: 'MAX_POSITION_SIZE',
                }),
              ]),
            }),
          }),
        })
      );
    });
  });

  describe('Broker API Call Logging', () => {
    it('should log successful broker order placement', async () => {
      const mockRiskProfile = {
        userId: 'user-123',
        maxPositionSize: 100000,
        maxPortfolioExposure: 0.3,
        maxDrawdown: 0.05,
        maxOpenPositions: 5,
      };

      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.position.count.mockResolvedValue(2);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-10' });
      mockPrismaService.liveTrade.create.mockResolvedValue({
        id: 'trade-123',
        brokerOrderId: 'NEO-12345',
      });

      mockKotakNeoProvider.placeOrder.mockResolvedValue({
        success: true,
        status: 'PENDING',
        brokerOrderId: 'NEO-12345',
        message: 'Order placed successfully',
      });

      const tradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460,
        stopLoss: 2430,
      };

      const result = await tradingService.executeLiveTrade(
        'user-123',
        tradeRequest,
        true // userConfirmed
      );

      expect(result.status).toBe('PENDING');
      expect(result.brokerOrderId).toBe('NEO-12345');

      // Should log both risk validation and broker call
      const auditCalls = mockPrismaService.auditLog.create.mock.calls;
      const brokerAuditCall = auditCalls.find((call) => call[0].data.service === 'broker');

      expect(brokerAuditCall).toBeDefined();
      expect(brokerAuditCall[0].data).toMatchObject({
        userId: 'user-123',
        service: 'broker',
        action: 'place_order',
        success: true,
        payload: expect.objectContaining({
          symbol: 'RELIANCE',
          action: 'BUY',
        }),
        result: expect.objectContaining({
          brokerOrderId: 'NEO-12345',
          status: 'PENDING',
        }),
      });
    });

    it('should log failed broker order placement', async () => {
      const mockRiskProfile = {
        userId: 'user-123',
        maxPositionSize: 100000,
        maxPortfolioExposure: 0.3,
        maxDrawdown: 0.05,
        maxOpenPositions: 5,
      };

      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.position.count.mockResolvedValue(2);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-11' });

      mockKotakNeoProvider.placeOrder.mockResolvedValue({
        success: false,
        status: 'REJECTED',
        brokerOrderId: '',
        message: 'Insufficient funds',
      });

      const tradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460,
        stopLoss: 2430,
      };

      const result = await tradingService.executeLiveTrade('user-123', tradeRequest, true);

      expect(result.status).toBe('FAILED');

      const auditCalls = mockPrismaService.auditLog.create.mock.calls;
      const brokerAuditCall = auditCalls.find((call) => call[0].data.service === 'broker');

      expect(brokerAuditCall).toBeDefined();
      expect(brokerAuditCall[0].data).toMatchObject({
        service: 'broker',
        action: 'place_order',
        success: false,
        error: 'Insufficient funds',
      });
    });
  });

  describe('Complete Data Flow Audit Trail', () => {
    it('should verify audit logging methods are available on all services', () => {
      // Verify all services have access to audit logging
      expect((marketDataService as any).auditLogService).toBeDefined();
      expect((quantService as any).auditLogService).toBeDefined();
      expect((aiService as any).auditLogService).toBeDefined();
      expect((riskService as any).auditLogService).toBeDefined();
      expect((tradingService as any).auditLogService).toBeDefined();

      // Verify audit log methods exist
      expect(auditLogService.logMarketDataCall).toBeDefined();
      expect(auditLogService.logQuantCall).toBeDefined();
      expect(auditLogService.logAiCall).toBeDefined();
      expect(auditLogService.logRiskValidation).toBeDefined();
      expect(auditLogService.logBrokerCall).toBeDefined();
    });
  });
});
