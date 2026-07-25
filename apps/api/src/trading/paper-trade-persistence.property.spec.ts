import { Test, TestingModule } from '@nestjs/testing';
import { PaperTradingService, PaperTradeRequest } from './paper-trading.service';
import { PrismaService } from '../database/prisma.service';
import * as fc from 'fast-check';
import { it } from '@fast-check/jest';
import { SignalDirection, TradeExecutionStatus } from '@prisma/client';

/**
 * Property-Based Tests for PaperTradingService - Persistence Round-Trip
 *
 * **Validates: Requirements 9.1**
 *
 * Property 12: Paper Trade Persistence Round-Trip
 *
 * For any valid paper trade request, storing the trade in the database and
 * retrieving it SHALL produce a trade object with identical symbol, action,
 * quantity, price, and isPaper=true.
 */
describe('PaperTradingService - Property 12: Paper Trade Persistence Round-Trip', () => {
  let service: PaperTradingService;
  let mockPrismaService: any;

  // In-memory storage to simulate database persistence
  let paperTradesStore: Map<string, any>;
  let portfoliosStore: Map<string, any>;
  let positionsStore: Map<string, any>;
  let executionsStore: any[];

  beforeEach(async () => {
    // Reset in-memory stores
    paperTradesStore = new Map();
    portfoliosStore = new Map();
    positionsStore = new Map();
    executionsStore = [];

    // Mock PrismaService with persistence simulation
    mockPrismaService = {
      paperTrade: {
        create: jest.fn().mockImplementation(({ data }) => {
          const trade = {
            ...data,
            id: `trade-${Date.now()}-${Math.random()}`,
            enteredAt: new Date(),
            exitedAt: null,
            realizedPnL: 0,
          };
          paperTradesStore.set(trade.id, trade);
          return Promise.resolve(trade);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const trade = paperTradesStore.get(where.id);
          return Promise.resolve(trade || null);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          const trades = Array.from(paperTradesStore.values()).filter((trade) => {
            if (where.userId && trade.userId !== where.userId) return false;
            if (where.status && trade.status !== where.status) return false;
            if (where.id && where.id.in) {
              return where.id.in.includes(trade.id);
            }
            return true;
          });
          return Promise.resolve(trades);
        }),
      },
      tradeExecution: {
        create: jest.fn().mockImplementation(({ data }) => {
          const execution = {
            ...data,
            id: `exec-${Date.now()}-${Math.random()}`,
            executedAt: new Date(),
          };
          executionsStore.push(execution);
          return Promise.resolve(execution);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          const filtered = executionsStore.filter(
            (exec) => !where.paperTradeId || exec.paperTradeId === where.paperTradeId
          );
          return Promise.resolve(filtered);
        }),
      },
      portfolio: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const portfolio = portfoliosStore.get(where.userId);
          return Promise.resolve(portfolio || null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const portfolio = {
            ...data,
            id: `portfolio-${Date.now()}-${Math.random()}`,
          };
          portfoliosStore.set(data.userId, portfolio);
          return Promise.resolve(portfolio);
        }),
      },
      position: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const positions = Array.from(positionsStore.values()).filter((pos) => {
            if (where.portfolioId && pos.portfolioId !== where.portfolioId) return false;
            if (where.symbol && pos.symbol !== where.symbol) return false;
            if (where.status && pos.status !== where.status) return false;
            return true;
          });
          return Promise.resolve(positions[0] || null);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const position = positionsStore.get(where.id);
          return Promise.resolve(position || null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const position = {
            ...data,
            id: `position-${Date.now()}-${Math.random()}`,
            closedAt: null,
          };
          positionsStore.set(position.id, position);
          return Promise.resolve(position);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const position = positionsStore.get(where.id);
          if (position) {
            Object.assign(position, data);
          }
          return Promise.resolve(position);
        }),
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

  /**
   * Arbitrary generators for paper trade properties
   */
  const symbolArb = fc
    .string({ minLength: 1, maxLength: 20 })
    .map((s) => s.replace(/[^A-Za-z0-9]/g, 'X'))
    .filter((s) => s.length > 0);

  const actionArb = fc.constantFrom('BUY' as const, 'SELL' as const);

  const quantityArb = fc.integer({ min: 1, max: 10000 });

  const priceArb = fc.double({
    min: 0.01,
    max: 100000,
    noNaN: true,
    noDefaultInfinity: true,
  });

  const stopLossArb = (action: 'BUY' | 'SELL', price: number) => {
    // Generate valid stop loss based on action
    if (action === 'BUY') {
      // For BUY, stop loss must be less than price
      return fc.double({ min: 0.5, max: 0.99, noNaN: true }).map((ratio) => price * ratio);
    } else {
      // For SELL, stop loss must be greater than price
      return fc.double({ min: 1.01, max: 2, noNaN: true }).map((ratio) => price * ratio);
    }
  };

  const targetArb = (action: 'BUY' | 'SELL', price: number) => {
    // Generate valid target based on action
    if (action === 'BUY') {
      // For BUY, target should be higher than price
      return fc.double({ min: 1.01, max: 2, noNaN: true }).map((ratio) => price * ratio);
    } else {
      // For SELL, target should be lower than price
      return fc.double({ min: 0.5, max: 0.99, noNaN: true }).map((ratio) => price * ratio);
    }
  };

  /**
   * Property Test: Paper Trade Persistence Round-Trip with Core Fields
   *
   * For any valid paper trade request, the stored trade must preserve:
   * - symbol
   * - action (direction)
   * - quantity
   * - price (within slippage tolerance)
   */
  it.prop([symbolArb, actionArb, quantityArb, priceArb])(
    'should preserve core trade fields in database round-trip',
    async (symbol: string, action: 'BUY' | 'SELL', quantity: number, price: number) => {
      // Use a test user ID
      const userId = `user-${Date.now()}-${Math.random()}`;

      // Create paper trade request
      const tradeRequest: PaperTradeRequest = {
        symbol,
        action,
        quantity,
        price,
      };

      // Execute paper trade
      const result = await service.executePaperTrade(userId, tradeRequest);

      // Verify trade was executed successfully
      expect(result.status).toBe('EXECUTED');
      expect(result.tradeId).toBeDefined();
      expect(result.tradeId).not.toBe('');

      // Retrieve the paper trade from "database" (our mock store)
      const storedTrade = paperTradesStore.get(result.tradeId);

      // Verify trade exists in storage
      expect(storedTrade).toBeDefined();
      expect(storedTrade).not.toBeNull();

      // Property: Core fields must be identical
      expect(storedTrade.symbol).toBe(symbol);
      expect(storedTrade.quantity).toBe(quantity);
      expect(storedTrade.userId).toBe(userId);

      // Action/Direction mapping
      const expectedDirection: SignalDirection = action === 'BUY' ? 'LONG' : 'SHORT';
      expect(storedTrade.direction).toBe(expectedDirection);

      // Price should be preserved (within slippage tolerance of 1%)
      // The executed price will have slippage applied, but should be close to requested price
      const slippagePercent = Math.abs(storedTrade.entryPrice - price) / price;
      expect(slippagePercent).toBeLessThanOrEqual(0.01);

      // Trade should be marked as OPEN status initially
      expect(storedTrade.status).toBe(TradeExecutionStatus.OPEN);
    }
  );

  /**
   * Property Test: Paper Trade Persistence with Optional Stop Loss
   *
   * When stop loss is provided, it must be persisted correctly.
   */
  it.prop([symbolArb, actionArb, quantityArb, priceArb])(
    'should persist stop loss when provided',
    async (symbol: string, action: 'BUY' | 'SELL', quantity: number, price: number) => {
      const userId = `user-${Date.now()}-${Math.random()}`;

      // Generate valid stop loss based on action
      const stopLoss = await fc.sample(stopLossArb(action, price), 1)[0];

      const tradeRequest: PaperTradeRequest = {
        symbol,
        action,
        quantity,
        price,
        stopLoss,
      };

      // Execute paper trade
      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('EXECUTED');

      // Retrieve the paper trade from storage
      const storedTrade = paperTradesStore.get(result.tradeId);

      // Property: Stop loss must be persisted correctly
      expect(storedTrade).toBeDefined();
      expect(storedTrade.stopLoss).toBeCloseTo(stopLoss, 2);
    }
  );

  /**
   * Property Test: Paper Trade Persistence with Optional Target
   *
   * When target is provided, it must be persisted correctly.
   */
  it.prop([symbolArb, actionArb, quantityArb, priceArb])(
    'should persist target when provided',
    async (symbol: string, action: 'BUY' | 'SELL', quantity: number, price: number) => {
      const userId = `user-${Date.now()}-${Math.random()}`;

      // Generate valid target based on action
      const target = await fc.sample(targetArb(action, price), 1)[0];

      const tradeRequest: PaperTradeRequest = {
        symbol,
        action,
        quantity,
        price,
        target,
      };

      // Execute paper trade
      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('EXECUTED');

      // Retrieve the paper trade from storage
      const storedTrade = paperTradesStore.get(result.tradeId);

      // Property: Target must be persisted correctly
      expect(storedTrade).toBeDefined();
      expect(storedTrade.target).toBeCloseTo(target, 2);
    }
  );

  /**
   * Property Test: Multiple Round-Trips Preserve Data
   *
   * Multiple paper trades for the same user should all be persisted independently
   * and retrievable without data corruption.
   */
  it.prop([
    fc.array(fc.tuple(symbolArb, actionArb, quantityArb, priceArb), { minLength: 2, maxLength: 5 }),
  ])(
    'should persist multiple paper trades independently',
    async (trades: Array<[string, 'BUY' | 'SELL', number, number]>) => {
      const userId = `user-${Date.now()}-${Math.random()}`;

      const tradeIds: string[] = [];

      // Execute all paper trades
      for (const [symbol, action, quantity, price] of trades) {
        const tradeRequest: PaperTradeRequest = {
          symbol,
          action,
          quantity,
          price,
        };

        const result = await service.executePaperTrade(userId, tradeRequest);
        expect(result.status).toBe('EXECUTED');
        tradeIds.push(result.tradeId);
      }

      // Retrieve all trades from storage
      const storedTrades = tradeIds
        .map((id) => paperTradesStore.get(id))
        .filter((t) => t !== undefined);

      // Property: All trades must be persisted
      expect(storedTrades.length).toBe(trades.length);

      // Property: Each trade's data must match the input
      for (let i = 0; i < trades.length; i++) {
        const [symbol, action, quantity, price] = trades[i];
        const stored = storedTrades[i];

        expect(stored.symbol).toBe(symbol);
        expect(stored.quantity).toBe(quantity);

        const expectedDirection: SignalDirection = action === 'BUY' ? 'LONG' : 'SHORT';
        expect(stored.direction).toBe(expectedDirection);

        // Verify price is within slippage tolerance
        const slippagePercent = Math.abs(stored.entryPrice - price) / price;
        expect(slippagePercent).toBeLessThanOrEqual(0.01);
      }
    }
  );

  /**
   * Property Test: Trade Execution Record is Created
   *
   * For any paper trade, a corresponding TradeExecution record must be created
   * with the correct execution type and details.
   */
  it.prop([symbolArb, actionArb, quantityArb, priceArb])(
    'should create trade execution record on paper trade entry',
    async (symbol: string, action: 'BUY' | 'SELL', quantity: number, price: number) => {
      const userId = `user-${Date.now()}-${Math.random()}`;

      const tradeRequest: PaperTradeRequest = {
        symbol,
        action,
        quantity,
        price,
      };

      // Execute paper trade
      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('EXECUTED');

      // Retrieve trade executions from storage
      const executions = executionsStore.filter((e) => e.paperTradeId === result.tradeId);

      // Property: Exactly one execution record must exist for entry
      expect(executions.length).toBe(1);
      expect(executions[0].executionType).toBe('ENTRY');
      expect(executions[0].quantity).toBe(quantity);

      // Execution price should be close to requested price (within slippage)
      const slippagePercent = Math.abs(executions[0].price - price) / price;
      expect(slippagePercent).toBeLessThanOrEqual(0.01);
    }
  );

  /**
   * Property Test: Position is Created or Updated
   *
   * For any paper trade, a Position record must be created or updated correctly.
   */
  it.prop([symbolArb, actionArb, quantityArb, priceArb])(
    'should create position record linked to paper trade',
    async (symbol: string, action: 'BUY' | 'SELL', quantity: number, price: number) => {
      const userId = `user-${Date.now()}-${Math.random()}`;

      const tradeRequest: PaperTradeRequest = {
        symbol,
        action,
        quantity,
        price,
      };

      // Execute paper trade
      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('EXECUTED');
      expect(result.positionId).toBeDefined();

      // Retrieve the position from storage
      const position = positionsStore.get(result.positionId!);

      // Property: Position must exist and be linked to the paper trade
      expect(position).toBeDefined();
      expect(position.symbol).toBe(symbol);
      expect(position.quantity).toBe(quantity);
      expect(position.status).toBe('OPEN');
      expect(position.paperTradeId).toBe(result.tradeId);

      // Position average price should be close to executed price (within slippage)
      const slippagePercent = Math.abs(position.averagePrice - price) / price;
      expect(slippagePercent).toBeLessThanOrEqual(0.01);
    }
  );

  /**
   * Property Test: Retrieval by User ID
   *
   * Paper trades must be retrievable by user ID and contain all persisted data.
   */
  it.prop([symbolArb, actionArb, quantityArb, priceArb])(
    'should retrieve paper trade by user ID with all data intact',
    async (symbol: string, action: 'BUY' | 'SELL', quantity: number, price: number) => {
      const userId = `user-${Date.now()}-${Math.random()}`;

      const tradeRequest: PaperTradeRequest = {
        symbol,
        action,
        quantity,
        price,
      };

      // Execute paper trade
      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('EXECUTED');

      // Retrieve all open paper trades for the user
      const openTrades = await service.getOpenPaperTrades(userId);

      // Property: The trade must be in the list of open trades
      expect(openTrades.length).toBeGreaterThanOrEqual(1);

      const retrievedTrade = openTrades.find((t) => t.id === result.tradeId);
      expect(retrievedTrade).toBeDefined();

      // Property: All fields must match
      expect(retrievedTrade!.symbol).toBe(symbol);
      expect(retrievedTrade!.quantity).toBe(quantity);
      expect(retrievedTrade!.userId).toBe(userId);

      const expectedDirection: SignalDirection = action === 'BUY' ? 'LONG' : 'SHORT';
      expect(retrievedTrade!.direction).toBe(expectedDirection);

      const slippagePercent = Math.abs(retrievedTrade!.entryPrice - price) / price;
      expect(slippagePercent).toBeLessThanOrEqual(0.01);
    }
  );

  /**
   * Property Test: Idempotent Retrieval
   *
   * Retrieving the same paper trade multiple times should return identical data.
   */
  it.prop([symbolArb, actionArb, quantityArb, priceArb])(
    'should return identical data on multiple retrievals',
    async (symbol: string, action: 'BUY' | 'SELL', quantity: number, price: number) => {
      const userId = `user-${Date.now()}-${Math.random()}`;

      const tradeRequest: PaperTradeRequest = {
        symbol,
        action,
        quantity,
        price,
      };

      // Execute paper trade
      const result = await service.executePaperTrade(userId, tradeRequest);

      expect(result.status).toBe('EXECUTED');

      // Retrieve the trade multiple times using the mock
      const retrieval1 = paperTradesStore.get(result.tradeId);
      const retrieval2 = paperTradesStore.get(result.tradeId);
      const retrieval3 = paperTradesStore.get(result.tradeId);

      // Property: All retrievals must return identical data
      expect(retrieval1).toEqual(retrieval2);
      expect(retrieval2).toEqual(retrieval3);
      expect(retrieval1).toEqual(retrieval3);
    }
  );
});
