import { Test, TestingModule } from '@nestjs/testing';
import { SwingService } from './swing.service';
import { PaperTradingService } from '../trading/paper-trading.service';
import { ExecuteSwingPaperTradeDto } from './dto/paper-trade.dto';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { AiService } from '../ai/ai.service';
import { RiskService } from '../risk/risk.service';
import { PrismaService } from '../database/prisma.service';
import { ScoringWeightsService } from './scoring-weights.service';

/**
 * Integration tests for swing paper trade execution
 *
 * Tests the integration between SwingService and PaperTradingService
 * to ensure paper trades are executed correctly for swing opportunities.
 *
 * Requirements: 5.7 (21.7) - Paper trading for swing opportunities
 */
describe('SwingService - Paper Trade Integration', () => {
  let swingService: SwingService;
  let paperTradingService: PaperTradingService;

  const mockMarketDataService = {
    getMarketData: jest.fn(),
  };

  const mockQuantService = {
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
    paperTrade: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    tradeExecution: {
      create: jest.fn(),
    },
    portfolio: {
      findUnique: jest.fn(),
    },
    position: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockScoringWeightsService = {
    getWeights: jest.fn(),
    getDefaultWeights: jest.fn(),
  };

  const mockPaperTradingService = {
    executePaperTrade: jest.fn(),
    closePaperTrade: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwingService,
        { provide: MarketDataService, useValue: mockMarketDataService },
        { provide: QuantService, useValue: mockQuantService },
        { provide: AiService, useValue: mockAiService },
        { provide: RiskService, useValue: mockRiskService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ScoringWeightsService, useValue: mockScoringWeightsService },
        { provide: PaperTradingService, useValue: mockPaperTradingService },
      ],
    }).compile();

    swingService = module.get<SwingService>(SwingService);
    paperTradingService = module.get<PaperTradingService>(PaperTradingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executePaperTrade', () => {
    it('should successfully execute a paper trade through PaperTradingService', async () => {
      // Arrange
      const tradeRequest: ExecuteSwingPaperTradeDto = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        quantity: 10,
        entryPrice: 2450.5,
        stopLoss: 2400.0,
        target: 2550.0,
      };

      const mockPaperTradeResult = {
        tradeId: 'trade-abc-123',
        status: 'EXECUTED' as const,
        executedPrice: 2452.25,
        slippage: 1.75,
        positionId: 'position-xyz-789',
      };

      mockPaperTradingService.executePaperTrade.mockResolvedValue(mockPaperTradeResult);

      // Act
      const result = await swingService.executePaperTrade(tradeRequest);

      // Assert
      expect(mockPaperTradingService.executePaperTrade).toHaveBeenCalledWith(
        tradeRequest.userId,
        {
          symbol: tradeRequest.symbol,
          action: 'BUY',
          quantity: tradeRequest.quantity,
          price: tradeRequest.entryPrice,
          stopLoss: tradeRequest.stopLoss,
          target: tradeRequest.target,
        },
        undefined // signalId
      );

      expect(result.success).toBe(true);
      expect(result.tradeId).toBe('trade-abc-123');
      expect(result.message).toContain('Paper trade executed successfully');
      expect(result.trade.symbol).toBe('RELIANCE');
      expect(result.trade.quantity).toBe(10);
      expect(result.trade.entryPrice).toBe(2452.25);
      expect(result.trade.simulatedSlippage).toBe(1.75);
      expect(result.trade.status).toBe('OPEN');
    });

    it('should handle PaperTradingService failures gracefully', async () => {
      // Arrange
      const tradeRequest: ExecuteSwingPaperTradeDto = {
        userId: 'user-123',
        symbol: 'INVALID',
        quantity: 10,
        entryPrice: 100.0,
        stopLoss: 95.0,
        target: 110.0,
      };

      mockPaperTradingService.executePaperTrade.mockResolvedValue({
        tradeId: '',
        status: 'FAILED' as const,
        error: 'Symbol not found',
      });

      // Act
      const result = await swingService.executePaperTrade(tradeRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to execute paper trade');
      expect(result.trade.status).toBe('FAILED');
      expect(result.trade.simulatedSlippage).toBe(0);
    });

    it('should pass signalId to PaperTradingService when provided', async () => {
      // Arrange
      const tradeRequest: ExecuteSwingPaperTradeDto = {
        userId: 'user-123',
        symbol: 'TCS',
        quantity: 5,
        entryPrice: 3500.0,
        stopLoss: 3450.0,
        target: 3600.0,
        signalId: 'signal-xyz-789',
      };

      mockPaperTradingService.executePaperTrade.mockResolvedValue({
        tradeId: 'trade-def-456',
        status: 'EXECUTED' as const,
        executedPrice: 3503.5,
        slippage: 3.5,
      });

      // Act
      const result = await swingService.executePaperTrade(tradeRequest);

      // Assert
      expect(mockPaperTradingService.executePaperTrade).toHaveBeenCalledWith(
        tradeRequest.userId,
        expect.any(Object),
        'signal-xyz-789' // signalId passed through
      );

      expect(result.success).toBe(true);
    });

    it('should handle exceptions during execution', async () => {
      // Arrange
      const tradeRequest: ExecuteSwingPaperTradeDto = {
        userId: 'user-123',
        symbol: 'INFY',
        quantity: 20,
        entryPrice: 1450.0,
        stopLoss: 1420.0,
        target: 1500.0,
      };

      mockPaperTradingService.executePaperTrade.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const result = await swingService.executePaperTrade(tradeRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error executing paper trade');
      expect(result.message).toContain('Database connection failed');
      expect(result.trade.status).toBe('FAILED');
    });

    it('should convert swing trade to correct PaperTradingService format', async () => {
      // Arrange
      const tradeRequest: ExecuteSwingPaperTradeDto = {
        userId: 'user-456',
        symbol: 'HDFCBANK',
        quantity: 15,
        entryPrice: 1600.0,
        stopLoss: 1550.0,
        target: 1700.0,
      };

      mockPaperTradingService.executePaperTrade.mockResolvedValue({
        tradeId: 'trade-ghi-789',
        status: 'EXECUTED' as const,
        executedPrice: 1602.0,
        slippage: 2.0,
      });

      // Act
      await swingService.executePaperTrade(tradeRequest);

      // Assert
      const expectedPaperTradeRequest = {
        symbol: 'HDFCBANK',
        action: 'BUY', // Swing trades are long positions
        quantity: 15,
        price: 1600.0,
        stopLoss: 1550.0,
        target: 1700.0,
      };

      expect(mockPaperTradingService.executePaperTrade).toHaveBeenCalledWith(
        'user-456',
        expectedPaperTradeRequest,
        undefined
      );
    });
  });
});
