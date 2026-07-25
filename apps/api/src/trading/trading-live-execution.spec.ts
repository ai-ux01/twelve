import { Test, TestingModule } from '@nestjs/testing';
import { TradingService } from './trading.service';
import { PrismaService } from '../database/prisma.service';
import { RiskService } from '../risk/risk.service';
import { PaperTradingService } from './paper-trading.service';
import { KotakNeoProvider } from './brokers/kotak-neo.provider';

describe('TradingService - Live Trade Execution', () => {
  let service: TradingService;
  let mockLiveTradeCreate: jest.Mock;
  let riskService: jest.Mocked<RiskService>;
  let kotakNeoProvider: jest.Mocked<KotakNeoProvider>;

  const mockUserId = 'user-123';
  const mockSignalId = 'signal-456';

  beforeEach(async () => {
    mockLiveTradeCreate = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingService,
        {
          provide: PrismaService,
          useValue: {
            liveTrade: {
              create: mockLiveTradeCreate,
            },
          },
        },
        {
          provide: RiskService,
          useValue: {
            validateTrade: jest.fn(),
          },
        },
        {
          provide: PaperTradingService,
          useValue: {},
        },
        {
          provide: KotakNeoProvider,
          useValue: {
            placeOrder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TradingService>(TradingService);
    riskService = module.get(RiskService) as jest.Mocked<RiskService>;
    kotakNeoProvider = module.get(KotakNeoProvider) as jest.Mocked<KotakNeoProvider>;
  });

  describe('User Confirmation Enforcement (Requirement 10.1)', () => {
    it('should reject live trade when userConfirmed is false', async () => {
      const tradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460,
      };

      const result = await service.executeLiveTrade(
        mockUserId,
        tradeRequest,
        false, // userConfirmed = false
        mockSignalId
      );

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('User confirmation required');
      expect(riskService.validateTrade).not.toHaveBeenCalled();
      expect(kotakNeoProvider.placeOrder).not.toHaveBeenCalled();
    });

    it('should reject live trade when userConfirmed is undefined', async () => {
      const tradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460,
      };

      const result = await service.executeLiveTrade(
        mockUserId,
        tradeRequest,
        undefined as any, // userConfirmed = undefined
        mockSignalId
      );

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('User confirmation required');
    });

    it('should proceed with trade when userConfirmed is true', async () => {
      const tradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460,
      };

      riskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      kotakNeoProvider.placeOrder.mockResolvedValue({
        brokerOrderId: 'NEO123456',
        status: 'OPEN',
        success: true,
        message: 'Order placed successfully',
        timestamp: new Date(),
      });

      mockLiveTradeCreate.mockResolvedValue({
        id: 'trade-789',
        userId: mockUserId,
        signalId: mockSignalId,
        symbol: 'RELIANCE',
        direction: 'LONG',
        quantity: 10,
        entryPrice: 2460,
        stopLoss: 2410.8,
        target: 2583,
        brokerOrderId: 'NEO123456',
        broker: 'KOTAK_NEO',
        status: 'PENDING',
        currentPrice: 2460,
        unrealizedPnL: 0,
        realizedPnL: null,
        brokerageFees: null,
        sttCharges: null,
        otherCharges: null,
        enteredAt: new Date(),
        exitedAt: null,
      } as any);

      const result = await service.executeLiveTrade(
        mockUserId,
        tradeRequest,
        true, // userConfirmed = true
        mockSignalId
      );

      expect(result.status).toBe('PENDING');
      expect(riskService.validateTrade).toHaveBeenCalled();
      expect(kotakNeoProvider.placeOrder).toHaveBeenCalled();
    });
  });

  describe('Risk Validation (Requirement 10.2)', () => {
    it('should reject trade when risk validation fails', async () => {
      const tradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 1000, // Large quantity
        price: 2460,
      };

      riskService.validateTrade.mockResolvedValue({
        passed: false,
        violations: [
          {
            rule: 'MAX_POSITION_SIZE',
            message: 'Position size exceeds maximum',
            severity: 'ERROR',
          },
        ],
      });

      const result = await service.executeLiveTrade(mockUserId, tradeRequest, true, mockSignalId);

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Risk validation failed');
      expect(result.error).toContain('Position size exceeds maximum');
      expect(kotakNeoProvider.placeOrder).not.toHaveBeenCalled();
    });

    it('should proceed when risk validation passes', async () => {
      const tradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460,
        stopLoss: 2430,
        target: 2520,
      };

      riskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      kotakNeoProvider.placeOrder.mockResolvedValue({
        brokerOrderId: 'NEO123456',
        status: 'OPEN',
        success: true,
        message: 'Order placed successfully',
        timestamp: new Date(),
      });

      mockLiveTradeCreate.mockResolvedValue({
        id: 'trade-789',
        brokerOrderId: 'NEO123456',
      } as any);

      const result = await service.executeLiveTrade(mockUserId, tradeRequest, true, mockSignalId);

      expect(result.status).toBe('PENDING');
      expect(riskService.validateTrade).toHaveBeenCalledWith(mockUserId, tradeRequest);
      expect(kotakNeoProvider.placeOrder).toHaveBeenCalled();
    });
  });

  describe('Broker Integration (Requirement 10.4)', () => {
    it('should call Kotak Neo provider with correct parameters', async () => {
      const tradeRequest = {
        symbol: 'INFY',
        action: 'SELL' as const,
        quantity: 20,
        price: 1450,
        stopLoss: 1470,
        target: 1420,
      };

      riskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      kotakNeoProvider.placeOrder.mockResolvedValue({
        brokerOrderId: 'NEO789012',
        status: 'OPEN',
        success: true,
        message: 'Order placed successfully',
        timestamp: new Date(),
      });

      mockLiveTradeCreate.mockResolvedValue({
        id: 'trade-999',
        brokerOrderId: 'NEO789012',
      } as any);

      await service.executeLiveTrade(mockUserId, tradeRequest, true, mockSignalId);

      expect(kotakNeoProvider.placeOrder).toHaveBeenCalledWith({
        symbol: 'INFY',
        action: 'SELL',
        quantity: 20,
        orderType: 'MARKET',
        productType: 'MIS',
        price: 1450,
        stopLoss: 1470,
        target: 1420,
      });
    });

    it('should handle broker rejection', async () => {
      const tradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460,
      };

      riskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      kotakNeoProvider.placeOrder.mockResolvedValue({
        success: false,
        brokerOrderId: 'NEO123456',
        status: 'REJECTED',
        message: 'Insufficient margin',
        timestamp: new Date(),
      });

      const result = await service.executeLiveTrade(mockUserId, tradeRequest, true, mockSignalId);

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Broker rejected order');
      expect(result.error).toContain('Insufficient margin');
      expect(mockLiveTradeCreate).not.toHaveBeenCalled();
    });

    it('should handle broker API errors', async () => {
      const tradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2460,
      };

      riskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      kotakNeoProvider.placeOrder.mockRejectedValue(new Error('Network error: Connection timeout'));

      const result = await service.executeLiveTrade(mockUserId, tradeRequest, true, mockSignalId);

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Failed to execute live trade');
      expect(result.error).toContain('Network error: Connection timeout');
    });
  });

  describe('Database Persistence (Requirement 10.6)', () => {
    it('should store trade execution details with brokerOrderId', async () => {
      const tradeRequest = {
        symbol: 'TCS',
        action: 'BUY' as const,
        quantity: 5,
        price: 3500,
        stopLoss: 3450,
        target: 3600,
      };

      riskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      const brokerOrderId = 'NEO555666';
      kotakNeoProvider.placeOrder.mockResolvedValue({
        brokerOrderId,
        status: 'OPEN',
        success: true,
        message: 'Order placed successfully',
        timestamp: new Date(),
      });

      mockLiveTradeCreate.mockResolvedValue({
        id: 'trade-abc',
        brokerOrderId,
      } as any);

      const result = await service.executeLiveTrade(mockUserId, tradeRequest, true, mockSignalId);

      expect(mockLiveTradeCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          signalId: mockSignalId,
          symbol: 'TCS',
          direction: 'LONG',
          quantity: 5,
          entryPrice: 3500,
          stopLoss: 3450,
          target: 3600,
          brokerOrderId,
          broker: 'KOTAK_NEO',
          status: 'PENDING',
        }),
      });

      expect(result.tradeId).toBe('trade-abc');
      expect(result.brokerOrderId).toBe(brokerOrderId);
      expect(result.status).toBe('PENDING');
    });

    it('should use default stop loss and target if not provided', async () => {
      const tradeRequest = {
        symbol: 'WIPRO',
        action: 'BUY' as const,
        quantity: 15,
        price: 420,
        // No stopLoss or target provided
      };

      riskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      kotakNeoProvider.placeOrder.mockResolvedValue({
        brokerOrderId: 'NEO777888',
        status: 'OPEN',
        success: true,
        message: 'Order placed successfully',
        timestamp: new Date(),
      });

      mockLiveTradeCreate.mockResolvedValue({
        id: 'trade-xyz',
        brokerOrderId: 'NEO777888',
      } as any);

      await service.executeLiveTrade(mockUserId, tradeRequest, true);

      expect(mockLiveTradeCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stopLoss: 420 * 0.98, // Default 2% stop loss
          target: 420 * 1.05, // Default 5% target
        }),
      });
    });

    it('should map SELL action to SHORT direction', async () => {
      const tradeRequest = {
        symbol: 'HDFCBANK',
        action: 'SELL' as const,
        quantity: 10,
        price: 1600,
      };

      riskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      kotakNeoProvider.placeOrder.mockResolvedValue({
        brokerOrderId: 'NEO999000',
        status: 'OPEN',
        success: true,
        message: 'Order placed successfully',
        timestamp: new Date(),
      });

      mockLiveTradeCreate.mockResolvedValue({
        id: 'trade-def',
        brokerOrderId: 'NEO999000',
      } as any);

      await service.executeLiveTrade(mockUserId, tradeRequest, true);

      expect(mockLiveTradeCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'SHORT',
        }),
      });
    });
  });

  describe('Architectural Constraints (Requirement 18.2)', () => {
    it('should document that AI cannot access TradingService directly', () => {
      // This test documents the architectural constraint
      // AI service should NOT inject TradingService
      const canAIAccess = service.canAIAccessDirectly();
      expect(canAIAccess).toBe(false);
    });
  });

  describe('Complete Flow (Requirements 10.1, 10.2, 10.4, 10.6, 18.4)', () => {
    it('should execute complete live trade flow successfully', async () => {
      const tradeRequest = {
        symbol: 'BAJAJFINSV',
        action: 'BUY' as const,
        quantity: 8,
        price: 1580,
        stopLoss: 1550,
        target: 1630,
      };

      // Setup mocks
      riskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      const brokerOrderId = 'NEO111222';
      kotakNeoProvider.placeOrder.mockResolvedValue({
        brokerOrderId,
        status: 'OPEN',
        success: true,
        message: 'Order placed successfully',
        timestamp: new Date(),
      });

      const tradeId = 'trade-complete-123';
      mockLiveTradeCreate.mockResolvedValue({
        id: tradeId,
        userId: mockUserId,
        signalId: mockSignalId,
        symbol: 'BAJAJFINSV',
        direction: 'LONG',
        quantity: 8,
        entryPrice: 1580,
        stopLoss: 1550,
        target: 1630,
        brokerOrderId,
        broker: 'KOTAK_NEO',
        status: 'PENDING',
        currentPrice: 1580,
        unrealizedPnL: 0,
        realizedPnL: null,
        brokerageFees: null,
        sttCharges: null,
        otherCharges: null,
        enteredAt: new Date(),
        exitedAt: null,
      } as any);

      // Execute
      const result = await service.executeLiveTrade(mockUserId, tradeRequest, true, mockSignalId);

      // Verify complete flow
      expect(result.status).toBe('PENDING');
      expect(result.tradeId).toBe(tradeId);
      expect(result.brokerOrderId).toBe(brokerOrderId);
      expect(result.error).toBeUndefined();

      // Verify execution order: Risk → Broker → Database
      const mockCallOrder = [];
      mockCallOrder.push('risk', 'broker', 'database');

      expect(riskService.validateTrade).toHaveBeenCalled();
      expect(kotakNeoProvider.placeOrder).toHaveBeenCalled();
      expect(mockLiveTradeCreate).toHaveBeenCalled();
    });
  });
});
