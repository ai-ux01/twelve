import { Test, TestingModule } from '@nestjs/testing';
import { SwingController } from './swing.controller';
import { SwingService } from './swing.service';
import { ScoringWeightsService } from './scoring-weights.service';
import {
  ExecuteSwingPaperTradeDto,
  ExecuteSwingPaperTradeResponseDto,
} from './dto/paper-trade.dto';

/**
 * Unit tests for swing paper trade execution
 * Requirements: 5.7 (21.7) - Paper trading for swing opportunities
 */
describe('SwingController - POST /swing/paper-trade', () => {
  let controller: SwingController;
  let swingService: SwingService;

  const mockSwingService = {
    executePaperTrade: jest.fn(),
    scanStockUniverse: jest.fn(),
    getStockUniverse: jest.fn(),
    getStock: jest.fn(),
    addStock: jest.fn(),
    updateStock: jest.fn(),
    removeStock: jest.fn(),
    initializeDefaultUniverse: jest.fn(),
  };

  const mockScoringWeightsService = {
    getWeights: jest.fn(),
    getDefaultWeights: jest.fn(),
    setUserWeights: jest.fn(),
    setDefaultWeights: jest.fn(),
    deleteUserWeights: jest.fn(),
    initializeDefaultWeights: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SwingController],
      providers: [
        { provide: SwingService, useValue: mockSwingService },
        { provide: ScoringWeightsService, useValue: mockScoringWeightsService },
      ],
    }).compile();

    controller = module.get<SwingController>(SwingController);
    swingService = module.get<SwingService>(SwingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executePaperTrade', () => {
    it('should execute a paper trade successfully', async () => {
      // Arrange
      const tradeRequest: ExecuteSwingPaperTradeDto = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        quantity: 10,
        entryPrice: 2450.5,
        stopLoss: 2400.0,
        target: 2550.0,
      };

      const expectedResponse: ExecuteSwingPaperTradeResponseDto = {
        success: true,
        tradeId: 'trade-abc-123',
        message: 'Paper trade executed successfully for RELIANCE',
        trade: {
          symbol: 'RELIANCE',
          quantity: 10,
          entryPrice: 2452.25, // With slippage
          stopLoss: 2400.0,
          target: 2550.0,
          status: 'OPEN',
          simulatedSlippage: 1.75,
        },
      };

      mockSwingService.executePaperTrade.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.executePaperTrade(tradeRequest);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockSwingService.executePaperTrade).toHaveBeenCalledWith(tradeRequest);
      expect(result.success).toBe(true);
      expect(result.tradeId).toBe('trade-abc-123');
      expect(result.trade.status).toBe('OPEN');
    });

    it('should handle paper trade execution failure', async () => {
      // Arrange
      const tradeRequest: ExecuteSwingPaperTradeDto = {
        userId: 'user-123',
        symbol: 'INVALID',
        quantity: 10,
        entryPrice: 100.0,
        stopLoss: 95.0,
        target: 110.0,
      };

      const expectedResponse: ExecuteSwingPaperTradeResponseDto = {
        success: false,
        tradeId: '',
        message: 'Failed to execute paper trade: Symbol not found',
        trade: {
          symbol: 'INVALID',
          quantity: 10,
          entryPrice: 100.0,
          stopLoss: 95.0,
          target: 110.0,
          status: 'FAILED',
          simulatedSlippage: 0,
        },
      };

      mockSwingService.executePaperTrade.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.executePaperTrade(tradeRequest);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(result.success).toBe(false);
      expect(result.trade.status).toBe('FAILED');
    });

    it('should execute paper trade with optional signalId', async () => {
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

      const expectedResponse: ExecuteSwingPaperTradeResponseDto = {
        success: true,
        tradeId: 'trade-def-456',
        message: 'Paper trade executed successfully for TCS',
        trade: {
          symbol: 'TCS',
          quantity: 5,
          entryPrice: 3503.5,
          stopLoss: 3450.0,
          target: 3600.0,
          status: 'OPEN',
          simulatedSlippage: 3.5,
        },
      };

      mockSwingService.executePaperTrade.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.executePaperTrade(tradeRequest);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockSwingService.executePaperTrade).toHaveBeenCalledWith(tradeRequest);
      expect(result.success).toBe(true);
    });

    it('should include simulated slippage in successful execution', async () => {
      // Arrange
      const tradeRequest: ExecuteSwingPaperTradeDto = {
        userId: 'user-123',
        symbol: 'INFY',
        quantity: 20,
        entryPrice: 1450.0,
        stopLoss: 1420.0,
        target: 1500.0,
      };

      const expectedResponse: ExecuteSwingPaperTradeResponseDto = {
        success: true,
        tradeId: 'trade-ghi-789',
        message: 'Paper trade executed successfully for INFY',
        trade: {
          symbol: 'INFY',
          quantity: 20,
          entryPrice: 1452.18, // Entry + slippage
          stopLoss: 1420.0,
          target: 1500.0,
          status: 'OPEN',
          simulatedSlippage: 2.18,
        },
      };

      mockSwingService.executePaperTrade.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.executePaperTrade(tradeRequest);

      // Assert
      expect(result.trade.simulatedSlippage).toBeGreaterThan(0);
      expect(result.trade.entryPrice).toBeGreaterThan(tradeRequest.entryPrice);
    });
  });
});
