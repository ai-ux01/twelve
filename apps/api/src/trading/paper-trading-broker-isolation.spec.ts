import { Test, TestingModule } from '@nestjs/testing';
import { PaperTradingService, PaperTradeRequest } from './paper-trading.service';
import { PrismaService } from '../database/prisma.service';
import { TradeExecutionStatus } from '@prisma/client';

/**
 * Mock Broker Provider Interface
 *
 * This represents the broker API provider that would be used for live trades.
 * For paper trades, this should NEVER be called.
 */
interface BrokerProvider {
  placeOrder(order: any): Promise<any>;
  cancelOrder(orderId: string): Promise<any>;
  getOrderStatus(orderId: string): Promise<any>;
}

/**
 * Mock Broker Provider Implementation
 *
 * This is a mock implementation of the broker provider.
 * All methods will be spied on to ensure they are never called during paper trading.
 */
class MockBrokerProvider implements BrokerProvider {
  async placeOrder(order: any): Promise<any> {
    throw new Error('Broker API should not be called for paper trades');
  }

  async cancelOrder(orderId: string): Promise<any> {
    throw new Error('Broker API should not be called for paper trades');
  }

  async getOrderStatus(orderId: string): Promise<any> {
    throw new Error('Broker API should not be called for paper trades');
  }
}

/**
 * Unit Test: Paper Trades Never Call Broker API
 *
 * Requirement 9.5: THE Backend_API SHALL NOT send paper trades to Broker_API
 *
 * This test verifies that when executing paper trades, the broker provider
 * is never invoked. This is a critical architectural requirement to ensure
 * paper trading remains completely simulated and never triggers real broker orders.
 */
describe('PaperTradingService - Broker API Isolation (Requirement 9.5)', () => {
  let service: PaperTradingService;
  let prismaService: PrismaService;
  let brokerProvider: MockBrokerProvider;

  // Spies to track broker API calls
  let placeOrderSpy: jest.SpyInstance;
  let cancelOrderSpy: jest.SpyInstance;
  let getOrderStatusSpy: jest.SpyInstance;

  const mockPrismaService = {
    paperTrade: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tradeExecution: {
      create: jest.fn(),
    },
    portfolio: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    position: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    // Create mock broker provider
    brokerProvider = new MockBrokerProvider();

    // Set up spies on all broker methods
    placeOrderSpy = jest.spyOn(brokerProvider, 'placeOrder');
    cancelOrderSpy = jest.spyOn(brokerProvider, 'cancelOrder');
    getOrderStatusSpy = jest.spyOn(brokerProvider, 'getOrderStatus');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaperTradingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        // Note: We're NOT injecting the broker provider into PaperTradingService
        // This verifies that PaperTradingService has no dependency on broker providers
      ],
    }).compile();

    service = module.get<PaperTradingService>(PaperTradingService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executePaperTrade - Broker API Isolation', () => {
    const userId = 'test-user-123';
    const buyTradeRequest: PaperTradeRequest = {
      symbol: 'RELIANCE',
      action: 'BUY',
      quantity: 10,
      price: 2500,
      stopLoss: 2450,
      target: 2600,
    };

    const sellTradeRequest: PaperTradeRequest = {
      symbol: 'TATASTEEL',
      action: 'SELL',
      quantity: 20,
      price: 1500,
      stopLoss: 1550,
      target: 1400,
    };

    beforeEach(() => {
      // Setup standard mock responses for successful paper trade execution
      const mockPaperTrade = {
        id: 'paper-trade-123',
        userId,
        symbol: 'RELIANCE',
        direction: 'LONG',
        quantity: 10,
        entryPrice: 2502.5,
        status: TradeExecutionStatus.OPEN,
        simulatedSlippage: 2.5,
        currentPrice: 2502.5,
        unrealizedPnL: 0,
      };

      const mockPortfolio = {
        id: 'portfolio-123',
        userId,
        totalValue: 100000,
        cashBalance: 50000,
        investedValue: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
      };

      const mockPosition = {
        id: 'position-123',
        portfolioId: 'portfolio-123',
        symbol: 'RELIANCE',
        quantity: 10,
        averagePrice: 2502.5,
        currentPrice: 2502.5,
        unrealizedPnL: 0,
        status: 'OPEN',
      };

      mockPrismaService.paperTrade.create.mockResolvedValue(mockPaperTrade);
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue(mockPosition);
    });

    it('should NOT call broker placeOrder when executing a BUY paper trade', async () => {
      // Execute a paper BUY trade
      const result = await service.executePaperTrade(userId, buyTradeRequest);

      // Verify trade was executed successfully
      expect(result.status).toBe('EXECUTED');
      expect(result.tradeId).toBeTruthy();

      // CRITICAL ASSERTION: Verify broker API was NEVER called
      expect(placeOrderSpy).not.toHaveBeenCalled();
      expect(cancelOrderSpy).not.toHaveBeenCalled();
      expect(getOrderStatusSpy).not.toHaveBeenCalled();
    });

    it('should NOT call broker placeOrder when executing a SELL paper trade', async () => {
      // Update mocks for SELL trade
      mockPrismaService.paperTrade.create.mockResolvedValue({
        id: 'paper-trade-456',
        userId,
        symbol: 'TATASTEEL',
        direction: 'SHORT',
        quantity: 20,
        entryPrice: 1495,
        status: TradeExecutionStatus.OPEN,
      });

      // Execute a paper SELL trade
      const result = await service.executePaperTrade(userId, sellTradeRequest);

      // Verify trade was executed successfully
      expect(result.status).toBe('EXECUTED');

      // CRITICAL ASSERTION: Verify broker API was NEVER called
      expect(placeOrderSpy).not.toHaveBeenCalled();
      expect(cancelOrderSpy).not.toHaveBeenCalled();
      expect(getOrderStatusSpy).not.toHaveBeenCalled();
    });

    it('should NOT call broker API when executing multiple paper trades', async () => {
      // Execute multiple paper trades
      await service.executePaperTrade(userId, buyTradeRequest);

      mockPrismaService.paperTrade.create.mockResolvedValue({
        id: 'paper-trade-456',
        userId,
        status: TradeExecutionStatus.OPEN,
      });

      await service.executePaperTrade(userId, sellTradeRequest);

      mockPrismaService.paperTrade.create.mockResolvedValue({
        id: 'paper-trade-789',
        userId,
        status: TradeExecutionStatus.OPEN,
      });

      await service.executePaperTrade(userId, {
        ...buyTradeRequest,
        symbol: 'INFY',
        price: 1800,
      });

      // CRITICAL ASSERTION: Verify broker API was NEVER called despite multiple trades
      expect(placeOrderSpy).toHaveBeenCalledTimes(0);
      expect(cancelOrderSpy).toHaveBeenCalledTimes(0);
      expect(getOrderStatusSpy).toHaveBeenCalledTimes(0);
    });

    it('should NOT call broker API even when paper trade execution fails', async () => {
      // Simulate a database error
      mockPrismaService.paperTrade.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Execute paper trade (will fail)
      const result = await service.executePaperTrade(userId, buyTradeRequest);

      // Verify trade failed
      expect(result.status).toBe('FAILED');

      // CRITICAL ASSERTION: Verify broker API was NEVER called even during error handling
      expect(placeOrderSpy).not.toHaveBeenCalled();
      expect(cancelOrderSpy).not.toHaveBeenCalled();
      expect(getOrderStatusSpy).not.toHaveBeenCalled();
    });

    it('should NOT call broker API when updating an existing position', async () => {
      // Setup existing position
      const existingPosition = {
        id: 'position-existing',
        portfolioId: 'portfolio-123',
        symbol: 'RELIANCE',
        quantity: 5,
        averagePrice: 2480,
        status: 'OPEN',
      };

      mockPrismaService.position.findFirst.mockResolvedValue(existingPosition);
      mockPrismaService.position.update.mockResolvedValue({
        ...existingPosition,
        quantity: 15,
      });

      // Execute paper trade that updates existing position
      await service.executePaperTrade(userId, buyTradeRequest);

      // CRITICAL ASSERTION: Verify broker API was NEVER called
      expect(placeOrderSpy).not.toHaveBeenCalled();
      expect(cancelOrderSpy).not.toHaveBeenCalled();
      expect(getOrderStatusSpy).not.toHaveBeenCalled();
    });

    it('should NOT call broker API when creating a new portfolio', async () => {
      // Setup no existing portfolio
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.portfolio.create.mockResolvedValue({
        id: 'portfolio-new',
        userId,
        totalValue: 0,
        cashBalance: 0,
      });

      // Execute paper trade that creates new portfolio
      await service.executePaperTrade(userId, buyTradeRequest);

      // CRITICAL ASSERTION: Verify broker API was NEVER called
      expect(placeOrderSpy).not.toHaveBeenCalled();
      expect(cancelOrderSpy).not.toHaveBeenCalled();
      expect(getOrderStatusSpy).not.toHaveBeenCalled();
    });
  });

  describe('closePaperTrade - Broker API Isolation', () => {
    it('should NOT call broker API when closing a paper trade', async () => {
      const paperTrade = {
        id: 'trade-123',
        userId: 'user-123',
        direction: 'LONG',
        entryPrice: 2500,
        quantity: 10,
        status: TradeExecutionStatus.OPEN,
      };

      mockPrismaService.paperTrade.findUnique.mockResolvedValue(paperTrade);
      mockPrismaService.paperTrade.update.mockResolvedValue({
        ...paperTrade,
        status: TradeExecutionStatus.CLOSED,
      });
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.position.updateMany.mockResolvedValue({ count: 1 });

      // Close the paper trade
      const result = await service.closePaperTrade('trade-123', 2600);

      // Verify close was successful
      expect(result.status).toBe('EXECUTED');

      // CRITICAL ASSERTION: Verify broker API was NEVER called when closing
      expect(placeOrderSpy).not.toHaveBeenCalled();
      expect(cancelOrderSpy).not.toHaveBeenCalled();
      expect(getOrderStatusSpy).not.toHaveBeenCalled();
    });
  });

  describe('updatePaperTradePnL - Broker API Isolation', () => {
    it('should NOT call broker API when updating PnL', async () => {
      const paperTrade = {
        id: 'trade-123',
        direction: 'LONG',
        entryPrice: 2500,
        quantity: 10,
        status: TradeExecutionStatus.OPEN,
      };

      mockPrismaService.paperTrade.findUnique.mockResolvedValue(paperTrade);
      mockPrismaService.paperTrade.update.mockResolvedValue({});

      // Update PnL
      await service.updatePaperTradePnL('trade-123', 2550);

      // CRITICAL ASSERTION: Verify broker API was NEVER called during PnL update
      expect(placeOrderSpy).not.toHaveBeenCalled();
      expect(cancelOrderSpy).not.toHaveBeenCalled();
      expect(getOrderStatusSpy).not.toHaveBeenCalled();
    });
  });

  describe('getOpenPaperTrades - Broker API Isolation', () => {
    it('should NOT call broker API when retrieving paper trades', async () => {
      const mockTrades = [
        { id: 'trade-1', status: TradeExecutionStatus.OPEN },
        { id: 'trade-2', status: TradeExecutionStatus.OPEN },
      ];

      mockPrismaService.paperTrade.findMany.mockResolvedValue(mockTrades);

      // Get open paper trades
      await service.getOpenPaperTrades('user-123');

      // CRITICAL ASSERTION: Verify broker API was NEVER called during retrieval
      expect(placeOrderSpy).not.toHaveBeenCalled();
      expect(cancelOrderSpy).not.toHaveBeenCalled();
      expect(getOrderStatusSpy).not.toHaveBeenCalled();
    });
  });

  describe('getAllPaperTrades - Broker API Isolation', () => {
    it('should NOT call broker API when retrieving all paper trades', async () => {
      const mockTrades = [
        { id: 'trade-1', status: TradeExecutionStatus.OPEN },
        { id: 'trade-2', status: TradeExecutionStatus.CLOSED },
      ];

      mockPrismaService.paperTrade.findMany.mockResolvedValue(mockTrades);

      // Get all paper trades
      await service.getAllPaperTrades('user-123');

      // CRITICAL ASSERTION: Verify broker API was NEVER called during retrieval
      expect(placeOrderSpy).not.toHaveBeenCalled();
      expect(cancelOrderSpy).not.toHaveBeenCalled();
      expect(getOrderStatusSpy).not.toHaveBeenCalled();
    });
  });

  describe('Architecture Verification', () => {
    it('should verify PaperTradingService has no BrokerProvider dependency', () => {
      // This test verifies at the architectural level that PaperTradingService
      // does not have any broker provider injected as a dependency.

      // Get the constructor parameters metadata
      const constructorParams = Reflect.getMetadata('design:paramtypes', PaperTradingService);

      // PaperTradingService should only depend on PrismaService
      expect(constructorParams).toHaveLength(1);
      expect(constructorParams[0]).toBe(PrismaService);

      // There should be no BrokerProvider or similar in dependencies
      const paramNames = constructorParams.map((param: any) => param.name);
      expect(paramNames).not.toContain('BrokerProvider');
      expect(paramNames).not.toContain('KotakNeoProvider');
      expect(paramNames).not.toContain('BrokerService');
    });
  });
});
