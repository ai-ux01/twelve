import { Test, TestingModule } from '@nestjs/testing';
import { PaperTradingService, PaperTradeRequest } from './paper-trading.service';
import { PrismaService } from '../database/prisma.service';
import * as fc from 'fast-check';
import { it } from '@fast-check/jest';
import { SignalDirection, TradeExecutionStatus } from '@prisma/client';

/**
 * Property-Based Tests for PaperTradingService - Slippage Bounds Validation
 *
 * **Validates: Requirements 9.2**
 *
 * Property 13: Paper Trade Slippage Bounds
 *
 * For any paper trade execution, the simulated slippage SHALL be non-negative
 * and SHALL not exceed 1% of the requested price.
 *
 * This test verifies that the paper trading simulation applies realistic slippage
 * that is always within the bounds specified in the requirements.
 */
describe('PaperTradingService - Property 13: Paper Trade Slippage Bounds', () => {
  let service: PaperTradingService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      paperTrade: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaperTradingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PaperTradingService>(PaperTradingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const userId = 'test-user-id';
  const mockPortfolio = {
    id: 'portfolio-123',
    userId,
    totalValue: 100000,
    cashBalance: 50000,
    investedValue: 50000,
    unrealizedPnL: 0,
    realizedPnL: 0,
  };

  /**
   * Arbitrary generators for property-based testing
   */
  const symbolArb = fc.string({ minLength: 3, maxLength: 10 });
  const quantityArb = fc.integer({ min: 1, max: 10000 });
  const priceArb = fc.double({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true });
  const actionArb = fc.constantFrom('BUY' as const, 'SELL' as const);

  /**
   * Helper function to set up mocks for a successful paper trade
   */
  const setupSuccessfulTradeMocks = (
    entryPrice: number,
    slippage: number,
    direction: SignalDirection
  ) => {
    const mockPaperTrade = {
      id: `trade-${Math.random().toString(36).substring(7)}`,
      userId,
      symbol: 'TEST',
      direction,
      quantity: 10,
      entryPrice,
      simulatedSlippage: slippage,
      status: TradeExecutionStatus.OPEN,
      currentPrice: entryPrice,
      unrealizedPnL: 0,
      stopLoss: 0,
      target: 0,
    };

    mockPrismaService.paperTrade.create.mockResolvedValue(mockPaperTrade);
    mockPrismaService.tradeExecution.create.mockResolvedValue({});
    mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
    mockPrismaService.position.findFirst.mockResolvedValue(null);
    mockPrismaService.position.create.mockResolvedValue({
      id: 'position-123',
      portfolioId: mockPortfolio.id,
      symbol: 'TEST',
      quantity: 10,
      averagePrice: entryPrice,
      currentPrice: entryPrice,
    });
  };

  /**
   * Property Test: Entry Trade Slippage is Non-Negative
   *
   * For any paper trade execution (BUY or SELL), the slippage SHALL be non-negative (>= 0).
   */
  it.prop([symbolArb, actionArb, quantityArb, priceArb])(
    'should always produce non-negative slippage for entry trades',
    async (symbol, action, quantity, price) => {
      // Skip if price is too small (causes numerical issues)
      if (price < 0.01) {
        return;
      }

      const direction: SignalDirection = action === 'BUY' ? 'LONG' : 'SHORT';

      // We'll intercept the create call to capture the actual slippage
      let capturedSlippage: number | undefined;
      mockPrismaService.paperTrade.create.mockImplementation((args: any) => {
        capturedSlippage = args.data.simulatedSlippage;
        const entryPrice = args.data.entryPrice;
        return Promise.resolve({
          id: `trade-${Math.random().toString(36).substring(7)}`,
          userId,
          symbol,
          direction,
          quantity,
          entryPrice,
          simulatedSlippage: capturedSlippage,
          status: TradeExecutionStatus.OPEN,
          currentPrice: entryPrice,
          unrealizedPnL: 0,
          stopLoss: 0,
          target: 0,
        });
      });

      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: 'position-123',
      });

      const tradeRequest: PaperTradeRequest = {
        symbol,
        action,
        quantity,
        price,
      };

      const result = await service.executePaperTrade(userId, tradeRequest);

      // The trade should execute successfully
      expect(result.status).toBe('EXECUTED');
      expect(result.slippage).toBeDefined();

      // Property: Slippage is non-negative
      expect(result.slippage).toBeGreaterThanOrEqual(0);
      expect(capturedSlippage).toBeGreaterThanOrEqual(0);
    }
  );

  /**
   * Property Test: Entry Trade Slippage Does Not Exceed 1% of Price
   *
   * For any paper trade execution, the slippage SHALL not exceed 1% of the requested price.
   * This is 0.01 * price.
   */
  it.prop([symbolArb, actionArb, quantityArb, priceArb])(
    'should never exceed 1% slippage for entry trades',
    async (symbol, action, quantity, price) => {
      // Skip if price is too small (causes numerical issues)
      if (price < 0.01) {
        return;
      }

      const direction: SignalDirection = action === 'BUY' ? 'LONG' : 'SHORT';

      // We'll intercept the create call to capture the actual slippage
      let capturedSlippage: number | undefined;
      mockPrismaService.paperTrade.create.mockImplementation((args: any) => {
        capturedSlippage = args.data.simulatedSlippage;
        const entryPrice = args.data.entryPrice;
        return Promise.resolve({
          id: `trade-${Math.random().toString(36).substring(7)}`,
          userId,
          symbol,
          direction,
          quantity,
          entryPrice,
          simulatedSlippage: capturedSlippage,
          status: TradeExecutionStatus.OPEN,
          currentPrice: entryPrice,
          unrealizedPnL: 0,
          stopLoss: 0,
          target: 0,
        });
      });

      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: 'position-123',
      });

      const tradeRequest: PaperTradeRequest = {
        symbol,
        action,
        quantity,
        price,
      };

      const result = await service.executePaperTrade(userId, tradeRequest);

      // The trade should execute successfully
      expect(result.status).toBe('EXECUTED');
      expect(result.slippage).toBeDefined();

      // Property: Slippage does not exceed 1% of price
      const maxAllowedSlippage = price * 0.01;
      expect(result.slippage).toBeLessThanOrEqual(maxAllowedSlippage);
      expect(capturedSlippage).toBeLessThanOrEqual(maxAllowedSlippage);
    }
  );

  /**
   * Property Test: Slippage Bounds Combined (0 <= slippage <= 1% of price)
   *
   * This is the complete Property 13 test: for ANY paper trade execution,
   * slippage SHALL be in the range [0, price * 0.01].
   */
  it.prop([symbolArb, actionArb, quantityArb, priceArb])(
    'should always have slippage in range [0, 1% of price]',
    async (symbol, action, quantity, price) => {
      // Skip if price is too small (causes numerical issues)
      if (price < 0.01) {
        return;
      }

      const direction: SignalDirection = action === 'BUY' ? 'LONG' : 'SHORT';

      // We'll intercept the create call to capture the actual slippage
      let capturedSlippage: number | undefined;
      mockPrismaService.paperTrade.create.mockImplementation((args: any) => {
        capturedSlippage = args.data.simulatedSlippage;
        const entryPrice = args.data.entryPrice;
        return Promise.resolve({
          id: `trade-${Math.random().toString(36).substring(7)}`,
          userId,
          symbol,
          direction,
          quantity,
          entryPrice,
          simulatedSlippage: capturedSlippage,
          status: TradeExecutionStatus.OPEN,
          currentPrice: entryPrice,
          unrealizedPnL: 0,
          stopLoss: 0,
          target: 0,
        });
      });

      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: 'position-123',
      });

      const tradeRequest: PaperTradeRequest = {
        symbol,
        action,
        quantity,
        price,
      };

      const result = await service.executePaperTrade(userId, tradeRequest);

      // The trade should execute successfully
      expect(result.status).toBe('EXECUTED');
      expect(result.slippage).toBeDefined();

      // Property 13: 0 <= slippage <= price * 0.01
      const maxAllowedSlippage = price * 0.01;
      expect(result.slippage).toBeGreaterThanOrEqual(0);
      expect(result.slippage).toBeLessThanOrEqual(maxAllowedSlippage);
      expect(capturedSlippage).toBeGreaterThanOrEqual(0);
      expect(capturedSlippage).toBeLessThanOrEqual(maxAllowedSlippage);
    }
  );

  /**
   * Property Test: Exit Trade Slippage Bounds
   *
   * For paper trade exits (closePaperTrade), slippage should also be bounded.
   * This tests that exit slippage is also within [0, 1% of price].
   */
  it.prop([priceArb, fc.double({ min: 0.1, max: 2, noNaN: true })])(
    'should have bounded slippage for exit trades',
    async (entryPrice: number, exitPriceMultiplier: number) => {
      // Skip if prices are too small
      if (entryPrice < 0.01) {
        return;
      }

      const exitPrice = entryPrice * exitPriceMultiplier;
      if (exitPrice < 0.01) {
        return;
      }

      const mockPaperTrade = {
        id: 'trade-123',
        userId,
        symbol: 'TEST',
        direction: 'LONG' as SignalDirection,
        entryPrice,
        quantity: 10,
        status: TradeExecutionStatus.OPEN,
        currentPrice: entryPrice,
        unrealizedPnL: 0,
      };

      mockPrismaService.paperTrade.findUnique.mockResolvedValue(mockPaperTrade);
      mockPrismaService.paperTrade.update.mockResolvedValue({});
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.position.updateMany.mockResolvedValue({});

      const result = await service.closePaperTrade('trade-123', exitPrice);

      // The trade should execute successfully
      expect(result.status).toBe('EXECUTED');
      expect(result.slippage).toBeDefined();

      // Property: Exit slippage is also bounded [0, 1% of exit price]
      const maxAllowedSlippage = exitPrice * 0.01;
      expect(result.slippage).toBeGreaterThanOrEqual(0);
      expect(result.slippage).toBeLessThanOrEqual(maxAllowedSlippage);
    }
  );

  /**
   * Property Test: BUY Order Executed Price is Higher Than Requested (Due to Slippage)
   *
   * For BUY orders, slippage works against the trader, meaning the executed price
   * should be higher than the requested price by the slippage amount.
   */
  it.prop([symbolArb, quantityArb, priceArb])(
    'should execute BUY orders at price higher than requested',
    async (symbol, quantity, price) => {
      // Skip if price is too small
      if (price < 0.01) {
        return;
      }

      let capturedSlippage: number | undefined;
      let capturedEntryPrice: number | undefined;

      mockPrismaService.paperTrade.create.mockImplementation((args: any) => {
        capturedSlippage = args.data.simulatedSlippage;
        capturedEntryPrice = args.data.entryPrice;
        return Promise.resolve({
          id: `trade-${Math.random().toString(36).substring(7)}`,
          userId,
          symbol,
          direction: 'LONG',
          quantity,
          entryPrice: capturedEntryPrice,
          simulatedSlippage: capturedSlippage,
          status: TradeExecutionStatus.OPEN,
          currentPrice: capturedEntryPrice,
          unrealizedPnL: 0,
          stopLoss: 0,
          target: 0,
        });
      });

      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: 'position-123',
      });

      const tradeRequest: PaperTradeRequest = {
        symbol,
        action: 'BUY',
        quantity,
        price,
      };

      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('EXECUTED');
      expect(result.executedPrice).toBeDefined();
      expect(result.slippage).toBeDefined();

      // For BUY orders: executedPrice = requestedPrice + slippage
      expect(result.executedPrice).toBeGreaterThanOrEqual(price);
      expect(capturedEntryPrice).toBeGreaterThanOrEqual(price);

      // Verify the relationship: executedPrice = price + slippage
      if (capturedSlippage !== undefined && capturedEntryPrice !== undefined) {
        expect(Math.abs(capturedEntryPrice - (price + capturedSlippage))).toBeLessThan(0.000001);
      }
    }
  );

  /**
   * Property Test: SELL Order Executed Price is Lower Than Requested (Due to Slippage)
   *
   * For SELL orders, slippage works against the trader, meaning the executed price
   * should be lower than the requested price by the slippage amount.
   */
  it.prop([symbolArb, quantityArb, priceArb])(
    'should execute SELL orders at price lower than requested',
    async (symbol, quantity, price) => {
      // Skip if price is too small
      if (price < 0.01) {
        return;
      }

      let capturedSlippage: number | undefined;
      let capturedEntryPrice: number | undefined;

      mockPrismaService.paperTrade.create.mockImplementation((args: any) => {
        capturedSlippage = args.data.simulatedSlippage;
        capturedEntryPrice = args.data.entryPrice;
        return Promise.resolve({
          id: `trade-${Math.random().toString(36).substring(7)}`,
          userId,
          symbol,
          direction: 'SHORT',
          quantity,
          entryPrice: capturedEntryPrice,
          simulatedSlippage: capturedSlippage,
          status: TradeExecutionStatus.OPEN,
          currentPrice: capturedEntryPrice,
          unrealizedPnL: 0,
          stopLoss: 0,
          target: 0,
        });
      });

      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: 'position-123',
      });

      const tradeRequest: PaperTradeRequest = {
        symbol,
        action: 'SELL',
        quantity,
        price,
      };

      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('EXECUTED');
      expect(result.executedPrice).toBeDefined();
      expect(result.slippage).toBeDefined();

      // For SELL orders: executedPrice = requestedPrice - slippage
      expect(result.executedPrice).toBeLessThanOrEqual(price);
      expect(capturedEntryPrice).toBeLessThanOrEqual(price);

      // Verify the relationship: executedPrice = price - slippage
      if (capturedSlippage !== undefined && capturedEntryPrice !== undefined) {
        expect(Math.abs(capturedEntryPrice - (price - capturedSlippage))).toBeLessThan(0.000001);
      }
    }
  );

  /**
   * Property Test: Slippage Distribution is Uniform
   *
   * Over many runs, slippage should be uniformly distributed between 0 and 1% of price.
   * This is a statistical test to ensure the random slippage generation is correct.
   */
  it('should produce uniformly distributed slippage values (statistical test)', async () => {
    const price = 1000;
    const numSamples = 100;
    const slippages: number[] = [];

    for (let i = 0; i < numSamples; i++) {
      let capturedSlippage: number | undefined;

      mockPrismaService.paperTrade.create.mockImplementation((args: any) => {
        capturedSlippage = args.data.simulatedSlippage;
        return Promise.resolve({
          id: `trade-${i}`,
          userId,
          symbol: 'TEST',
          direction: 'LONG',
          quantity: 10,
          entryPrice: price + (capturedSlippage || 0),
          simulatedSlippage: capturedSlippage,
          status: TradeExecutionStatus.OPEN,
          currentPrice: price + (capturedSlippage || 0),
          unrealizedPnL: 0,
          stopLoss: 0,
          target: 0,
        });
      });

      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: `position-${i}`,
      });

      const tradeRequest: PaperTradeRequest = {
        symbol: 'TEST',
        action: 'BUY',
        quantity: 10,
        price,
      };

      await service.executePaperTrade(userId, tradeRequest);

      if (capturedSlippage !== undefined) {
        slippages.push(capturedSlippage);
      }
    }

    // All slippages should be in valid range
    slippages.forEach((slippage) => {
      expect(slippage).toBeGreaterThanOrEqual(0);
      expect(slippage).toBeLessThanOrEqual(price * 0.01);
    });

    // Statistical test: mean should be around 0.5% of price (middle of range)
    const mean = slippages.reduce((sum, val) => sum + val, 0) / slippages.length;
    const expectedMean = price * 0.005; // 0.5%

    // Allow 30% deviation from expected mean (statistical variance is expected)
    expect(mean).toBeGreaterThan(expectedMean * 0.7);
    expect(mean).toBeLessThan(expectedMean * 1.3);
  });
});
