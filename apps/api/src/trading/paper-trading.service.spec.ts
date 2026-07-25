import { Test, TestingModule } from '@nestjs/testing';
import {
  PaperTradingService,
  PaperTradeRequest,
  PaperOptionTradeRequest,
} from './paper-trading.service';
import { PrismaService } from '../database/prisma.service';
import { SignalDirection, TradeExecutionStatus } from '@prisma/client';
import * as fc from 'fast-check';

describe('PaperTradingService', () => {
  let service: PaperTradingService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    paperTrade: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
    optionsPosition: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
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
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executePaperTrade', () => {
    const userId = 'user-123';
    const tradeRequest: PaperTradeRequest = {
      symbol: 'RELIANCE',
      action: 'BUY',
      quantity: 10,
      price: 2500,
      stopLoss: 2450,
      target: 2600,
    };

    it('should execute a paper trade successfully', async () => {
      const mockPaperTrade = {
        id: 'trade-123',
        userId,
        symbol: 'RELIANCE',
        direction: 'LONG' as SignalDirection,
        quantity: 10,
        entryPrice: 2502.5,
        stopLoss: 2450,
        target: 2600,
        simulatedSlippage: 2.5,
        status: TradeExecutionStatus.OPEN,
        currentPrice: 2502.5,
        unrealizedPnL: 0,
      };

      const mockPortfolio = {
        id: 'portfolio-123',
        userId,
        totalValue: 100000,
        cashBalance: 50000,
      };

      const mockPosition = {
        id: 'position-123',
        portfolioId: 'portfolio-123',
        symbol: 'RELIANCE',
        quantity: 10,
        averagePrice: 2502.5,
        currentPrice: 2502.5,
      };

      mockPrismaService.paperTrade.create.mockResolvedValue(mockPaperTrade);
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue(mockPosition);

      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('EXECUTED');
      expect(result.tradeId).toBe('trade-123');
      expect(result.executedPrice).toBeGreaterThan(tradeRequest.price);
      expect(result.slippage).toBeGreaterThanOrEqual(0);
      expect(result.slippage).toBeLessThanOrEqual(tradeRequest.price * 0.01);
      expect(result.positionId).toBe('position-123');

      expect(mockPrismaService.paperTrade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            symbol: 'RELIANCE',
            direction: 'LONG',
            quantity: 10,
            stopLoss: 2450,
            target: 2600,
          }),
        })
      );

      expect(mockPrismaService.tradeExecution.create).toHaveBeenCalled();
    });

    it('should apply slippage in the correct direction for BUY orders', async () => {
      const mockPaperTrade = {
        id: 'trade-123',
        userId,
        symbol: 'RELIANCE',
        direction: 'LONG' as SignalDirection,
        quantity: 10,
        entryPrice: 2505, // Should be higher than request price
        simulatedSlippage: 5,
        status: TradeExecutionStatus.OPEN,
      };

      mockPrismaService.paperTrade.create.mockResolvedValue(mockPaperTrade);
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-123',
        userId,
      });
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: 'position-123',
      });

      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('EXECUTED');
      expect(result.executedPrice).toBeGreaterThan(tradeRequest.price);
    });

    it('should apply slippage in the correct direction for SELL orders', async () => {
      const sellRequest: PaperTradeRequest = {
        symbol: 'RELIANCE',
        action: 'SELL',
        quantity: 10,
        price: 2500,
      };

      const mockPaperTrade = {
        id: 'trade-123',
        userId,
        symbol: 'RELIANCE',
        direction: 'SHORT' as SignalDirection,
        quantity: 10,
        entryPrice: 2495, // Should be lower than request price for SELL
        simulatedSlippage: 5,
        status: TradeExecutionStatus.OPEN,
      };

      mockPrismaService.paperTrade.create.mockResolvedValue(mockPaperTrade);
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-123',
        userId,
      });
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: 'position-123',
      });

      const result = await service.executePaperTrade(userId, sellRequest);

      expect(result.status).toBe('EXECUTED');
      expect(result.executedPrice).toBeLessThan(sellRequest.price);
    });

    it('should create a new portfolio if it does not exist', async () => {
      const mockPaperTrade = {
        id: 'trade-123',
        userId,
        status: TradeExecutionStatus.OPEN,
      };

      mockPrismaService.paperTrade.create.mockResolvedValue(mockPaperTrade);
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.portfolio.create.mockResolvedValue({
        id: 'portfolio-123',
        userId,
      });
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: 'position-123',
      });

      await service.executePaperTrade(userId, tradeRequest);

      expect(mockPrismaService.portfolio.create).toHaveBeenCalledWith({
        data: {
          userId,
          totalValue: 0,
          cashBalance: 0,
          investedValue: 0,
          unrealizedPnL: 0,
          realizedPnL: 0,
        },
      });
    });

    it('should update existing position if one exists for the symbol', async () => {
      const existingPosition = {
        id: 'position-123',
        portfolioId: 'portfolio-123',
        symbol: 'RELIANCE',
        quantity: 5,
        averagePrice: 2480,
        status: 'OPEN',
      };

      mockPrismaService.paperTrade.create.mockResolvedValue({
        id: 'trade-123',
        status: TradeExecutionStatus.OPEN,
      });
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-123',
        userId,
      });
      mockPrismaService.position.findFirst.mockResolvedValue(existingPosition);
      mockPrismaService.position.update.mockResolvedValue({
        ...existingPosition,
        quantity: 15,
        averagePrice: 2486.67,
      });

      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('EXECUTED');
      expect(mockPrismaService.position.update).toHaveBeenCalled();
      expect(mockPrismaService.position.create).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPrismaService.paperTrade.create.mockRejectedValue(new Error('Database error'));

      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Database error');
    });

    it('should set initial unrealized PnL to 0', async () => {
      mockPrismaService.paperTrade.create.mockResolvedValue({
        id: 'trade-123',
        unrealizedPnL: 0,
        status: TradeExecutionStatus.OPEN,
      });
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-123',
        userId,
      });
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: 'position-123',
      });

      await service.executePaperTrade(userId, tradeRequest);

      expect(mockPrismaService.paperTrade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unrealizedPnL: 0,
          }),
        })
      );
    });
  });

  describe('updatePaperTradePnL', () => {
    it('should update unrealized PnL for LONG position', async () => {
      const paperTrade = {
        id: 'trade-123',
        direction: 'LONG' as SignalDirection,
        entryPrice: 2500,
        quantity: 10,
        status: TradeExecutionStatus.OPEN,
      };

      mockPrismaService.paperTrade.findUnique.mockResolvedValue(paperTrade);
      mockPrismaService.paperTrade.update.mockResolvedValue({});

      await service.updatePaperTradePnL('trade-123', 2550);

      // LONG PnL = (currentPrice - entryPrice) * quantity
      // (2550 - 2500) * 10 = 500
      expect(mockPrismaService.paperTrade.update).toHaveBeenCalledWith({
        where: { id: 'trade-123' },
        data: {
          currentPrice: 2550,
          unrealizedPnL: 500,
        },
      });
    });

    it('should update unrealized PnL for SHORT position', async () => {
      const paperTrade = {
        id: 'trade-123',
        direction: 'SHORT' as SignalDirection,
        entryPrice: 2500,
        quantity: 10,
        status: TradeExecutionStatus.OPEN,
      };

      mockPrismaService.paperTrade.findUnique.mockResolvedValue(paperTrade);
      mockPrismaService.paperTrade.update.mockResolvedValue({});

      await service.updatePaperTradePnL('trade-123', 2450);

      // SHORT PnL = (entryPrice - currentPrice) * quantity
      // (2500 - 2450) * 10 = 500
      expect(mockPrismaService.paperTrade.update).toHaveBeenCalledWith({
        where: { id: 'trade-123' },
        data: {
          currentPrice: 2450,
          unrealizedPnL: 500,
        },
      });
    });

    it('should not update if trade is not found', async () => {
      mockPrismaService.paperTrade.findUnique.mockResolvedValue(null);

      await service.updatePaperTradePnL('trade-123', 2550);

      expect(mockPrismaService.paperTrade.update).not.toHaveBeenCalled();
    });

    it('should not update if trade is not open', async () => {
      mockPrismaService.paperTrade.findUnique.mockResolvedValue({
        id: 'trade-123',
        status: TradeExecutionStatus.CLOSED,
      });

      await service.updatePaperTradePnL('trade-123', 2550);

      expect(mockPrismaService.paperTrade.update).not.toHaveBeenCalled();
    });
  });

  describe('closePaperTrade', () => {
    it('should close a LONG paper trade with profit', async () => {
      const paperTrade = {
        id: 'trade-123',
        direction: 'LONG' as SignalDirection,
        entryPrice: 2500,
        quantity: 10,
        status: TradeExecutionStatus.OPEN,
      };

      mockPrismaService.paperTrade.findUnique.mockResolvedValue(paperTrade);
      mockPrismaService.paperTrade.update.mockResolvedValue({});
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.position.updateMany.mockResolvedValue({});

      const result = await service.closePaperTrade('trade-123', 2600);

      expect(result.status).toBe('EXECUTED');
      expect(result.executedPrice).toBeLessThan(2600); // Exit slippage for SELL
      expect(mockPrismaService.paperTrade.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'trade-123' },
          data: expect.objectContaining({
            status: TradeExecutionStatus.CLOSED,
            realizedPnL: expect.any(Number),
          }),
        })
      );
    });

    it('should close a SHORT paper trade with profit', async () => {
      const paperTrade = {
        id: 'trade-123',
        direction: 'SHORT' as SignalDirection,
        entryPrice: 2500,
        quantity: 10,
        status: TradeExecutionStatus.OPEN,
      };

      mockPrismaService.paperTrade.findUnique.mockResolvedValue(paperTrade);
      mockPrismaService.paperTrade.update.mockResolvedValue({});
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.position.updateMany.mockResolvedValue({});

      const result = await service.closePaperTrade('trade-123', 2400);

      expect(result.status).toBe('EXECUTED');
      expect(result.executedPrice).toBeGreaterThan(2400); // Exit slippage for BUY to cover
    });

    it('should fail if paper trade is not found', async () => {
      mockPrismaService.paperTrade.findUnique.mockResolvedValue(null);

      const result = await service.closePaperTrade('trade-123', 2600);

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Paper trade not found');
    });

    it('should fail if paper trade is not open', async () => {
      mockPrismaService.paperTrade.findUnique.mockResolvedValue({
        id: 'trade-123',
        status: TradeExecutionStatus.CLOSED,
      });

      const result = await service.closePaperTrade('trade-123', 2600);

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Paper trade is not open');
    });

    it('should create exit execution record', async () => {
      const paperTrade = {
        id: 'trade-123',
        direction: 'LONG' as SignalDirection,
        entryPrice: 2500,
        quantity: 10,
        status: TradeExecutionStatus.OPEN,
      };

      mockPrismaService.paperTrade.findUnique.mockResolvedValue(paperTrade);
      mockPrismaService.paperTrade.update.mockResolvedValue({});
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.position.updateMany.mockResolvedValue({});

      await service.closePaperTrade('trade-123', 2600);

      expect(mockPrismaService.tradeExecution.create).toHaveBeenCalledWith({
        data: {
          paperTradeId: 'trade-123',
          executionType: 'FULL_EXIT',
          quantity: 10,
          price: expect.any(Number),
          fees: 0,
        },
      });
    });
  });

  describe('getOpenPaperTrades', () => {
    it('should return all open paper trades for a user', async () => {
      const mockTrades = [
        { id: 'trade-1', status: TradeExecutionStatus.OPEN },
        { id: 'trade-2', status: TradeExecutionStatus.OPEN },
      ];

      mockPrismaService.paperTrade.findMany.mockResolvedValue(mockTrades);

      const result = await service.getOpenPaperTrades('user-123');

      expect(result).toEqual(mockTrades);
      expect(mockPrismaService.paperTrade.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          status: TradeExecutionStatus.OPEN,
        },
        include: {
          signal: true,
          executions: true,
        },
        orderBy: {
          enteredAt: 'desc',
        },
      });
    });
  });

  describe('getAllPaperTrades', () => {
    it('should return all paper trades for a user', async () => {
      const mockTrades = [
        { id: 'trade-1', status: TradeExecutionStatus.OPEN },
        { id: 'trade-2', status: TradeExecutionStatus.CLOSED },
      ];

      mockPrismaService.paperTrade.findMany.mockResolvedValue(mockTrades);

      const result = await service.getAllPaperTrades('user-123');

      expect(result).toEqual(mockTrades);
      expect(mockPrismaService.paperTrade.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
        },
        include: {
          signal: true,
          executions: true,
        },
        orderBy: {
          enteredAt: 'desc',
        },
      });
    });
  });

  /**
   * Property-Based Test: Paper Trade Persistence Round-Trip
   *
   * **Validates: Requirements 9.1**
   *
   * Property 12: Paper Trade Persistence Round-Trip
   *
   * For any valid paper trade request, storing the trade in the database
   * and retrieving it SHALL produce a trade object with identical:
   * - symbol
   * - action (mapped to direction)
   * - quantity
   * - price (within slippage tolerance)
   * - isPaper flag (always true for paper trades)
   */
  describe('Property Test: Paper Trade Persistence Round-Trip', () => {
    it('should preserve trade data through store-retrieve round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generators for valid trade request data
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[A-Z0-9]+$/.test(s)), // symbol (stock symbols)
          fc.constantFrom('BUY', 'SELL'), // action
          fc.integer({ min: 1, max: 10000 }), // quantity
          fc.double({ min: 1, max: 100000, noNaN: true }), // price
          fc.option(fc.double({ min: 1, max: 100000, noNaN: true }), { nil: undefined }), // stopLoss
          fc.option(fc.double({ min: 1, max: 100000, noNaN: true }), { nil: undefined }), // target
          fc.uuid(), // userId
          async (symbol, action, quantity, price, stopLoss, target, userId) => {
            // Arrange: Create trade request
            const tradeRequest: PaperTradeRequest = {
              symbol,
              action,
              quantity,
              price,
              stopLoss,
              target,
            };

            const direction: SignalDirection = action === 'BUY' ? 'LONG' : 'SHORT';

            // Simulate slippage (0-1% as per implementation)
            const slippagePercent = Math.random() * 0.01;
            const slippage = price * slippagePercent;
            const executedPrice = action === 'BUY' ? price + slippage : price - slippage;

            // Mock database response with data that should be persisted
            const mockPaperTradeStored = {
              id: fc.sample(fc.uuid(), 1)[0],
              userId,
              signalId: null,
              symbol,
              direction,
              quantity,
              entryPrice: executedPrice,
              stopLoss: stopLoss || 0,
              target: target || 0,
              simulatedSlippage: slippage,
              status: TradeExecutionStatus.OPEN,
              currentPrice: executedPrice,
              unrealizedPnL: 0,
              enteredAt: new Date(),
              exitedAt: null,
              realizedPnL: null,
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
              symbol,
              quantity,
              averagePrice: executedPrice,
              currentPrice: executedPrice,
              unrealizedPnL: 0,
              realizedPnL: 0,
              status: 'OPEN',
            };

            // Setup mocks
            mockPrismaService.paperTrade.create.mockResolvedValue(mockPaperTradeStored);
            mockPrismaService.tradeExecution.create.mockResolvedValue({});
            mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
            mockPrismaService.position.findFirst.mockResolvedValue(null);
            mockPrismaService.position.create.mockResolvedValue(mockPosition);

            // Act: Execute paper trade (store)
            const result = await service.executePaperTrade(userId, tradeRequest);

            // Assert: Verify round-trip correctness
            // 1. Trade should be successfully executed
            expect(result.status).toBe('EXECUTED');

            // 2. Symbol should be preserved exactly
            expect(mockPrismaService.paperTrade.create).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({
                  symbol,
                }),
              })
            );

            // 3. Direction should match action mapping (BUY -> LONG, SELL -> SHORT)
            expect(mockPrismaService.paperTrade.create).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({
                  direction,
                }),
              })
            );

            // 4. Quantity should be preserved exactly
            expect(mockPrismaService.paperTrade.create).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({
                  quantity,
                }),
              })
            );

            // 5. Price should be within slippage tolerance (0-1%)
            const storedPrice = (mockPrismaService.paperTrade.create as jest.Mock).mock.calls[0][0]
              .data.entryPrice;
            const priceDeviation = Math.abs(storedPrice - price) / price;
            expect(priceDeviation).toBeLessThanOrEqual(0.01);

            // 6. For BUY orders, executed price should be >= requested price (slippage hurts buyer)
            if (action === 'BUY') {
              expect(storedPrice).toBeGreaterThanOrEqual(price);
            }

            // 7. For SELL orders, executed price should be <= requested price (slippage hurts seller)
            if (action === 'SELL') {
              expect(storedPrice).toBeLessThanOrEqual(price);
            }

            // 8. Slippage should be within bounds (0-1% of price)
            const actualSlippage = result.slippage || 0;
            expect(actualSlippage).toBeGreaterThanOrEqual(0);
            expect(actualSlippage).toBeLessThanOrEqual(price * 0.01);

            // 9. Trade should be created with isPaper=true semantics (no broker API call)
            // This is implicit: paperTrade table is used, not liveTrade
            expect(mockPrismaService.paperTrade.create).toHaveBeenCalled();

            // 10. Stop loss and target should be preserved (or default to 0)
            expect(mockPrismaService.paperTrade.create).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({
                  stopLoss: stopLoss || 0,
                  target: target || 0,
                }),
              })
            );

            // Clean up for next iteration
            jest.clearAllMocks();
          }
        ),
        { numRuns: 50 } // Run 50 random test cases
      );
    });
  });

  /**
   * Task 73.1: Tests for executePaperOptionTrade
   * Requirements: 9.1, 7.1
   */
  describe('executePaperOptionTrade', () => {
    const userId = 'user-123';
    const mockRiskService = {
      validateTrade: jest.fn(),
    };

    beforeEach(() => {
      // Inject mock RiskService
      (service as any).riskService = mockRiskService;
    });

    it('should execute paper options trade successfully with risk validation', async () => {
      const optionsTradeRequest: PaperOptionTradeRequest = {
        symbol: 'NIFTY',
        action: 'BUY',
        quantity: 50,
        price: 150,
        stopLoss: 120,
        target: 200,
        strikePrice: 21500,
        optionType: 'CALL',
        expiry: new Date('2024-12-26'),
        bidAskSpread: 5,
        openInterest: 1000,
        impliedVolatility: 0.15,
        delta: 0.52,
      };

      // Mock successful risk validation
      mockRiskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      const mockPaperTrade = {
        id: 'trade-123',
        userId,
        symbol: 'NIFTY20241226T21500CE',
        direction: 'LONG' as SignalDirection,
        quantity: 50,
        entryPrice: 152.5,
        stopLoss: 120,
        target: 200,
        simulatedSlippage: 2.5,
        status: TradeExecutionStatus.OPEN,
        currentPrice: 152.5,
        unrealizedPnL: 0,
      };

      const mockPortfolio = {
        id: 'portfolio-123',
        userId,
        totalValue: 500000,
        cashBalance: 250000,
      };

      const mockPosition = {
        id: 'position-123',
        portfolioId: 'portfolio-123',
        symbol: 'NIFTY20241226T21500CE',
        quantity: 50,
        averagePrice: 152.5,
        currentPrice: 152.5,
      };

      mockPrismaService.paperTrade.create.mockResolvedValue(mockPaperTrade);
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue(mockPosition);
      mockPrismaService.optionsPosition.create.mockResolvedValue({
        id: 'options-position-123',
        positionId: 'position-123',
        symbol: 'NIFTY',
        strikePrice: 21500,
        optionType: 'CALL',
        expiry: new Date('2024-12-26'),
        entryPrice: 152.5,
        quantity: 50,
        greeks: { delta: 0.52 },
        isPaper: true,
      });

      const result = await service.executePaperOptionTrade(userId, optionsTradeRequest);

      expect(result.status).toBe('EXECUTED');
      expect(result.tradeId).toBe('trade-123');
      expect(result.executedPrice).toBeGreaterThan(optionsTradeRequest.price);
      expect(result.positionId).toBe('position-123');

      // Verify risk validation was called with correct parameters
      expect(mockRiskService.validateTrade).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          symbol: 'NIFTY',
          action: 'BUY',
          quantity: 50,
          price: 150,
          assetType: 'OPTION_CALL',
          bidAskSpread: 5,
          openInterest: 1000,
          impliedVolatility: 0.15,
          delta: 0.52,
        })
      );

      // Verify OptionsPosition was created with isPaper=true
      expect(mockPrismaService.optionsPosition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          symbol: 'NIFTY',
          strikePrice: 21500,
          optionType: 'CALL',
          isPaper: true,
          greeks: { delta: 0.52 },
        }),
      });
    });

    it('should fail when risk validation returns errors', async () => {
      const optionsTradeRequest: PaperOptionTradeRequest = {
        symbol: 'NIFTY',
        action: 'BUY',
        quantity: 100,
        price: 150,
        strikePrice: 21500,
        optionType: 'CALL',
        expiry: new Date('2024-12-26'),
      };

      // Mock failed risk validation
      mockRiskService.validateTrade.mockResolvedValue({
        passed: false,
        violations: [
          {
            rule: 'MAX_OPTIONS_EXPOSURE',
            message: 'Total options exposure exceeds limit',
            severity: 'ERROR',
          },
        ],
      });

      const result = await service.executePaperOptionTrade(userId, optionsTradeRequest);

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Risk validation failed');
      expect(mockPrismaService.paperTrade.create).not.toHaveBeenCalled();
    });

    it('should use bid-ask spread for slippage calculation when provided', async () => {
      const optionsTradeRequest: PaperOptionTradeRequest = {
        symbol: 'BANKNIFTY',
        action: 'BUY',
        quantity: 25,
        price: 200,
        strikePrice: 45000,
        optionType: 'PUT',
        expiry: new Date('2024-12-26'),
        bidAskSpread: 10, // 10 rupee spread
      };

      mockRiskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      mockPrismaService.paperTrade.create.mockResolvedValue({
        id: 'trade-456',
        status: TradeExecutionStatus.OPEN,
      });
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-123',
        userId,
      });
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: 'position-456',
      });
      mockPrismaService.optionsPosition.create.mockResolvedValue({
        id: 'options-position-456',
      });

      const result = await service.executePaperOptionTrade(userId, optionsTradeRequest);

      expect(result.status).toBe('EXECUTED');
      // Slippage should be approximately half the spread (5 rupees)
      expect(result.slippage).toBeCloseTo(5, 0);
    });

    it('should proceed with warnings but not errors from risk validation', async () => {
      const optionsTradeRequest: PaperOptionTradeRequest = {
        symbol: 'NIFTY',
        action: 'BUY',
        quantity: 50,
        price: 100,
        strikePrice: 21000,
        optionType: 'CALL',
        expiry: new Date('2024-12-26'),
        openInterest: 300, // Low open interest - warning
      };

      mockRiskService.validateTrade.mockResolvedValue({
        passed: true, // Passed overall (no errors)
        violations: [
          {
            rule: 'OPTIONS_MODERATE_OPEN_INTEREST',
            message: 'Open interest is moderate',
            severity: 'WARNING',
          },
        ],
      });

      mockPrismaService.paperTrade.create.mockResolvedValue({
        id: 'trade-789',
        status: TradeExecutionStatus.OPEN,
      });
      mockPrismaService.tradeExecution.create.mockResolvedValue({});
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-123',
        userId,
      });
      mockPrismaService.position.findFirst.mockResolvedValue(null);
      mockPrismaService.position.create.mockResolvedValue({
        id: 'position-789',
      });
      mockPrismaService.optionsPosition.create.mockResolvedValue({
        id: 'options-position-789',
      });

      const result = await service.executePaperOptionTrade(userId, optionsTradeRequest);

      expect(result.status).toBe('EXECUTED');
      expect(result.tradeId).toBe('trade-789');
      expect(mockPrismaService.paperTrade.create).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const optionsTradeRequest: PaperOptionTradeRequest = {
        symbol: 'NIFTY',
        action: 'BUY',
        quantity: 50,
        price: 150,
        strikePrice: 21500,
        optionType: 'CALL',
        expiry: new Date('2024-12-26'),
      };

      mockRiskService.validateTrade.mockRejectedValue(new Error('Risk service error'));

      const result = await service.executePaperOptionTrade(userId, optionsTradeRequest);

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Risk service error');
    });
  });
});
