import { Test, TestingModule } from '@nestjs/testing';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { ExecutionFlowService } from './execution-flow.service';

/**
 * Test Task 73.3: POST /api/trade/paper/option endpoint
 */
describe('TradingController - Paper Option Trading (Task 73.3)', () => {
  let controller: TradingController;
  let tradingService: TradingService;

  const mockTradingService = {
    executePaperOptionTrade: jest.fn(),
  };

  const mockExecutionFlowService = {
    getExecutionThresholds: jest.fn(),
    evaluateExecutionFlow: jest.fn(),
    executePaperTrade: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradingController],
      providers: [
        {
          provide: TradingService,
          useValue: mockTradingService,
        },
        {
          provide: ExecutionFlowService,
          useValue: mockExecutionFlowService,
        },
      ],
    }).compile();

    controller = module.get<TradingController>(TradingController);
    tradingService = module.get<TradingService>(TradingService);
  });

  describe('POST /trade/paper/option', () => {
    it('should execute paper option trade for NIFTY', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'NIFTY',
        strikePrice: 21500,
        optionType: 'CALL' as const,
        expiry: '2024-12-26',
        action: 'BUY' as const,
        quantity: 50,
        price: 150.5,
        stopLoss: 100,
        target: 200,
      };

      const expectedResult = {
        tradeId: 'trade-123',
        status: 'EXECUTED' as const,
        executedPrice: 151.2,
        slippage: 0.7,
        positionId: 'pos-123',
      };

      mockTradingService.executePaperOptionTrade.mockResolvedValue(expectedResult);

      const result = await controller.executePaperOptionTrade(dto);

      expect(result).toEqual(expectedResult);
      expect(mockTradingService.executePaperOptionTrade).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          symbol: 'NIFTY',
          strikePrice: 21500,
          optionType: 'CALL',
          expiry: '2024-12-26',
          action: 'BUY',
          quantity: 50,
          price: 150.5,
        })
      );
    });

    it('should execute paper option trade for BANKNIFTY', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'BANKNIFTY',
        strikePrice: 46000,
        optionType: 'PUT' as const,
        expiry: '2024-12-26',
        action: 'BUY' as const,
        quantity: 25,
        price: 200.75,
      };

      const expectedResult = {
        tradeId: 'trade-456',
        status: 'EXECUTED' as const,
        executedPrice: 201.5,
        slippage: 0.75,
        positionId: 'pos-456',
      };

      mockTradingService.executePaperOptionTrade.mockResolvedValue(expectedResult);

      const result = await controller.executePaperOptionTrade(dto);

      expect(result).toEqual(expectedResult);
      expect(mockTradingService.executePaperOptionTrade).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          symbol: 'BANKNIFTY',
          strikePrice: 46000,
          optionType: 'PUT',
          action: 'BUY',
          quantity: 25,
        })
      );
    });

    it('should reject invalid symbol (not NIFTY/BANKNIFTY)', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'RELIANCE', // Invalid for options
        strikePrice: 2500,
        optionType: 'CALL' as const,
        expiry: '2024-12-26',
        action: 'BUY' as const,
        quantity: 10,
        price: 100,
      };

      const result = await controller.executePaperOptionTrade(dto);

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Invalid symbol');
      expect(result.error).toContain('NIFTY and BANKNIFTY');
      expect(mockTradingService.executePaperOptionTrade).not.toHaveBeenCalled();
    });

    it('should include stopLoss and target when provided', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'NIFTY',
        strikePrice: 21600,
        optionType: 'CALL' as const,
        expiry: '2024-12-26',
        action: 'BUY' as const,
        quantity: 50,
        price: 120,
        stopLoss: 80,
        target: 180,
      };

      mockTradingService.executePaperOptionTrade.mockResolvedValue({
        tradeId: 'trade-789',
        status: 'EXECUTED' as const,
        executedPrice: 120.5,
        slippage: 0.5,
      });

      await controller.executePaperOptionTrade(dto);

      expect(mockTradingService.executePaperOptionTrade).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          stopLoss: 80,
          target: 180,
        })
      );
    });

    it('should handle signalId when provided', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'NIFTY',
        strikePrice: 21500,
        optionType: 'PUT' as const,
        expiry: '2024-12-26',
        action: 'SELL' as const,
        quantity: 50,
        price: 140,
        signalId: 'signal-abc',
      };

      mockTradingService.executePaperOptionTrade.mockResolvedValue({
        tradeId: 'trade-999',
        status: 'EXECUTED' as const,
        executedPrice: 139.3,
        slippage: 0.7,
      });

      await controller.executePaperOptionTrade(dto);

      expect(mockTradingService.executePaperOptionTrade).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          signalId: 'signal-abc',
        })
      );
    });
  });
});
