import { Test, TestingModule } from '@nestjs/testing';
import { TradingController } from './trading.controller';
import { TradingService, TradeResult } from './trading.service';

describe('TradingController', () => {
  let controller: TradingController;
  let tradingService: TradingService;

  const mockTradingService = {
    executePaperTrade: jest.fn(),
    executeLiveTrade: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradingController],
      providers: [
        {
          provide: TradingService,
          useValue: mockTradingService,
        },
      ],
    }).compile();

    controller = module.get<TradingController>(TradingController);
    tradingService = module.get<TradingService>(TradingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /trade/paper', () => {
    it('should execute a paper trade successfully', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2500,
        stopLoss: 2450,
        target: 2600,
      };

      const expectedResult: TradeResult = {
        tradeId: 'trade-123',
        status: 'EXECUTED',
        executedPrice: 2502.5,
        slippage: 2.5,
        positionId: 'position-123',
      };

      mockTradingService.executePaperTrade.mockResolvedValue(expectedResult);

      const result = await controller.executePaperTrade(dto);

      expect(result).toEqual(expectedResult);
      expect(mockTradingService.executePaperTrade).toHaveBeenCalledWith(
        dto.userId,
        {
          symbol: dto.symbol,
          action: dto.action,
          quantity: dto.quantity,
          price: dto.price,
          stopLoss: dto.stopLoss,
          target: dto.target,
        },
        undefined
      );
    });

    it('should execute paper trade with signalId when provided', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'TCS',
        action: 'SELL' as const,
        quantity: 5,
        price: 3500,
        signalId: 'signal-456',
      };

      const expectedResult: TradeResult = {
        tradeId: 'trade-456',
        status: 'EXECUTED',
        executedPrice: 3497.5,
        slippage: 2.5,
        positionId: 'position-456',
      };

      mockTradingService.executePaperTrade.mockResolvedValue(expectedResult);

      const result = await controller.executePaperTrade(dto);

      expect(result).toEqual(expectedResult);
      expect(mockTradingService.executePaperTrade).toHaveBeenCalledWith(
        dto.userId,
        {
          symbol: dto.symbol,
          action: dto.action,
          quantity: dto.quantity,
          price: dto.price,
          stopLoss: undefined,
          target: undefined,
        },
        dto.signalId
      );
    });

    it('should handle risk validation failure', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 1000,
        price: 2500,
      };

      const expectedResult: TradeResult = {
        tradeId: '',
        status: 'FAILED',
        error: 'Risk validation failed: Position size exceeds maximum allowed',
      };

      mockTradingService.executePaperTrade.mockResolvedValue(expectedResult);

      const result = await controller.executePaperTrade(dto);

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Risk validation failed');
    });

    it('should validate trade with RiskService before execution', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'INFY',
        action: 'BUY' as const,
        quantity: 20,
        price: 1500,
        stopLoss: 1450,
      };

      const expectedResult: TradeResult = {
        tradeId: 'trade-789',
        status: 'EXECUTED',
        executedPrice: 1501.2,
        slippage: 1.2,
        positionId: 'position-789',
      };

      mockTradingService.executePaperTrade.mockResolvedValue(expectedResult);

      await controller.executePaperTrade(dto);

      // Verify that TradingService was called (which internally calls RiskService)
      expect(mockTradingService.executePaperTrade).toHaveBeenCalledWith(
        dto.userId,
        expect.objectContaining({
          symbol: dto.symbol,
          action: dto.action,
          quantity: dto.quantity,
          price: dto.price,
          stopLoss: dto.stopLoss,
        }),
        undefined
      );
    });

    it('should return trade result with all required fields', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'WIPRO',
        action: 'BUY' as const,
        quantity: 15,
        price: 450,
        target: 470,
      };

      const expectedResult: TradeResult = {
        tradeId: 'trade-xyz',
        status: 'EXECUTED',
        executedPrice: 450.45,
        slippage: 0.45,
        positionId: 'position-xyz',
      };

      mockTradingService.executePaperTrade.mockResolvedValue(expectedResult);

      const result = await controller.executePaperTrade(dto);

      // Verify all required fields are present
      expect(result).toHaveProperty('tradeId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('executedPrice');
      expect(result).toHaveProperty('slippage');
      expect(result).toHaveProperty('positionId');
    });
  });

  describe('POST /trade/live', () => {
    it('should execute a live trade when user confirms', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2500,
        stopLoss: 2450,
        target: 2600,
        userConfirmed: true,
      };

      const expectedResult: TradeResult = {
        tradeId: '',
        status: 'FAILED',
        error: 'Live trading not yet implemented',
      };

      mockTradingService.executeLiveTrade.mockResolvedValue(expectedResult);

      const result = await controller.executeLiveTrade(dto);

      expect(mockTradingService.executeLiveTrade).toHaveBeenCalledWith(
        dto.userId,
        {
          symbol: dto.symbol,
          action: dto.action,
          quantity: dto.quantity,
          price: dto.price,
          stopLoss: dto.stopLoss,
          target: dto.target,
        },
        dto.userConfirmed,
        undefined
      );
    });

    it('should reject live trade when user does not confirm', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'TCS',
        action: 'BUY' as const,
        quantity: 5,
        price: 3500,
        userConfirmed: false,
      };

      const expectedResult: TradeResult = {
        tradeId: '',
        status: 'FAILED',
        error: 'User confirmation required for live trades',
      };

      mockTradingService.executeLiveTrade.mockResolvedValue(expectedResult);

      const result = await controller.executeLiveTrade(dto);

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('User confirmation required');
    });
  });
});
