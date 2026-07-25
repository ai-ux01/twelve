import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioService } from './portfolio.service';
import { PrismaService } from '../database/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import * as fc from 'fast-check';
import { it } from '@fast-check/jest';

/**
 * Property-Based Tests for PortfolioService - PnL Calculation Accuracy
 *
 * **Validates: Requirements 9.3, 11.2**
 *
 * Property 14: PnL Calculation Accuracy
 *
 * For any position with entryPrice and currentPrice, the unrealizedPnL SHALL equal
 * (currentPrice - entryPrice) × quantity for LONG positions.
 *
 * In this system, all positions are LONG (BUY), so we test:
 * unrealizedPnL = (currentPrice - averagePrice) × quantity
 */
describe('PortfolioService - Property 14: PnL Calculation Accuracy', () => {
  let service: PortfolioService;
  let mockPrismaService: any;
  let mockMarketDataService: any;

  beforeEach(async () => {
    mockMarketDataService = {
      getMarketData: jest.fn(),
    };

    mockPrismaService = {
      portfolio: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      position: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Arbitrary generators
   */
  const symbolArb = fc.stringMatching(/^[A-Z]{1,10}$/); // Stock symbols like RELIANCE, TCS
  const quantityArb = fc.integer({ min: 1, max: 10000 }); // Positive quantity only (LONG positions)
  const priceArb = fc
    .double({ min: 0.01, max: 1000000, noNaN: true, noDefaultInfinity: true })
    .filter((price) => isFinite(price) && price > 0); // Ensure valid prices
  const positionIdArb = fc.uuid();
  const portfolioIdArb = fc.uuid();
  const userIdArb = fc.uuid();

  /**
   * Property Test: PnL Calculation for Single Position Update
   *
   * When updating a position's current price, the calculated unrealizedPnL
   * must exactly equal (currentPrice - averagePrice) × quantity
   */
  it.prop([positionIdArb, symbolArb, quantityArb, priceArb, priceArb])(
    'should calculate unrealizedPnL = (currentPrice - averagePrice) × quantity for position update',
    async (
      positionId: string,
      symbol: string,
      quantity: number,
      averagePrice: number,
      currentPrice: number
    ) => {
      // Mock the position lookup
      const mockPosition = {
        id: positionId,
        symbol,
        quantity,
        averagePrice,
        currentPrice: averagePrice, // Initial current price
        unrealizedPnL: 0,
        status: 'OPEN',
      };

      mockPrismaService.position.findUnique.mockResolvedValue(mockPosition);
      mockPrismaService.position.update.mockResolvedValue({
        ...mockPosition,
        currentPrice,
      });

      // Calculate expected PnL
      const expectedPnL = (currentPrice - averagePrice) * quantity;

      // Update the position price
      await service.updatePositionPrice(positionId, currentPrice);

      // Verify that update was called with correct PnL calculation
      expect(mockPrismaService.position.update).toHaveBeenCalledWith({
        where: { id: positionId },
        data: {
          currentPrice,
          unrealizedPnL: expectedPnL,
        },
      });
    }
  );

  /**
   * Property Test: PnL Calculation in Portfolio Response
   *
   * When retrieving portfolio, each position's unrealizedPnL in the response
   * must exactly equal (currentPrice - averagePrice) × quantity
   */
  it.prop([
    userIdArb,
    portfolioIdArb,
    fc.array(
      fc.record({
        id: positionIdArb,
        symbol: symbolArb,
        quantity: quantityArb,
        averagePrice: priceArb,
        currentPrice: priceArb,
      }),
      { minLength: 1, maxLength: 10 }
    ),
  ])(
    'should calculate correct unrealizedPnL for each position in portfolio response',
    async (
      userId: string,
      portfolioId: string,
      positions: Array<{
        id: string;
        symbol: string;
        quantity: number;
        averagePrice: number;
        currentPrice: number;
      }>
    ) => {
      // Mock portfolio with positions
      const mockPortfolio = {
        id: portfolioId,
        userId,
        totalValue: 1000000,
        cashBalance: 500000,
        investedValue: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
      };

      const mockPositions = positions.map((pos) => ({
        ...pos,
        portfolioId,
        unrealizedPnL: 0,
        realizedPnL: 0,
        paperTradeId: null,
        liveTradeId: null,
        status: 'OPEN',
        openedAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      }));

      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        ...mockPortfolio,
        positions: mockPositions,
      });

      mockPrismaService.position.findMany.mockResolvedValue(mockPositions);
      mockPrismaService.position.update.mockResolvedValue({});
      mockPrismaService.portfolio.update.mockResolvedValue({});

      // Mock market data service to return current prices (no update)
      mockMarketDataService.getMarketData.mockResolvedValue({
        data: [],
      });

      // Get portfolio
      const portfolio = await service.getPortfolio(userId);

      // Verify each position has correct PnL calculation
      portfolio.positions.forEach((pos) => {
        const expectedPnL = (pos.currentPrice - pos.averagePrice) * pos.quantity;

        // Allow for floating-point precision errors (within 0.01)
        expect(Math.abs(pos.unrealizedPnL - expectedPnL)).toBeLessThan(0.01);
      });
    }
  );

  /**
   * Property Test: PnL Sign Correctness for Profit
   *
   * When currentPrice > averagePrice, unrealizedPnL must be positive (profit)
   */
  it.prop([
    positionIdArb,
    symbolArb,
    quantityArb,
    priceArb,
    fc.double({ min: 0.1, max: 2.0, noNaN: true, noDefaultInfinity: true }),
  ])(
    'should calculate positive PnL when currentPrice > averagePrice',
    async (
      positionId: string,
      symbol: string,
      quantity: number,
      averagePrice: number,
      priceIncreaseRatio: number
    ) => {
      // Precondition: ensure all values are finite
      fc.pre(isFinite(averagePrice) && isFinite(priceIncreaseRatio) && averagePrice > 0);

      // Ensure currentPrice > averagePrice by adding a multiplier
      const currentPrice = averagePrice * (1 + priceIncreaseRatio);

      // Precondition: ensure currentPrice is finite and greater than averagePrice
      fc.pre(isFinite(currentPrice) && currentPrice > averagePrice);

      const mockPosition = {
        id: positionId,
        symbol,
        quantity,
        averagePrice,
        currentPrice: averagePrice,
        unrealizedPnL: 0,
        status: 'OPEN',
      };

      mockPrismaService.position.findUnique.mockResolvedValue(mockPosition);

      // Don't mock the update return value - we just need to verify the call
      let capturedUpdateData: any = null;
      mockPrismaService.position.update.mockImplementation((args: any) => {
        capturedUpdateData = args.data;
        return Promise.resolve({
          ...mockPosition,
          ...args.data,
        });
      });

      const expectedPnL = (currentPrice - averagePrice) * quantity;

      await service.updatePositionPrice(positionId, currentPrice);

      // Verify PnL is positive and matches expected calculation
      expect(capturedUpdateData).toBeDefined();
      expect(capturedUpdateData.unrealizedPnL).toBeGreaterThan(0);

      // Verify the calculation is correct
      const actualPnL = capturedUpdateData.unrealizedPnL;
      expect(actualPnL).toBeCloseTo(expectedPnL, 10); // High precision for floating point
    }
  );

  /**
   * Property Test: PnL Sign Correctness for Loss
   *
   * When currentPrice < averagePrice, unrealizedPnL must be negative (loss)
   */
  it.prop([
    positionIdArb,
    symbolArb,
    quantityArb,
    priceArb,
    fc.double({ min: 0.1, max: 0.9, noNaN: true, noDefaultInfinity: true }),
  ])(
    'should calculate negative PnL when currentPrice < averagePrice',
    async (
      positionId: string,
      symbol: string,
      quantity: number,
      averagePrice: number,
      priceDecreaseRatio: number
    ) => {
      // Precondition: ensure all values are finite
      fc.pre(isFinite(averagePrice) && isFinite(priceDecreaseRatio) && averagePrice > 0);

      // Ensure currentPrice < averagePrice
      const currentPrice = averagePrice * (1 - priceDecreaseRatio);

      // Precondition: ensure currentPrice is finite and less than averagePrice
      fc.pre(isFinite(currentPrice) && currentPrice < averagePrice && currentPrice > 0);

      const mockPosition = {
        id: positionId,
        symbol,
        quantity,
        averagePrice,
        currentPrice: averagePrice,
        unrealizedPnL: 0,
        status: 'OPEN',
      };

      mockPrismaService.position.findUnique.mockResolvedValue(mockPosition);

      // Capture the update data
      let capturedUpdateData: any = null;
      mockPrismaService.position.update.mockImplementation((args: any) => {
        capturedUpdateData = args.data;
        return Promise.resolve({
          ...mockPosition,
          ...args.data,
        });
      });

      const expectedPnL = (currentPrice - averagePrice) * quantity;

      await service.updatePositionPrice(positionId, currentPrice);

      // Verify PnL is negative and matches expected calculation
      expect(capturedUpdateData).toBeDefined();
      expect(capturedUpdateData.unrealizedPnL).toBeLessThan(0);

      // Verify the calculation is correct
      const actualPnL = capturedUpdateData.unrealizedPnL;
      expect(actualPnL).toBeCloseTo(expectedPnL, 10); // High precision for floating point
    }
  );

  /**
   * Property Test: PnL Zero at Breakeven
   *
   * When currentPrice = averagePrice, unrealizedPnL must be exactly zero
   */
  it.prop([positionIdArb, symbolArb, quantityArb, priceArb])(
    'should calculate zero PnL when currentPrice = averagePrice',
    async (positionId: string, symbol: string, quantity: number, averagePrice: number) => {
      const currentPrice = averagePrice;

      const mockPosition = {
        id: positionId,
        symbol,
        quantity,
        averagePrice,
        currentPrice: averagePrice,
        unrealizedPnL: 0,
        status: 'OPEN',
      };

      mockPrismaService.position.findUnique.mockResolvedValue(mockPosition);
      mockPrismaService.position.update.mockResolvedValue({
        ...mockPosition,
        currentPrice,
      });

      await service.updatePositionPrice(positionId, currentPrice);

      // Verify PnL is exactly zero
      const updateCall = mockPrismaService.position.update.mock.calls[0][0];
      expect(updateCall.data.unrealizedPnL).toBe(0);
    }
  );

  /**
   * Property Test: PnL Scales Linearly with Quantity
   *
   * For a fixed price difference, doubling the quantity should double the PnL
   */
  it.prop([positionIdArb, symbolArb, quantityArb, priceArb, priceArb])(
    'should scale PnL linearly with quantity',
    async (
      positionId: string,
      symbol: string,
      baseQuantity: number,
      averagePrice: number,
      currentPrice: number
    ) => {
      // Test with base quantity
      const mockPosition1 = {
        id: positionId,
        symbol,
        quantity: baseQuantity,
        averagePrice,
        currentPrice: averagePrice,
        unrealizedPnL: 0,
        status: 'OPEN',
      };

      mockPrismaService.position.findUnique.mockResolvedValue(mockPosition1);

      let capturedPnL1: number = 0;
      mockPrismaService.position.update.mockImplementation((args: any) => {
        capturedPnL1 = args.data.unrealizedPnL;
        return Promise.resolve({
          ...mockPosition1,
          ...args.data,
        });
      });

      await service.updatePositionPrice(positionId, currentPrice);

      const pnl1 = capturedPnL1;

      // Reset mocks
      jest.clearAllMocks();

      // Test with double quantity
      const mockPosition2 = {
        id: positionId,
        symbol,
        quantity: baseQuantity * 2,
        averagePrice,
        currentPrice: averagePrice,
        unrealizedPnL: 0,
        status: 'OPEN',
      };

      mockPrismaService.position.findUnique.mockResolvedValue(mockPosition2);

      let capturedPnL2: number = 0;
      mockPrismaService.position.update.mockImplementation((args: any) => {
        capturedPnL2 = args.data.unrealizedPnL;
        return Promise.resolve({
          ...mockPosition2,
          ...args.data,
        });
      });

      await service.updatePositionPrice(positionId, currentPrice);

      const pnl2 = capturedPnL2;

      // Verify double quantity gives double PnL (within floating-point precision)
      if (pnl1 !== 0) {
        expect(pnl2).toBeCloseTo(pnl1 * 2, 10);
      } else {
        // If pnl1 is 0, pnl2 should also be 0 (prices are equal)
        expect(pnl2).toBe(0);
      }
    }
  );

  /**
   * Property Test: Total Portfolio PnL is Sum of Individual Position PnLs
   *
   * The total unrealized PnL must equal the sum of all individual position PnLs
   */
  it.prop([
    userIdArb,
    portfolioIdArb,
    fc.array(
      fc.record({
        id: positionIdArb,
        symbol: symbolArb,
        quantity: quantityArb,
        averagePrice: priceArb,
        currentPrice: priceArb,
      }),
      { minLength: 1, maxLength: 5 }
    ),
  ])(
    'should calculate total PnL as sum of individual position PnLs',
    async (
      userId: string,
      portfolioId: string,
      positions: Array<{
        id: string;
        symbol: string;
        quantity: number;
        averagePrice: number;
        currentPrice: number;
      }>
    ) => {
      const mockPortfolio = {
        id: portfolioId,
        userId,
        totalValue: 1000000,
        cashBalance: 500000,
        investedValue: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
      };

      const mockPositions = positions.map((pos) => ({
        ...pos,
        portfolioId,
        unrealizedPnL: 0,
        realizedPnL: 0,
        paperTradeId: null,
        liveTradeId: null,
        status: 'OPEN',
        openedAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      }));

      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        ...mockPortfolio,
        positions: mockPositions,
      });

      mockPrismaService.position.findMany.mockResolvedValue(mockPositions);
      mockPrismaService.position.update.mockResolvedValue({});
      mockPrismaService.portfolio.update.mockResolvedValue({});

      mockMarketDataService.getMarketData.mockResolvedValue({
        data: [],
      });

      const portfolio = await service.getPortfolio(userId);

      // Calculate expected total PnL
      const expectedTotalPnL = positions.reduce(
        (sum, pos) => sum + (pos.currentPrice - pos.averagePrice) * pos.quantity,
        0
      );

      // Verify total PnL matches sum of individual PnLs
      expect(Math.abs(portfolio.totalPnL - expectedTotalPnL)).toBeLessThan(0.01);

      // Also verify it equals the sum of returned position PnLs
      const sumOfPositionPnLs = portfolio.positions.reduce(
        (sum, pos) => sum + pos.unrealizedPnL,
        0
      );
      expect(Math.abs(portfolio.totalPnL - sumOfPositionPnLs)).toBeLessThan(0.01);
    }
  );

  /**
   * Property Test: PnL Percentage Calculation Accuracy
   *
   * unrealizedPnLPercent should equal ((currentPrice - averagePrice) / averagePrice) × 100
   */
  it.prop([
    userIdArb,
    portfolioIdArb,
    fc.record({
      id: positionIdArb,
      symbol: symbolArb,
      quantity: quantityArb,
      averagePrice: priceArb,
      currentPrice: priceArb,
    }),
  ])(
    'should calculate correct PnL percentage',
    async (
      userId: string,
      portfolioId: string,
      position: {
        id: string;
        symbol: string;
        quantity: number;
        averagePrice: number;
        currentPrice: number;
      }
    ) => {
      const mockPortfolio = {
        id: portfolioId,
        userId,
        totalValue: 1000000,
        cashBalance: 500000,
        investedValue: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
      };

      const mockPosition = {
        ...position,
        portfolioId,
        unrealizedPnL: 0,
        realizedPnL: 0,
        paperTradeId: null,
        liveTradeId: null,
        status: 'OPEN',
        openedAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        ...mockPortfolio,
        positions: [mockPosition],
      });

      mockPrismaService.position.findMany.mockResolvedValue([mockPosition]);
      mockPrismaService.position.update.mockResolvedValue({});
      mockPrismaService.portfolio.update.mockResolvedValue({});

      mockMarketDataService.getMarketData.mockResolvedValue({
        data: [],
      });

      const portfolio = await service.getPortfolio(userId);

      // Calculate expected PnL percentage
      const expectedPnLPercent =
        ((position.currentPrice - position.averagePrice) / position.averagePrice) * 100;

      // Verify PnL percentage calculation
      const returnedPosition = portfolio.positions[0];
      expect(Math.abs(returnedPosition.unrealizedPnLPercent - expectedPnLPercent)).toBeLessThan(
        0.01
      );
    }
  );
});
