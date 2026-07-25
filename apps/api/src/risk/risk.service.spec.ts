import { Test, TestingModule } from '@nestjs/testing';
import { RiskService, TradeRequest } from './risk.service';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import * as fc from 'fast-check';

describe('RiskService', () => {
  let service: RiskService;
  let prisma: PrismaService;

  const mockPrismaService = {
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

  const mockAuditLogService = {
    logRiskValidation: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
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
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateTrade', () => {
    const userId = 'test-user-id';
    const mockRiskProfile = {
      userId,
      maxPositionSize: 100000,
      maxDrawdown: 0.05,
      maxPortfolioExposure: 0.3,
      defaultStopLoss: 0.02,
      riskPerTrade: 0.01,
      maxOpenPositions: 10,
    };

    it('should fail validation when risk profile is missing', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(null);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].rule).toBe('RISK_PROFILE_MISSING');
      expect(result.violations[0].severity).toBe('ERROR');
    });

    it('should fail validation when position size exceeds max', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 100,
        price: 2500, // 100 * 2500 = 250,000 > 100,000
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.rule === 'MAX_POSITION_SIZE')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'MAX_POSITION_SIZE')?.severity).toBe('ERROR');
    });

    it('should fail validation for invalid stop loss on BUY order', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        stopLoss: 2600, // Stop loss should be < entry price for BUY
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.rule === 'INVALID_STOP_LOSS')).toBe(true);
    });

    it('should pass validation for valid stop loss on BUY order', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        stopLoss: 2400, // Stop loss < entry price for BUY
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(true);
      expect(result.violations.some((v) => v.rule === 'INVALID_STOP_LOSS')).toBe(false);
    });

    it('should fail validation for invalid stop loss on SELL order', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'SELL',
        quantity: 10,
        price: 2500,
        stopLoss: 2400, // Stop loss should be > entry price for SELL
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.rule === 'INVALID_STOP_LOSS')).toBe(true);
    });

    it('should pass validation for valid stop loss on SELL order', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(0);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'SELL',
        quantity: 10,
        price: 2500,
        stopLoss: 2600, // Stop loss > entry price for SELL
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(true);
      expect(result.violations.some((v) => v.rule === 'INVALID_STOP_LOSS')).toBe(false);
    });

    it('should fail validation when portfolio exposure exceeds max', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.position.count.mockResolvedValue(0);

      const mockPortfolio = {
        userId,
        totalValue: 500000,
        cashBalance: 300000,
        investedValue: 200000,
        unrealizedPnL: 0,
        realizedPnL: 0,
        positions: [
          {
            symbol: 'TCS',
            quantity: 50,
            currentPrice: 3000, // 50 * 3000 = 150,000
            status: 'OPEN',
          },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 5000, // 10 * 5000 = 50,000
        // Total exposure: 150,000 + 50,000 = 200,000
        // Exposure ratio: 200,000 / 500,000 = 0.4 = 40% > 30% max
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE')).toBe(true);
    });

    it('should pass validation when portfolio exposure is within limits', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.position.count.mockResolvedValue(0);

      const mockPortfolio = {
        userId,
        totalValue: 500000,
        cashBalance: 400000,
        investedValue: 100000,
        unrealizedPnL: 0,
        realizedPnL: 0,
        positions: [
          {
            symbol: 'TCS',
            quantity: 20,
            currentPrice: 3000, // 20 * 3000 = 60,000
            status: 'OPEN',
          },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500, // 10 * 2500 = 25,000
        // Total exposure: 60,000 + 25,000 = 85,000
        // Exposure ratio: 85,000 / 500,000 = 0.17 = 17% < 30% max
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(true);
      expect(result.violations.some((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE')).toBe(false);
    });

    it('should fail validation when max drawdown is exceeded', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.position.count.mockResolvedValue(0);

      const mockPortfolio = {
        userId,
        totalValue: 500000,
        cashBalance: 400000,
        investedValue: 100000,
        unrealizedPnL: -15000,
        realizedPnL: -15000,
        // Total PnL: -30,000
        // Drawdown: 30,000 / 500,000 = 0.06 = 6% > 5% max
        positions: [],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.rule === 'MAX_DRAWDOWN_EXCEEDED')).toBe(true);
    });

    it('should pass validation when drawdown is within limits', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.position.count.mockResolvedValue(0);

      const mockPortfolio = {
        userId,
        totalValue: 500000,
        cashBalance: 400000,
        investedValue: 100000,
        unrealizedPnL: -10000,
        realizedPnL: -5000,
        // Total PnL: -15,000
        // Drawdown: 15,000 / 500,000 = 0.03 = 3% < 5% max
        positions: [],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(true);
      expect(result.violations.some((v) => v.rule === 'MAX_DRAWDOWN_EXCEEDED')).toBe(false);
    });

    it('should pass validation when portfolio is in profit', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.position.count.mockResolvedValue(0);

      const mockPortfolio = {
        userId,
        totalValue: 500000,
        cashBalance: 400000,
        investedValue: 100000,
        unrealizedPnL: 10000,
        realizedPnL: 5000,
        // Total PnL: 15,000 (positive, no drawdown)
        positions: [],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(true);
      expect(result.violations.some((v) => v.rule === 'MAX_DRAWDOWN_EXCEEDED')).toBe(false);
    });

    it('should add warning when max open positions is reached', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);
      mockPrismaService.position.count.mockResolvedValue(10); // At max

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      // Should still pass (warning, not error)
      expect(result.passed).toBe(true);
      expect(result.violations.some((v) => v.rule === 'MAX_OPEN_POSITIONS')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'MAX_OPEN_POSITIONS')?.severity).toBe(
        'WARNING'
      );
    });

    it('should pass all validations for a valid trade', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.position.count.mockResolvedValue(3);

      const mockPortfolio = {
        userId,
        totalValue: 500000,
        cashBalance: 400000,
        investedValue: 100000,
        unrealizedPnL: 5000,
        realizedPnL: 3000,
        positions: [
          {
            symbol: 'TCS',
            quantity: 10,
            currentPrice: 3000,
            status: 'OPEN',
          },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        stopLoss: 2400,
        target: 2700,
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(true);
      expect(result.violations.filter((v) => v.severity === 'ERROR')).toHaveLength(0);
    });

    it('should accumulate multiple validation errors', async () => {
      mockPrismaService.riskProfile.findUnique.mockResolvedValue(mockRiskProfile);
      mockPrismaService.position.count.mockResolvedValue(0);

      const mockPortfolio = {
        userId,
        totalValue: 500000,
        cashBalance: 200000,
        investedValue: 300000,
        unrealizedPnL: -15000,
        realizedPnL: -20000,
        positions: [
          {
            symbol: 'TCS',
            quantity: 100,
            currentPrice: 3000,
            status: 'OPEN',
          },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 100,
        price: 5000, // Position size: 500,000 > 100,000 max
        stopLoss: 5100, // Invalid stop loss for BUY
        // Portfolio exposure: (300,000 + 500,000) / 500,000 = 1.6 = 160% > 30% max
        // Drawdown: 35,000 / 500,000 = 0.07 = 7% > 5% max
      };

      const result = await service.validateTrade(userId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(1);
      expect(result.violations.some((v) => v.rule === 'MAX_POSITION_SIZE')).toBe(true);
      expect(result.violations.some((v) => v.rule === 'INVALID_STOP_LOSS')).toBe(true);
      expect(result.violations.some((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE')).toBe(true);
      expect(result.violations.some((v) => v.rule === 'MAX_DRAWDOWN_EXCEEDED')).toBe(true);
    });
  });

  /**
   * Property-Based Tests
   *
   * **Validates: Requirements 8.1**
   */
  describe('Property 8: Risk Engine Position Size Validation', () => {
    /**
     * Property: For any trade request, if the position size (price × quantity)
     * exceeds the configured maxPositionSize, the Risk_Engine SHALL reject
     * the trade with a MAX_POSITION_SIZE violation.
     */
    it('should reject trade when position size exceeds maxPositionSize', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }), // symbol
          fc.constantFrom('BUY', 'SELL'), // action
          fc.integer({ min: 1, max: 10000 }), // quantity
          fc.double({ min: 0.01, max: 100000, noNaN: true }), // price
          fc.double({ min: 1000, max: 1000000, noNaN: true }), // maxPositionSize
          async (symbol, action, quantity, price, maxPositionSize) => {
            // Setup: Create fresh service instance for each test
            const mockMarketDataCache = {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              delete: jest.fn(),
            };

            const mockPrismaService = {
              riskProfile: {
                findUnique: jest.fn(),
              },
              portfolio: {
                findUnique: jest.fn(),
              },
              position: {
                count: jest.fn(),
              },
              marketDataCache: mockMarketDataCache,
            };

            const mockAuditLogService = {
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

            const testService = module.get<RiskService>(RiskService);
            const testPrismaService = module.get(PrismaService);

            // Setup mock risk profile with generated maxPositionSize
            const mockRiskProfile = {
              userId: 'test-user-id',
              maxPositionSize,
              maxDrawdown: 1.0, // Set to 100% to avoid drawdown violations
              maxPortfolioExposure: 1.0, // Set to 100% to avoid exposure violations
              defaultStopLoss: 0.02,
              riskPerTrade: 0.01,
              maxOpenPositions: 1000, // Set high to avoid open position warnings
            };

            // Mock no portfolio to avoid exposure and drawdown validations
            (testPrismaService.riskProfile.findUnique as jest.Mock).mockResolvedValue(
              mockRiskProfile
            );
            (testPrismaService.portfolio.findUnique as jest.Mock).mockResolvedValue(null);
            (testPrismaService.position.count as jest.Mock).mockResolvedValue(0);

            // Calculate position size
            const positionSize = price * quantity;

            // Create trade request
            const tradeRequest: TradeRequest = {
              symbol,
              action: action as 'BUY' | 'SELL',
              quantity,
              price,
            };

            // Execute
            const result = await testService.validateTrade('test-user-id', tradeRequest);

            // Verify property
            if (positionSize > maxPositionSize) {
              // Position size exceeds limit - should reject with MAX_POSITION_SIZE violation
              expect(result.passed).toBe(false);
              expect(result.violations.some((v) => v.rule === 'MAX_POSITION_SIZE')).toBe(true);

              const violation = result.violations.find((v) => v.rule === 'MAX_POSITION_SIZE');
              expect(violation).toBeDefined();
              expect(violation?.severity).toBe('ERROR');
              expect(violation?.message).toContain('Position size');
              expect(violation?.message).toContain('exceeds max');
            } else {
              // Position size within limit - should NOT have MAX_POSITION_SIZE violation
              expect(result.violations.some((v) => v.rule === 'MAX_POSITION_SIZE')).toBe(false);
            }
          }
        ),
        { numRuns: 100 } // Run 100 random test cases
      );
    });

    it('should accept trade when position size equals or is below maxPositionSize', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }), // symbol
          fc.constantFrom('BUY', 'SELL'), // action
          fc.integer({ min: 1, max: 1000 }), // quantity
          fc.double({ min: 1, max: 10000, noNaN: true }), // price
          async (symbol, action, quantity, price) => {
            // Setup: Create fresh service instance for each test
            const mockMarketDataCache = {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              delete: jest.fn(),
            };

            const mockPrismaService = {
              riskProfile: {
                findUnique: jest.fn(),
              },
              portfolio: {
                findUnique: jest.fn(),
              },
              position: {
                count: jest.fn(),
              },
              marketDataCache: mockMarketDataCache,
            };

            const mockAuditLogService = {
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

            const testService = module.get<RiskService>(RiskService);
            const testPrismaService = module.get(PrismaService);

            // Calculate position size
            const positionSize = price * quantity;

            // Set maxPositionSize to be equal to or greater than position size
            const maxPositionSize = positionSize * fc.sample(fc.double({ min: 1, max: 2 }), 1)[0];

            // Setup mock risk profile with maxPositionSize >= positionSize
            const mockRiskProfile = {
              userId: 'test-user-id',
              maxPositionSize,
              maxDrawdown: 1.0, // Set to 100% to avoid drawdown violations
              maxPortfolioExposure: 1.0, // Set to 100% to avoid exposure violations
              defaultStopLoss: 0.02,
              riskPerTrade: 0.01,
              maxOpenPositions: 1000, // Set high to avoid open position warnings
            };

            // Mock no portfolio to avoid exposure and drawdown validations
            (testPrismaService.riskProfile.findUnique as jest.Mock).mockResolvedValue(
              mockRiskProfile
            );
            (testPrismaService.portfolio.findUnique as jest.Mock).mockResolvedValue(null);
            (testPrismaService.position.count as jest.Mock).mockResolvedValue(0);

            // Create trade request
            const tradeRequest: TradeRequest = {
              symbol,
              action: action as 'BUY' | 'SELL',
              quantity,
              price,
            };

            // Execute
            const result = await testService.validateTrade('test-user-id', tradeRequest);

            // Verify property: should NOT have MAX_POSITION_SIZE violation
            expect(result.violations.some((v) => v.rule === 'MAX_POSITION_SIZE')).toBe(false);
          }
        ),
        { numRuns: 100 } // Run 100 random test cases
      );
    });

    it('should reject trade with correct violation message when position size exceeds limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }), // symbol
          fc.constantFrom('BUY', 'SELL'), // action
          fc.integer({ min: 1, max: 100 }), // quantity
          fc.double({ min: 100, max: 10000, noNaN: true }), // price
          fc.double({ min: 1, max: 5000, noNaN: true }), // maxPositionSize (likely to be exceeded)
          async (symbol, action, quantity, price, maxPositionSize) => {
            // Setup: Create fresh service instance for each test
            const mockMarketDataCache = {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              delete: jest.fn(),
            };

            const mockPrismaService = {
              riskProfile: {
                findUnique: jest.fn(),
              },
              portfolio: {
                findUnique: jest.fn(),
              },
              position: {
                count: jest.fn(),
              },
              marketDataCache: mockMarketDataCache,
            };

            const mockAuditLogService = {
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

            const testService = module.get<RiskService>(RiskService);
            const testPrismaService = module.get(PrismaService);

            // Setup mock risk profile
            const mockRiskProfile = {
              userId: 'test-user-id',
              maxPositionSize,
              maxDrawdown: 1.0,
              maxPortfolioExposure: 1.0,
              defaultStopLoss: 0.02,
              riskPerTrade: 0.01,
              maxOpenPositions: 1000,
            };

            (testPrismaService.riskProfile.findUnique as jest.Mock).mockResolvedValue(
              mockRiskProfile
            );
            (testPrismaService.portfolio.findUnique as jest.Mock).mockResolvedValue(null);
            (testPrismaService.position.count as jest.Mock).mockResolvedValue(0);

            const positionSize = price * quantity;

            const tradeRequest: TradeRequest = {
              symbol,
              action: action as 'BUY' | 'SELL',
              quantity,
              price,
            };

            // Execute
            const result = await testService.validateTrade('test-user-id', tradeRequest);

            // Verify property: violation message contains actual position size and max
            if (positionSize > maxPositionSize) {
              const violation = result.violations.find((v) => v.rule === 'MAX_POSITION_SIZE');
              expect(violation).toBeDefined();
              expect(violation?.message).toMatch(
                /Position size \d+(\.\d+)? exceeds max \d+(\.\d+)?/
              );
              expect(violation?.severity).toBe('ERROR');

              // Verify the message contains the correct position size (with tolerance for floating-point)
              const messageMatch = violation?.message.match(/Position size (\d+(\.\d+)?)/);
              if (messageMatch) {
                const reportedPositionSize = parseFloat(messageMatch[1]);
                expect(Math.abs(reportedPositionSize - positionSize)).toBeLessThan(0.01);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property-Based Tests
   *
   * **Validates: Requirements 8.3**
   */
  describe('Property 10: Portfolio Exposure Validation', () => {
    /**
     * Property: For any portfolio state, the total exposure
     * (sum of all position values / total portfolio value) SHALL not exceed
     * maxPortfolioExposure, and any trade that would violate this SHALL be rejected.
     */
    it('should reject trade when total portfolio exposure exceeds maxPortfolioExposure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }), // symbol
          fc.constantFrom('BUY', 'SELL'), // action
          fc.integer({ min: 1, max: 100 }), // quantity for new trade
          fc.double({ min: 100, max: 5000, noNaN: true }), // price for new trade
          fc.double({ min: 100000, max: 1000000, noNaN: true }), // portfolio total value
          fc.double({ min: 0.1, max: 0.9, noNaN: true }), // maxPortfolioExposure (10% to 90%)
          fc.array(
            fc.record({
              symbol: fc.string({ minLength: 1, maxLength: 20 }),
              quantity: fc.integer({ min: 1, max: 100 }),
              currentPrice: fc.double({ min: 100, max: 5000, noNaN: true }),
            }),
            { minLength: 0, maxLength: 10 }
          ), // existing positions
          async (symbol, action, quantity, price, totalValue, maxExposure, existingPositions) => {
            // Setup: Create fresh service instance for each test
            const mockPrismaService = {
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

            const mockAuditLogService = {
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

            const testService = module.get<RiskService>(RiskService);
            const testPrismaService = module.get(PrismaService);

            // Calculate current exposure from existing positions
            const currentExposure = existingPositions.reduce(
              (sum, pos) => sum + pos.currentPrice * pos.quantity,
              0
            );

            // Calculate new position size
            const newPositionSize = price * quantity;

            // Calculate total exposure
            const totalExposure = currentExposure + newPositionSize;
            const exposureRatio = totalExposure / totalValue;

            // Setup mock risk profile
            const mockRiskProfile = {
              userId: 'test-user-id',
              maxPositionSize: Number.MAX_SAFE_INTEGER, // Set very high to avoid position size violations
              maxDrawdown: 1.0, // Set to 100% to avoid drawdown violations
              maxPortfolioExposure: maxExposure,
              defaultStopLoss: 0.02,
              riskPerTrade: 0.01,
              maxOpenPositions: 1000, // Set high to avoid open position warnings
            };

            // Setup mock portfolio with existing positions
            const mockPortfolio = {
              userId: 'test-user-id',
              totalValue,
              cashBalance: totalValue - currentExposure,
              investedValue: currentExposure,
              unrealizedPnL: 0,
              realizedPnL: 0,
              positions: existingPositions.map((pos) => ({
                ...pos,
                status: 'OPEN',
              })),
            };

            (testPrismaService.riskProfile.findUnique as jest.Mock).mockResolvedValue(
              mockRiskProfile
            );
            (testPrismaService.portfolio.findUnique as jest.Mock).mockResolvedValue(mockPortfolio);
            (testPrismaService.position.count as jest.Mock).mockResolvedValue(
              existingPositions.length
            );

            // Create trade request
            const tradeRequest: TradeRequest = {
              symbol,
              action: action as 'BUY' | 'SELL',
              quantity,
              price,
            };

            // Execute
            const result = await testService.validateTrade('test-user-id', tradeRequest);

            // Verify property
            if (exposureRatio > maxExposure) {
              // Total exposure exceeds limit - should reject with MAX_PORTFOLIO_EXPOSURE violation
              expect(result.passed).toBe(false);
              expect(result.violations.some((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE')).toBe(true);

              const violation = result.violations.find((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE');
              expect(violation).toBeDefined();
              expect(violation?.severity).toBe('ERROR');
              expect(violation?.message).toContain('Total exposure');
              expect(violation?.message).toContain('exceeds max');
            } else {
              // Total exposure within limit - should NOT have MAX_PORTFOLIO_EXPOSURE violation
              expect(result.violations.some((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE')).toBe(
                false
              );
            }
          }
        ),
        { numRuns: 100 } // Run 100 random test cases
      );
    });

    it('should accept trade when portfolio exposure is within limits', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }), // symbol
          fc.constantFrom('BUY', 'SELL'), // action
          fc.integer({ min: 1, max: 50 }), // quantity for new trade (smaller to stay within limits)
          fc.double({ min: 100, max: 2000, noNaN: true }), // price for new trade
          fc.double({ min: 500000, max: 1000000, noNaN: true }), // portfolio total value (large)
          fc.double({ min: 0.3, max: 0.9, noNaN: true }), // maxPortfolioExposure (30% to 90%)
          fc.array(
            fc.record({
              symbol: fc.string({ minLength: 1, maxLength: 20 }),
              quantity: fc.integer({ min: 1, max: 20 }),
              currentPrice: fc.double({ min: 100, max: 1000, noNaN: true }),
            }),
            { minLength: 0, maxLength: 5 } // Fewer positions
          ), // existing positions
          async (symbol, action, quantity, price, totalValue, maxExposure, existingPositions) => {
            // Setup: Create fresh service instance for each test
            const mockPrismaService = {
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

            const mockAuditLogService = {
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

            const testService = module.get<RiskService>(RiskService);
            const testPrismaService = module.get(PrismaService);

            // Calculate current exposure from existing positions
            const currentExposure = existingPositions.reduce(
              (sum, pos) => sum + pos.currentPrice * pos.quantity,
              0
            );

            // Ensure current exposure is already within limits
            if (currentExposure / totalValue > maxExposure * 0.8) {
              // Skip this test case if existing exposure is too high
              return;
            }

            // Calculate new position size - ensure it stays within limits
            const remainingExposure = totalValue * maxExposure - currentExposure;
            const newPositionSize = Math.min(price * quantity, remainingExposure * 0.9);

            // Adjust quantity to fit within limits
            const adjustedQuantity = Math.max(1, Math.floor(newPositionSize / price));

            // Setup mock risk profile
            const mockRiskProfile = {
              userId: 'test-user-id',
              maxPositionSize: Number.MAX_SAFE_INTEGER, // Set very high to avoid position size violations
              maxDrawdown: 1.0, // Set to 100% to avoid drawdown violations
              maxPortfolioExposure: maxExposure,
              defaultStopLoss: 0.02,
              riskPerTrade: 0.01,
              maxOpenPositions: 1000, // Set high to avoid open position warnings
            };

            // Setup mock portfolio with existing positions
            const mockPortfolio = {
              userId: 'test-user-id',
              totalValue,
              cashBalance: totalValue - currentExposure,
              investedValue: currentExposure,
              unrealizedPnL: 0,
              realizedPnL: 0,
              positions: existingPositions.map((pos) => ({
                ...pos,
                status: 'OPEN',
              })),
            };

            (testPrismaService.riskProfile.findUnique as jest.Mock).mockResolvedValue(
              mockRiskProfile
            );
            (testPrismaService.portfolio.findUnique as jest.Mock).mockResolvedValue(mockPortfolio);
            (testPrismaService.position.count as jest.Mock).mockResolvedValue(
              existingPositions.length
            );

            // Create trade request with adjusted quantity
            const tradeRequest: TradeRequest = {
              symbol,
              action: action as 'BUY' | 'SELL',
              quantity: adjustedQuantity,
              price,
            };

            // Execute
            const result = await testService.validateTrade('test-user-id', tradeRequest);

            // Verify property: should NOT have MAX_PORTFOLIO_EXPOSURE violation
            expect(result.violations.some((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE')).toBe(false);
          }
        ),
        { numRuns: 100 } // Run 100 random test cases
      );
    });

    it('should handle edge case with no existing positions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }), // symbol
          fc.constantFrom('BUY', 'SELL'), // action
          fc.integer({ min: 1, max: 100 }), // quantity
          fc.double({ min: 100, max: 5000, noNaN: true }), // price
          fc.double({ min: 100000, max: 1000000, noNaN: true }), // portfolio total value
          fc.double({ min: 0.1, max: 0.9, noNaN: true }), // maxPortfolioExposure
          async (symbol, action, quantity, price, totalValue, maxExposure) => {
            // Setup: Create fresh service instance for each test
            const mockPrismaService = {
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

            const mockAuditLogService = {
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

            const testService = module.get<RiskService>(RiskService);
            const testPrismaService = module.get(PrismaService);

            // Calculate new position size (no existing positions)
            const newPositionSize = price * quantity;
            const exposureRatio = newPositionSize / totalValue;

            // Setup mock risk profile
            const mockRiskProfile = {
              userId: 'test-user-id',
              maxPositionSize: Number.MAX_SAFE_INTEGER,
              maxDrawdown: 1.0,
              maxPortfolioExposure: maxExposure,
              defaultStopLoss: 0.02,
              riskPerTrade: 0.01,
              maxOpenPositions: 1000,
            };

            // Setup mock portfolio with NO existing positions
            const mockPortfolio = {
              userId: 'test-user-id',
              totalValue,
              cashBalance: totalValue,
              investedValue: 0,
              unrealizedPnL: 0,
              realizedPnL: 0,
              positions: [], // No existing positions
            };

            (testPrismaService.riskProfile.findUnique as jest.Mock).mockResolvedValue(
              mockRiskProfile
            );
            (testPrismaService.portfolio.findUnique as jest.Mock).mockResolvedValue(mockPortfolio);
            (testPrismaService.position.count as jest.Mock).mockResolvedValue(0);

            // Create trade request
            const tradeRequest: TradeRequest = {
              symbol,
              action: action as 'BUY' | 'SELL',
              quantity,
              price,
            };

            // Execute
            const result = await testService.validateTrade('test-user-id', tradeRequest);

            // Verify property
            if (exposureRatio > maxExposure) {
              // Exposure exceeds limit - should reject
              expect(result.passed).toBe(false);
              expect(result.violations.some((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE')).toBe(true);
            } else {
              // Exposure within limit - should NOT have MAX_PORTFOLIO_EXPOSURE violation
              expect(result.violations.some((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE')).toBe(
                false
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate exposure ratio correctly with multiple positions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }), // symbol
          fc.constantFrom('BUY', 'SELL'), // action
          fc.integer({ min: 1, max: 50 }), // quantity
          fc.double({ min: 100, max: 3000, noNaN: true }), // price
          fc.double({ min: 500000, max: 1000000, noNaN: true }), // portfolio total value
          fc.double({ min: 0.2, max: 0.8, noNaN: true }), // maxPortfolioExposure
          fc.integer({ min: 2, max: 5 }), // number of existing positions
          async (symbol, action, quantity, price, totalValue, maxExposure, numPositions) => {
            // Setup: Create fresh service instance for each test
            const mockPrismaService = {
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

            const mockAuditLogService = {
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

            const testService = module.get<RiskService>(RiskService);
            const testPrismaService = module.get(PrismaService);

            // Generate consistent existing positions
            const existingPositions = Array.from({ length: numPositions }, (_, i) => ({
              symbol: `STOCK${i}`,
              quantity: 10 + i * 5,
              currentPrice: 1000 + i * 100,
              status: 'OPEN',
            }));

            // Calculate current exposure
            const currentExposure = existingPositions.reduce(
              (sum, pos) => sum + pos.currentPrice * pos.quantity,
              0
            );

            // Calculate new position size
            const newPositionSize = price * quantity;

            // Calculate total exposure and ratio
            const totalExposure = currentExposure + newPositionSize;
            const exposureRatio = totalExposure / totalValue;

            // Setup mock risk profile
            const mockRiskProfile = {
              userId: 'test-user-id',
              maxPositionSize: Number.MAX_SAFE_INTEGER,
              maxDrawdown: 1.0,
              maxPortfolioExposure: maxExposure,
              defaultStopLoss: 0.02,
              riskPerTrade: 0.01,
              maxOpenPositions: 1000,
            };

            // Setup mock portfolio
            const mockPortfolio = {
              userId: 'test-user-id',
              totalValue,
              cashBalance: totalValue - currentExposure,
              investedValue: currentExposure,
              unrealizedPnL: 0,
              realizedPnL: 0,
              positions: existingPositions,
            };

            (testPrismaService.riskProfile.findUnique as jest.Mock).mockResolvedValue(
              mockRiskProfile
            );
            (testPrismaService.portfolio.findUnique as jest.Mock).mockResolvedValue(mockPortfolio);
            (testPrismaService.position.count as jest.Mock).mockResolvedValue(numPositions);

            // Create trade request
            const tradeRequest: TradeRequest = {
              symbol,
              action: action as 'BUY' | 'SELL',
              quantity,
              price,
            };

            // Execute
            const result = await testService.validateTrade('test-user-id', tradeRequest);

            // Verify property: the service calculates exposure correctly
            if (exposureRatio > maxExposure) {
              expect(result.violations.some((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE')).toBe(true);

              const violation = result.violations.find((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE');
              // Verify the violation message contains the calculated exposure ratio
              expect(violation?.message).toMatch(/Total exposure \d+(\.\d+)?% exceeds max/);
            } else {
              expect(result.violations.some((v) => v.rule === 'MAX_PORTFOLIO_EXPOSURE')).toBe(
                false
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
