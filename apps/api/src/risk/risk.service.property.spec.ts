import { Test, TestingModule } from '@nestjs/testing';
import { RiskService, TradeRequest } from './risk.service';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import * as fc from 'fast-check';
import { it } from '@fast-check/jest';

/**
 * Property-Based Tests for RiskService - Stop Loss Placement Validation
 *
 * **Validates: Requirements 8.2**
 *
 * Property 9: Stop Loss Placement Validation
 *
 * For any trade request with a stop loss:
 * - If stopLoss >= entryPrice for BUY orders, the Risk_Engine SHALL reject the trade
 * - If stopLoss <= entryPrice for SELL orders, the Risk_Engine SHALL reject the trade
 */
describe('RiskService - Property 9: Stop Loss Placement Validation', () => {
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

  const userId = 'test-user-id';
  const mockRiskProfile = {
    userId,
    maxPositionSize: Number.MAX_SAFE_INTEGER, // Very large to not interfere with this test
    maxDrawdown: 1, // 100% to not interfere
    maxPortfolioExposure: 1, // 100% to not interfere
    defaultStopLoss: 0.02,
    riskPerTrade: 0.01,
    maxOpenPositions: 1000, // Very large to not interfere
  };

  /**
   * Arbitrary generators
   */
  const symbolArb = fc.string({ minLength: 1, maxLength: 20 });
  const quantityArb = fc.integer({ min: 1, max: 1000 });
  const entryPriceArb = fc.double({ min: 0.01, max: 100000, noNaN: true });

  /**
   * Property Test: Invalid Stop Loss for BUY Orders (stopLoss >= entryPrice)
   *
   * For BUY orders, stop loss must be strictly less than entry price.
   * Any stopLoss >= entryPrice should result in rejection.
   */
  it.prop([symbolArb, quantityArb, entryPriceArb, fc.double({ min: 0, max: 1 })])(
    'should reject BUY orders when stopLoss >= entryPrice',
    async (symbol: string, quantity: number, entryPrice: number, stopLossOffset: number) => {
      // Setup mocks to ensure other validations don't interfere
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      // Generate invalid stop loss: stopLoss >= entryPrice for BUY
      const stopLoss = entryPrice + Math.abs(stopLossOffset * entryPrice);

      const tradeRequest: TradeRequest = {
        symbol,
        action: 'BUY',
        quantity,
        price: entryPrice,
        stopLoss,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      // The trade should fail validation
      expect(result.passed).toBe(false);

      // Should contain INVALID_STOP_LOSS violation
      const stopLossViolation = result.violations.find((v) => v.rule === 'INVALID_STOP_LOSS');
      expect(stopLossViolation).toBeDefined();
      expect(stopLossViolation?.severity).toBe('ERROR');
      expect(stopLossViolation?.message).toContain('BUY');
    }
  );

  /**
   * Property Test: Invalid Stop Loss for SELL Orders (stopLoss <= entryPrice)
   *
   * For SELL orders, stop loss must be strictly greater than entry price.
   * Any stopLoss <= entryPrice should result in rejection.
   */
  it.prop([symbolArb, quantityArb, entryPriceArb, fc.double({ min: 0, max: 1 })])(
    'should reject SELL orders when stopLoss <= entryPrice',
    async (symbol: string, quantity: number, entryPrice: number, stopLossOffset: number) => {
      // Setup mocks to ensure other validations don't interfere
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      // Generate invalid stop loss: stopLoss <= entryPrice for SELL
      const stopLoss = entryPrice - Math.abs(stopLossOffset * entryPrice);

      const tradeRequest: TradeRequest = {
        symbol,
        action: 'SELL',
        quantity,
        price: entryPrice,
        stopLoss,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      // The trade should fail validation
      expect(result.passed).toBe(false);

      // Should contain INVALID_STOP_LOSS violation
      const stopLossViolation = result.violations.find((v) => v.rule === 'INVALID_STOP_LOSS');
      expect(stopLossViolation).toBeDefined();
      expect(stopLossViolation?.severity).toBe('ERROR');
      expect(stopLossViolation?.message).toContain('SELL');
    }
  );

  /**
   * Property Test: Valid Stop Loss for BUY Orders (stopLoss < entryPrice)
   *
   * For BUY orders, stop loss less than entry price should be accepted.
   */
  it.prop([
    symbolArb,
    quantityArb,
    fc.double({ min: 1, max: 100000, noNaN: true }),
    fc.double({ min: 0.01, max: 0.99, noNaN: true }),
  ])(
    'should accept BUY orders when stopLoss < entryPrice',
    async (symbol: string, quantity: number, entryPrice: number, stopLossRatio: number) => {
      // Setup mocks to ensure other validations don't interfere
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      // Generate valid stop loss: stopLoss < entryPrice for BUY
      const stopLoss = entryPrice * stopLossRatio;

      // Skip test if we ended up with NaN or invalid values
      if (isNaN(stopLoss) || !isFinite(stopLoss) || stopLoss <= 0) {
        return;
      }

      const tradeRequest: TradeRequest = {
        symbol,
        action: 'BUY',
        quantity,
        price: entryPrice,
        stopLoss,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      // Should NOT contain INVALID_STOP_LOSS violation
      const stopLossViolation = result.violations.find((v) => v.rule === 'INVALID_STOP_LOSS');
      expect(stopLossViolation).toBeUndefined();
    }
  );

  /**
   * Property Test: Valid Stop Loss for SELL Orders (stopLoss > entryPrice)
   *
   * For SELL orders, stop loss greater than entry price should be accepted.
   */
  it.prop([symbolArb, quantityArb, entryPriceArb, fc.double({ min: 0.01, max: 1, noNaN: true })])(
    'should accept SELL orders when stopLoss > entryPrice',
    async (symbol: string, quantity: number, entryPrice: number, stopLossMultiplier: number) => {
      // Setup mocks to ensure other validations don't interfere
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      // Generate valid stop loss: stopLoss > entryPrice for SELL
      const stopLoss = entryPrice * (1 + stopLossMultiplier);

      // Skip test if we ended up with NaN or invalid values
      if (isNaN(stopLoss) || !isFinite(stopLoss) || stopLoss <= 0) {
        return;
      }

      const tradeRequest: TradeRequest = {
        symbol,
        action: 'SELL',
        quantity,
        price: entryPrice,
        stopLoss,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      // Should NOT contain INVALID_STOP_LOSS violation
      const stopLossViolation = result.violations.find((v) => v.rule === 'INVALID_STOP_LOSS');
      expect(stopLossViolation).toBeUndefined();
    }
  );

  /**
   * Property Test: Edge Case - Stop Loss Equal to Entry Price for BUY
   *
   * stopLoss === entryPrice should be rejected for BUY orders.
   */
  it.prop([symbolArb, quantityArb, entryPriceArb])(
    'should reject BUY orders when stopLoss exactly equals entryPrice',
    async (symbol: string, quantity: number, entryPrice: number) => {
      // Setup mocks to ensure other validations don't interfere
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      // Edge case: stopLoss === entryPrice for BUY (should be rejected)
      const tradeRequest: TradeRequest = {
        symbol,
        action: 'BUY',
        quantity,
        price: entryPrice,
        stopLoss: entryPrice,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      // The trade should fail validation
      expect(result.passed).toBe(false);

      // Should contain INVALID_STOP_LOSS violation
      const stopLossViolation = result.violations.find((v) => v.rule === 'INVALID_STOP_LOSS');
      expect(stopLossViolation).toBeDefined();
      expect(stopLossViolation?.severity).toBe('ERROR');
    }
  );

  /**
   * Property Test: Edge Case - Stop Loss Equal to Entry Price for SELL
   *
   * stopLoss === entryPrice should be rejected for SELL orders.
   */
  it.prop([symbolArb, quantityArb, entryPriceArb])(
    'should reject SELL orders when stopLoss exactly equals entryPrice',
    async (symbol: string, quantity: number, entryPrice: number) => {
      // Setup mocks to ensure other validations don't interfere
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      // Edge case: stopLoss === entryPrice for SELL (should be rejected)
      const tradeRequest: TradeRequest = {
        symbol,
        action: 'SELL',
        quantity,
        price: entryPrice,
        stopLoss: entryPrice,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      // The trade should fail validation
      expect(result.passed).toBe(false);

      // Should contain INVALID_STOP_LOSS violation
      const stopLossViolation = result.violations.find((v) => v.rule === 'INVALID_STOP_LOSS');
      expect(stopLossViolation).toBeDefined();
      expect(stopLossViolation?.severity).toBe('ERROR');
    }
  );

  /**
   * Property Test: Universal Property - Stop Loss Validation Consistency
   *
   * For ANY trade with stop loss, the validation result must be consistent
   * with the mathematical relationship between stop loss and entry price.
   */
  it.prop([
    symbolArb,
    quantityArb,
    entryPriceArb,
    fc.constantFrom('BUY' as const, 'SELL' as const),
    fc.double({ min: 0.01, max: 200000, noNaN: true }),
  ])(
    'universal: stop loss validation is consistent with entry price relationship',
    async (
      symbol: string,
      quantity: number,
      entryPrice: number,
      action: 'BUY' | 'SELL',
      stopLoss: number
    ) => {
      // Setup mocks to ensure other validations don't interfere
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      const tradeRequest: TradeRequest = {
        symbol,
        action,
        quantity,
        price: entryPrice,
        stopLoss,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      // Calculate if stop loss is valid
      const isValidStopLoss = action === 'BUY' ? stopLoss < entryPrice : stopLoss > entryPrice;

      // Check consistency
      const stopLossViolation = result.violations.find((v) => v.rule === 'INVALID_STOP_LOSS');

      if (isValidStopLoss) {
        // Valid stop loss should NOT produce INVALID_STOP_LOSS violation
        expect(stopLossViolation).toBeUndefined();
      } else {
        // Invalid stop loss MUST produce INVALID_STOP_LOSS violation
        expect(stopLossViolation).toBeDefined();
        expect(stopLossViolation?.severity).toBe('ERROR');
        expect(result.passed).toBe(false);
      }
    }
  );
});
