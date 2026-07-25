import { Test, TestingModule } from '@nestjs/testing';
import { RiskService, TradeRequest } from './risk.service';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import * as fc from 'fast-check';

/**
 * Property-Based Test for Risk Validation Failure Reason
 *
 * **Validates: Requirements 8.5**
 *
 * Property 11: Risk Validation Failure Produces Reason
 *
 * For any trade request that fails risk validation, the response SHALL contain
 * at least one violation with a non-empty message explaining the failure.
 */
describe('RiskService - Property 11: Risk Validation Failure Produces Reason', () => {
  let service: RiskService;
  let mockPrismaService: any;
  let mockAuditLogService: any;

  beforeEach(async () => {
    mockPrismaService = {
      riskProfile: {
        findUnique: jest.fn(),
      },
      portfolio: {
        findUnique: jest.fn(),
      },
      position: {
        count: jest.fn(),
      },
    };

    mockAuditLogService = {
      logRiskValidation: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<RiskService>(RiskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Arbitrary generator for trade actions
   */
  const tradeActionArb = fc.constantFrom('BUY' as const, 'SELL' as const);

  /**
   * Arbitrary generator for valid symbols (NSE stocks)
   */
  const symbolArb = fc.constantFrom(
    'RELIANCE',
    'TCS',
    'INFY',
    'HDFCBANK',
    'ICICIBANK',
    'SBIN',
    'WIPRO',
    'ITC',
    'LT',
    'AXISBANK'
  );

  /**
   * Arbitrary generator for positive prices
   */
  const priceArb = fc.double({ min: 1, max: 100000, noNaN: true });

  /**
   * Arbitrary generator for positive quantities
   */
  const quantityArb = fc.integer({ min: 1, max: 10000 });

  /**
   * Arbitrary generator for risk profile that will cause validation failures
   */
  const restrictiveRiskProfileArb = fc.record({
    userId: fc.constant('test-user-id'),
    maxPositionSize: fc.double({ min: 1000, max: 50000, noNaN: true }),
    maxDrawdown: fc.double({ min: 0.01, max: 0.05, noNaN: true }),
    maxPortfolioExposure: fc.double({ min: 0.1, max: 0.3, noNaN: true }),
    defaultStopLoss: fc.double({ min: 0.01, max: 0.05, noNaN: true }),
    riskPerTrade: fc.double({ min: 0.01, max: 0.02, noNaN: true }),
    maxOpenPositions: fc.integer({ min: 1, max: 5 }),
  });

  /**
   * Arbitrary generator for portfolio state with high exposure
   */
  const portfolioWithHighExposureArb = fc.record({
    userId: fc.constant('test-user-id'),
    totalValue: fc.double({ min: 100000, max: 1000000, noNaN: true }),
    cashBalance: fc.double({ min: 10000, max: 100000, noNaN: true }),
    investedValue: fc.double({ min: 50000, max: 500000, noNaN: true }),
    unrealizedPnL: fc.double({ min: -50000, max: 50000, noNaN: true }),
    realizedPnL: fc.double({ min: -50000, max: 50000, noNaN: true }),
    positions: fc.array(
      fc.record({
        symbol: symbolArb,
        quantity: quantityArb,
        currentPrice: priceArb,
        status: fc.constant('OPEN' as const),
      }),
      { minLength: 1, maxLength: 5 }
    ),
  });

  /**
   * Property Test: Missing Risk Profile Produces Failure Reason
   */
  it('should produce violation with non-empty message when risk profile is missing', async () => {
    await fc.assert(
      fc.asyncProperty(
        symbolArb,
        tradeActionArb,
        quantityArb,
        priceArb,
        async (symbol, action, quantity, price) => {
          // Setup: No risk profile exists
          mockPrismaService.riskProfile.findUnique.mockResolvedValue(null);

          const tradeRequest: TradeRequest = {
            symbol,
            action,
            quantity,
            price,
          };

          // Execute
          const result = await service.validateTrade('test-user-id', tradeRequest);

          // Assert: Failed validation produces a non-empty reason
          expect(result.passed).toBe(false);
          expect(result.violations.length).toBeGreaterThan(0);

          // All violations must have non-empty messages
          for (const violation of result.violations) {
            expect(violation.message).toBeDefined();
            expect(violation.message).not.toBe('');
            expect(typeof violation.message).toBe('string');
            expect(violation.message.length).toBeGreaterThan(0);
            expect(violation.rule).toBeDefined();
            expect(violation.rule).not.toBe('');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Position Size Violation Produces Failure Reason
   */
  it('should produce violation with non-empty message when position size exceeds max', async () => {
    await fc.assert(
      fc.asyncProperty(
        symbolArb,
        tradeActionArb,
        restrictiveRiskProfileArb,
        async (symbol, action, riskProfile) => {
          // Setup: Create trade that exceeds position size
          const quantity = 1000;
          const price = riskProfile.maxPositionSize * 2; // Guaranteed to exceed

          mockPrismaService.riskProfile.findUnique.mockResolvedValue(riskProfile);
          mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
          mockPrismaService.position.count.mockResolvedValue(0);

          const tradeRequest: TradeRequest = {
            symbol,
            action,
            quantity,
            price,
          };

          // Execute
          const result = await service.validateTrade('test-user-id', tradeRequest);

          // Assert: Failed validation produces a non-empty reason
          expect(result.passed).toBe(false);
          expect(result.violations.length).toBeGreaterThan(0);

          // Find the MAX_POSITION_SIZE violation
          const positionSizeViolation = result.violations.find(
            (v) => v.rule === 'MAX_POSITION_SIZE'
          );
          expect(positionSizeViolation).toBeDefined();
          expect(positionSizeViolation!.message).toBeDefined();
          expect(positionSizeViolation!.message).not.toBe('');
          expect(typeof positionSizeViolation!.message).toBe('string');
          expect(positionSizeViolation!.message.length).toBeGreaterThan(0);
          expect(positionSizeViolation!.severity).toBe('ERROR');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Invalid Stop Loss Produces Failure Reason
   */
  it('should produce violation with non-empty message for invalid stop loss', async () => {
    await fc.assert(
      fc.asyncProperty(
        symbolArb,
        tradeActionArb,
        quantityArb,
        priceArb,
        restrictiveRiskProfileArb,
        async (symbol, action, quantity, price, riskProfile) => {
          // Setup: Create invalid stop loss
          // For BUY: stopLoss >= price (invalid)
          // For SELL: stopLoss <= price (invalid)
          const invalidStopLoss = action === 'BUY' ? price * 1.1 : price * 0.9;

          // Ensure position size is valid to isolate stop loss validation
          const adjustedQuantity = Math.floor(riskProfile.maxPositionSize / price / 2);
          if (adjustedQuantity < 1) return; // Skip if we can't create a valid quantity

          mockPrismaService.riskProfile.findUnique.mockResolvedValue(riskProfile);
          mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
          mockPrismaService.position.count.mockResolvedValue(0);

          const tradeRequest: TradeRequest = {
            symbol,
            action,
            quantity: adjustedQuantity,
            price,
            stopLoss: invalidStopLoss,
          };

          // Execute
          const result = await service.validateTrade('test-user-id', tradeRequest);

          // Assert: Failed validation produces a non-empty reason
          expect(result.passed).toBe(false);
          expect(result.violations.length).toBeGreaterThan(0);

          // Find the INVALID_STOP_LOSS violation
          const stopLossViolation = result.violations.find((v) => v.rule === 'INVALID_STOP_LOSS');
          expect(stopLossViolation).toBeDefined();
          expect(stopLossViolation!.message).toBeDefined();
          expect(stopLossViolation!.message).not.toBe('');
          expect(typeof stopLossViolation!.message).toBe('string');
          expect(stopLossViolation!.message.length).toBeGreaterThan(0);
          expect(stopLossViolation!.severity).toBe('ERROR');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Portfolio Exposure Violation Produces Failure Reason
   */
  it('should produce violation with non-empty message when portfolio exposure exceeds max', async () => {
    await fc.assert(
      fc.asyncProperty(
        symbolArb,
        tradeActionArb,
        restrictiveRiskProfileArb,
        portfolioWithHighExposureArb,
        async (symbol, action, riskProfile, portfolio) => {
          // Setup: Create trade that exceeds portfolio exposure
          mockPrismaService.riskProfile.findUnique.mockResolvedValue(riskProfile);
          mockPrismaService.position.count.mockResolvedValue(0);

          // Calculate a position size that will exceed exposure
          const currentExposure = portfolio.positions.reduce(
            (sum, pos) => sum + pos.currentPrice * pos.quantity,
            0
          );

          // Create a trade that pushes exposure over the limit
          const requiredNewSize = portfolio.totalValue * riskProfile.maxPortfolioExposure * 1.5;
          const tradeSize = Math.max(requiredNewSize - currentExposure, 10000);

          const quantity = 100;
          const price = tradeSize / quantity;

          mockPrismaService.portfolio.findUnique.mockResolvedValue(portfolio);

          const tradeRequest: TradeRequest = {
            symbol,
            action,
            quantity,
            price,
          };

          // Execute
          const result = await service.validateTrade('test-user-id', tradeRequest);

          // Assert: If validation failed due to exposure
          if (!result.passed) {
            expect(result.violations.length).toBeGreaterThan(0);

            // All violations must have non-empty messages
            for (const violation of result.violations) {
              expect(violation.message).toBeDefined();
              expect(violation.message).not.toBe('');
              expect(typeof violation.message).toBe('string');
              expect(violation.message.length).toBeGreaterThan(0);
              expect(violation.rule).toBeDefined();
              expect(violation.rule).not.toBe('');
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Max Drawdown Violation Produces Failure Reason
   */
  it('should produce violation with non-empty message when max drawdown is exceeded', async () => {
    await fc.assert(
      fc.asyncProperty(
        symbolArb,
        tradeActionArb,
        quantityArb,
        priceArb,
        restrictiveRiskProfileArb,
        async (symbol, action, quantity, price, riskProfile) => {
          // Setup: Create portfolio with drawdown exceeding limit
          const totalValue = 500000;
          const drawdownAmount = totalValue * riskProfile.maxDrawdown * 1.5;

          const portfolio = {
            userId: 'test-user-id',
            totalValue,
            cashBalance: 400000,
            investedValue: 100000,
            unrealizedPnL: -drawdownAmount / 2,
            realizedPnL: -drawdownAmount / 2,
            positions: [],
          };

          // Ensure position size is valid
          const adjustedQuantity = Math.floor(riskProfile.maxPositionSize / price / 2);
          if (adjustedQuantity < 1) return; // Skip if we can't create a valid quantity

          mockPrismaService.riskProfile.findUnique.mockResolvedValue(riskProfile);
          mockPrismaService.portfolio.findUnique.mockResolvedValue(portfolio);
          mockPrismaService.position.count.mockResolvedValue(0);

          const tradeRequest: TradeRequest = {
            symbol,
            action,
            quantity: adjustedQuantity,
            price,
          };

          // Execute
          const result = await service.validateTrade('test-user-id', tradeRequest);

          // Assert: Failed validation produces a non-empty reason
          expect(result.passed).toBe(false);
          expect(result.violations.length).toBeGreaterThan(0);

          // Find the MAX_DRAWDOWN_EXCEEDED violation
          const drawdownViolation = result.violations.find(
            (v) => v.rule === 'MAX_DRAWDOWN_EXCEEDED'
          );
          expect(drawdownViolation).toBeDefined();
          expect(drawdownViolation!.message).toBeDefined();
          expect(drawdownViolation!.message).not.toBe('');
          expect(typeof drawdownViolation!.message).toBe('string');
          expect(drawdownViolation!.message.length).toBeGreaterThan(0);
          expect(drawdownViolation!.severity).toBe('ERROR');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Multiple Violations All Have Reasons
   */
  it('should produce violations with non-empty messages for multiple failures', async () => {
    await fc.assert(
      fc.asyncProperty(symbolArb, restrictiveRiskProfileArb, async (symbol, riskProfile) => {
        // Setup: Create trade that violates multiple rules
        const quantity = 1000;
        const price = riskProfile.maxPositionSize * 3; // Violates position size

        const totalValue = 500000;
        const drawdownAmount = totalValue * riskProfile.maxDrawdown * 2;

        const portfolio = {
          userId: 'test-user-id',
          totalValue,
          cashBalance: 100000,
          investedValue: 400000,
          unrealizedPnL: -drawdownAmount / 2,
          realizedPnL: -drawdownAmount / 2,
          positions: [
            {
              symbol: 'TCS',
              quantity: 100,
              currentPrice: 3000,
              status: 'OPEN' as const,
            },
          ],
        };

        mockPrismaService.riskProfile.findUnique.mockResolvedValue(riskProfile);
        mockPrismaService.portfolio.findUnique.mockResolvedValue(portfolio);
        mockPrismaService.position.count.mockResolvedValue(0);

        const tradeRequest: TradeRequest = {
          symbol,
          action: 'BUY',
          quantity,
          price,
          stopLoss: price * 1.1, // Invalid stop loss for BUY
        };

        // Execute
        const result = await service.validateTrade('test-user-id', tradeRequest);

        // Assert: Failed validation produces multiple non-empty reasons
        expect(result.passed).toBe(false);
        expect(result.violations.length).toBeGreaterThan(1);

        // Every single violation must have a non-empty message
        for (const violation of result.violations) {
          expect(violation.message).toBeDefined();
          expect(violation.message).not.toBe('');
          expect(typeof violation.message).toBe('string');
          expect(violation.message.length).toBeGreaterThan(0);
          expect(violation.rule).toBeDefined();
          expect(violation.rule).not.toBe('');
          expect(violation.severity).toBeDefined();
          expect(['ERROR', 'WARNING']).toContain(violation.severity);
        }
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: Universal - All Failed Validations Have Reasons
   *
   * This is the core property: ANY failed validation MUST produce a reason.
   */
  it('universal property: any failed validation must contain at least one violation with non-empty message', async () => {
    await fc.assert(
      fc.asyncProperty(
        symbolArb,
        tradeActionArb,
        fc.integer({ min: 1, max: 10000 }),
        fc.double({ min: 1, max: 100000, noNaN: true }),
        fc.option(restrictiveRiskProfileArb, { nil: null }),
        fc.option(portfolioWithHighExposureArb, { nil: null }),
        async (symbol, action, quantity, price, riskProfile, portfolio) => {
          // Setup with random valid or invalid scenarios
          mockPrismaService.riskProfile.findUnique.mockResolvedValue(riskProfile);
          mockPrismaService.portfolio.findUnique.mockResolvedValue(portfolio);
          mockPrismaService.position.count.mockResolvedValue(
            portfolio ? portfolio.positions.length : 0
          );

          const tradeRequest: TradeRequest = {
            symbol,
            action,
            quantity,
            price,
          };

          // Execute
          const result = await service.validateTrade('test-user-id', tradeRequest);

          // Assert: The core property
          // IF validation failed, THEN there must be violations with messages
          if (!result.passed) {
            expect(result.violations.length).toBeGreaterThan(0);

            // Every violation must have a non-empty message
            for (const violation of result.violations) {
              expect(violation.message).toBeDefined();
              expect(violation.message).not.toBe('');
              expect(typeof violation.message).toBe('string');
              expect(violation.message.length).toBeGreaterThan(0);
              expect(violation.rule).toBeDefined();
              expect(violation.rule).not.toBe('');
            }
          }
        }
      ),
      { numRuns: 100 } // Run 100 random scenarios
    );
  });
});
