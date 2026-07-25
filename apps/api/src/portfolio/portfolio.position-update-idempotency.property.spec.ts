import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioService } from './portfolio.service';
import { PrismaService } from '../database/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import * as fc from 'fast-check';
import { it } from '@fast-check/jest';

/**
 * Property-Based Tests for PortfolioService - Position Update Idempotency
 *
 * **Validates: Requirements 9.4**
 *
 * Property 15: Position Update Idempotency
 *
 * For any position, updating it multiple times with the same currentPrice
 * SHALL result in the same PnL value each time.
 */
describe('PortfolioService - Property 15: Position Update Idempotency', () => {
  let service: PortfolioService;
  let mockPrismaService: any;
  let mockMarketDataService: any;

  beforeEach(async () => {
    mockPrismaService = {
      position: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    mockMarketDataService = {
      getMarketData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MarketDataService,
          useValue: mockMarketDataService,
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    mockPrismaService = module.get(PrismaService);
    mockMarketDataService = module.get(MarketDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Arbitrary generators for test data
   */
  const positionIdArb = fc.uuid();
  const symbolArb = fc.string({ minLength: 1, maxLength: 20 });
  const quantityArb = fc.integer({ min: 1, max: 10000 });
  const averagePriceArb = fc.double({
    min: 0.01,
    max: 100000,
    noNaN: true,
    noDefaultInfinity: true,
  });
  const currentPriceArb = fc.double({
    min: 0.01,
    max: 100000,
    noNaN: true,
    noDefaultInfinity: true,
  });
  const updateCountArb = fc.integer({ min: 2, max: 10 });

  /**
   * Property Test: Multiple updates with same price produce identical PnL
   *
   * This is the core idempotency test. Updating a position multiple times
   * with the same currentPrice should always result in the same unrealizedPnL.
   */
  it.prop([
    positionIdArb,
    symbolArb,
    quantityArb,
    averagePriceArb,
    currentPriceArb,
    updateCountArb,
  ])(
    'should produce identical PnL when updating position multiple times with same currentPrice',
    async (
      positionId: string,
      symbol: string,
      quantity: number,
      averagePrice: number,
      currentPrice: number,
      updateCount: number
    ) => {
      // Mock position data
      const mockPosition = {
        id: positionId,
        portfolioId: 'portfolio-123',
        symbol,
        quantity,
        averagePrice,
        currentPrice: averagePrice, // Initial price equals average price
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN' as const,
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      // Track all PnL values calculated across multiple updates
      const pnlValues: number[] = [];

      // Perform multiple updates with the same currentPrice
      for (let i = 0; i < updateCount; i++) {
        // Reset mock for each iteration
        mockPrismaService.position.findUnique.mockResolvedValue(mockPosition);

        let capturedPnL: number | undefined;

        // Capture the PnL value that gets written to the database
        mockPrismaService.position.update.mockImplementation(({ data }: any) => {
          capturedPnL = data.unrealizedPnL;
          return Promise.resolve({
            ...mockPosition,
            currentPrice: data.currentPrice,
            unrealizedPnL: data.unrealizedPnL,
          });
        });

        // Update position price
        await service.updatePositionPrice(positionId, currentPrice);

        // Store the PnL value from this update
        expect(capturedPnL).toBeDefined();
        pnlValues.push(capturedPnL!);
      }

      // All PnL values should be identical (idempotency property)
      const firstPnL = pnlValues[0];
      for (const pnl of pnlValues) {
        expect(pnl).toBe(firstPnL);
      }

      // Additionally verify the PnL calculation is correct
      const expectedPnL = (currentPrice - averagePrice) * quantity;
      expect(firstPnL).toBeCloseTo(expectedPnL, 10);
    }
  );

  /**
   * Property Test: Idempotency holds for positive PnL positions
   *
   * When currentPrice > averagePrice (profitable position),
   * multiple updates should produce identical positive PnL.
   */
  it.prop([
    positionIdArb,
    symbolArb,
    quantityArb,
    fc.double({ min: 1, max: 50000, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 0.01, max: 0.99, noNaN: true, noDefaultInfinity: true }),
  ])(
    'should maintain idempotency for profitable positions (currentPrice > averagePrice)',
    async (
      positionId: string,
      symbol: string,
      quantity: number,
      averagePrice: number,
      profitMultiplier: number
    ) => {
      // Generate currentPrice > averagePrice
      const currentPrice = averagePrice * (1 + profitMultiplier);

      const mockPosition = {
        id: positionId,
        portfolioId: 'portfolio-123',
        symbol,
        quantity,
        averagePrice,
        currentPrice: averagePrice,
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN' as const,
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      const pnlValues: number[] = [];

      // Update 3 times
      for (let i = 0; i < 3; i++) {
        mockPrismaService.position.findUnique.mockResolvedValue(mockPosition);

        let capturedPnL: number | undefined;
        mockPrismaService.position.update.mockImplementation(({ data }: any) => {
          capturedPnL = data.unrealizedPnL;
          return Promise.resolve({
            ...mockPosition,
            currentPrice: data.currentPrice,
            unrealizedPnL: data.unrealizedPnL,
          });
        });

        await service.updatePositionPrice(positionId, currentPrice);
        expect(capturedPnL).toBeDefined();
        pnlValues.push(capturedPnL!);
      }

      // All PnL values should be identical and positive
      expect(pnlValues[0]).toBeGreaterThan(0);
      expect(pnlValues[1]).toBe(pnlValues[0]);
      expect(pnlValues[2]).toBe(pnlValues[0]);
    }
  );

  /**
   * Property Test: Idempotency holds for negative PnL positions
   *
   * When currentPrice < averagePrice (losing position),
   * multiple updates should produce identical negative PnL.
   */
  it.prop([
    positionIdArb,
    symbolArb,
    quantityArb,
    fc.double({ min: 10, max: 50000, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 0.01, max: 0.99, noNaN: true, noDefaultInfinity: true }),
  ])(
    'should maintain idempotency for losing positions (currentPrice < averagePrice)',
    async (
      positionId: string,
      symbol: string,
      quantity: number,
      averagePrice: number,
      lossMultiplier: number
    ) => {
      // Generate currentPrice < averagePrice
      const currentPrice = averagePrice * (1 - lossMultiplier);

      const mockPosition = {
        id: positionId,
        portfolioId: 'portfolio-123',
        symbol,
        quantity,
        averagePrice,
        currentPrice: averagePrice,
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN' as const,
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      const pnlValues: number[] = [];

      // Update 3 times
      for (let i = 0; i < 3; i++) {
        mockPrismaService.position.findUnique.mockResolvedValue(mockPosition);

        let capturedPnL: number | undefined;
        mockPrismaService.position.update.mockImplementation(({ data }: any) => {
          capturedPnL = data.unrealizedPnL;
          return Promise.resolve({
            ...mockPosition,
            currentPrice: data.currentPrice,
            unrealizedPnL: data.unrealizedPnL,
          });
        });

        await service.updatePositionPrice(positionId, currentPrice);
        expect(capturedPnL).toBeDefined();
        pnlValues.push(capturedPnL!);
      }

      // All PnL values should be identical and negative
      expect(pnlValues[0]).toBeLessThan(0);
      expect(pnlValues[1]).toBe(pnlValues[0]);
      expect(pnlValues[2]).toBe(pnlValues[0]);
    }
  );

  /**
   * Property Test: Idempotency holds for zero PnL (breakeven) positions
   *
   * When currentPrice === averagePrice (breakeven),
   * multiple updates should produce identical zero PnL.
   */
  it.prop([positionIdArb, symbolArb, quantityArb, averagePriceArb])(
    'should maintain idempotency for breakeven positions (currentPrice === averagePrice)',
    async (positionId: string, symbol: string, quantity: number, averagePrice: number) => {
      const currentPrice = averagePrice; // Breakeven

      const mockPosition = {
        id: positionId,
        portfolioId: 'portfolio-123',
        symbol,
        quantity,
        averagePrice,
        currentPrice: averagePrice,
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN' as const,
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      const pnlValues: number[] = [];

      // Update 3 times
      for (let i = 0; i < 3; i++) {
        mockPrismaService.position.findUnique.mockResolvedValue(mockPosition);

        let capturedPnL: number | undefined;
        mockPrismaService.position.update.mockImplementation(({ data }: any) => {
          capturedPnL = data.unrealizedPnL;
          return Promise.resolve({
            ...mockPosition,
            currentPrice: data.currentPrice,
            unrealizedPnL: data.unrealizedPnL,
          });
        });

        await service.updatePositionPrice(positionId, currentPrice);
        expect(capturedPnL).toBeDefined();
        pnlValues.push(capturedPnL!);
      }

      // All PnL values should be identical and zero
      expect(pnlValues[0]).toBe(0);
      expect(pnlValues[1]).toBe(0);
      expect(pnlValues[2]).toBe(0);
    }
  );

  /**
   * Property Test: Update order independence (idempotency corollary)
   *
   * If we update a position with priceA, then priceB, then priceA again,
   * the first and third updates should produce identical PnL values.
   */
  it.prop([
    positionIdArb,
    symbolArb,
    quantityArb,
    averagePriceArb,
    fc.double({ min: 0.01, max: 100000, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 0.01, max: 100000, noNaN: true, noDefaultInfinity: true }),
  ])(
    'should produce identical PnL when returning to the same price (order independence)',
    async (
      positionId: string,
      symbol: string,
      quantity: number,
      averagePrice: number,
      priceA: number,
      priceB: number
    ) => {
      const mockPosition = {
        id: positionId,
        portfolioId: 'portfolio-123',
        symbol,
        quantity,
        averagePrice,
        currentPrice: averagePrice,
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN' as const,
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      let pnlAtFirstPriceA: number | undefined;
      let pnlAtPriceB: number | undefined;
      let pnlAtSecondPriceA: number | undefined;

      // First update with priceA
      mockPrismaService.position.findUnique.mockResolvedValue(mockPosition);
      mockPrismaService.position.update.mockImplementation(({ data }: any) => {
        pnlAtFirstPriceA = data.unrealizedPnL;
        return Promise.resolve({
          ...mockPosition,
          currentPrice: data.currentPrice,
          unrealizedPnL: data.unrealizedPnL,
        });
      });
      await service.updatePositionPrice(positionId, priceA);

      // Update with priceB
      mockPrismaService.position.findUnique.mockResolvedValue({
        ...mockPosition,
        currentPrice: priceA,
        unrealizedPnL: pnlAtFirstPriceA,
      });
      mockPrismaService.position.update.mockImplementation(({ data }: any) => {
        pnlAtPriceB = data.unrealizedPnL;
        return Promise.resolve({
          ...mockPosition,
          currentPrice: data.currentPrice,
          unrealizedPnL: data.unrealizedPnL,
        });
      });
      await service.updatePositionPrice(positionId, priceB);

      // Return to priceA again
      mockPrismaService.position.findUnique.mockResolvedValue({
        ...mockPosition,
        currentPrice: priceB,
        unrealizedPnL: pnlAtPriceB,
      });
      mockPrismaService.position.update.mockImplementation(({ data }: any) => {
        pnlAtSecondPriceA = data.unrealizedPnL;
        return Promise.resolve({
          ...mockPosition,
          currentPrice: data.currentPrice,
          unrealizedPnL: data.unrealizedPnL,
        });
      });
      await service.updatePositionPrice(positionId, priceA);

      // The first and third PnL values (both at priceA) should be identical
      expect(pnlAtFirstPriceA).toBeDefined();
      expect(pnlAtSecondPriceA).toBeDefined();
      expect(pnlAtSecondPriceA).toBe(pnlAtFirstPriceA);

      // Verify the PnL calculations are correct
      const expectedPnLAtPriceA = (priceA - averagePrice) * quantity;
      const expectedPnLAtPriceB = (priceB - averagePrice) * quantity;
      expect(pnlAtFirstPriceA).toBeCloseTo(expectedPnLAtPriceA, 10);
      expect(pnlAtPriceB).toBeCloseTo(expectedPnLAtPriceB, 10);
      expect(pnlAtSecondPriceA).toBeCloseTo(expectedPnLAtPriceA, 10);
    }
  );

  /**
   * Property Test: Universal Idempotency - Deterministic PnL Formula
   *
   * For ANY position update, the PnL must always follow the deterministic formula:
   * unrealizedPnL = (currentPrice - averagePrice) × quantity
   *
   * This ensures idempotency because the calculation depends only on the inputs,
   * not on any internal state or previous calculations.
   */
  it.prop([positionIdArb, symbolArb, quantityArb, averagePriceArb, currentPriceArb])(
    'universal: PnL calculation is deterministic and depends only on inputs',
    async (
      positionId: string,
      symbol: string,
      quantity: number,
      averagePrice: number,
      currentPrice: number
    ) => {
      const mockPosition = {
        id: positionId,
        portfolioId: 'portfolio-123',
        symbol,
        quantity,
        averagePrice,
        currentPrice: averagePrice,
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN' as const,
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      // Track PnL values from multiple updates
      const pnlValues: number[] = [];

      // Perform 5 updates with the same price to test idempotency
      for (let i = 0; i < 5; i++) {
        mockPrismaService.position.findUnique.mockResolvedValue({
          ...mockPosition,
          // Vary the existing unrealizedPnL to ensure it doesn't affect result
          unrealizedPnL: i * 1000,
        });

        let capturedPnL: number | undefined;
        mockPrismaService.position.update.mockImplementation(({ data }: any) => {
          capturedPnL = data.unrealizedPnL;
          return Promise.resolve({
            ...mockPosition,
            currentPrice: data.currentPrice,
            unrealizedPnL: data.unrealizedPnL,
          });
        });

        await service.updatePositionPrice(positionId, currentPrice);
        expect(capturedPnL).toBeDefined();
        pnlValues.push(capturedPnL!);
      }

      // Calculate expected PnL using the deterministic formula
      const expectedPnL = (currentPrice - averagePrice) * quantity;

      // All calculated PnL values must match the expected value
      for (const pnl of pnlValues) {
        expect(pnl).toBeCloseTo(expectedPnL, 10);
      }

      // All PnL values must be identical to each other (idempotency)
      for (let i = 1; i < pnlValues.length; i++) {
        expect(pnlValues[i]).toBe(pnlValues[0]);
      }
    }
  );

  /**
   * Property Test: Large quantity positions maintain idempotency
   *
   * Even with very large position sizes, idempotency should hold.
   */
  it.prop([
    positionIdArb,
    symbolArb,
    fc.integer({ min: 10000, max: 1000000 }), // Large quantities
    averagePriceArb,
    currentPriceArb,
  ])(
    'should maintain idempotency for large quantity positions',
    async (
      positionId: string,
      symbol: string,
      quantity: number,
      averagePrice: number,
      currentPrice: number
    ) => {
      const mockPosition = {
        id: positionId,
        portfolioId: 'portfolio-123',
        symbol,
        quantity,
        averagePrice,
        currentPrice: averagePrice,
        unrealizedPnL: 0,
        realizedPnL: 0,
        status: 'OPEN' as const,
        paperTradeId: null,
        liveTradeId: null,
        openedAt: new Date(),
        closedAt: null,
        updatedAt: new Date(),
      };

      const pnlValues: number[] = [];

      // Update 3 times
      for (let i = 0; i < 3; i++) {
        mockPrismaService.position.findUnique.mockResolvedValue(mockPosition);

        let capturedPnL: number | undefined;
        mockPrismaService.position.update.mockImplementation(({ data }: any) => {
          capturedPnL = data.unrealizedPnL;
          return Promise.resolve({
            ...mockPosition,
            currentPrice: data.currentPrice,
            unrealizedPnL: data.unrealizedPnL,
          });
        });

        await service.updatePositionPrice(positionId, currentPrice);
        expect(capturedPnL).toBeDefined();
        pnlValues.push(capturedPnL!);
      }

      // All PnL values should be identical, even with large quantities
      expect(pnlValues[1]).toBe(pnlValues[0]);
      expect(pnlValues[2]).toBe(pnlValues[0]);

      // Verify calculation is correct
      const expectedPnL = (currentPrice - averagePrice) * quantity;
      expect(pnlValues[0]).toBeCloseTo(expectedPnL, 5);
    }
  );
});
