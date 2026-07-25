import { Test, TestingModule } from '@nestjs/testing';
import { RiskService, TradeRequest } from './risk.service';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit.service';

/**
 * Task 71.1: Unit tests for options-specific risk validation
 * Requirements: 8.1, 8.3
 */
describe('RiskService - Options Risk Validation (Task 71.1)', () => {
  let service: RiskService;
  let prismaService: PrismaService;
  let auditLogService: AuditLogService;

  const mockUserId = 'test-user-123';
  const mockRiskProfile = {
    id: 'risk-profile-123',
    userId: mockUserId,
    maxPositionSize: 100000,
    maxDrawdown: 0.05,
    maxPortfolioExposure: 0.3,
    defaultStopLoss: 0.02,
    riskPerTrade: 0.01,
    maxOpenPositions: 10,
    maxOptionsExposure: 0.2, // Task 71.1: 20% options exposure limit
    maxOptionsPositionSize: 40000, // 40% of stock max
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPortfolio = {
    id: 'portfolio-123',
    userId: mockUserId,
    totalValue: 500000,
    cashBalance: 200000,
    investedValue: 300000,
    unrealizedPnL: 0,
    realizedPnL: 0,
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskService,
        {
          provide: PrismaService,
          useValue: {
            riskProfile: {
              findUnique: jest.fn(),
            },
            portfolio: {
              findUnique: jest.fn(),
            },
            position: {
              count: jest.fn(),
              findMany: jest.fn(),
            },
            instrument: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            logRiskValidation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RiskService>(RiskService);
    prismaService = module.get<PrismaService>(PrismaService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  describe('Options Exposure Validation', () => {
    it('should reject trade when total options exposure exceeds 20% limit', async () => {
      // Setup: Portfolio with 18% options exposure already
      const currentOptionsExposure = 90000; // 18% of 500000
      const newPositionSize = 20000; // Would make total 22%

      jest.spyOn(prismaService.riskProfile, 'findUnique').mockResolvedValue(mockRiskProfile as any);
      jest.spyOn(prismaService.portfolio, 'findUnique').mockResolvedValue({
        ...mockPortfolio,
        positions: [],
      } as any);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([
        {
          id: '1',
          symbol: 'NIFTY24JAN21500CE',
          quantity: 50,
          currentPrice: 1800,
          status: 'OPEN',
        },
      ] as any);
      jest.spyOn(prismaService.instrument, 'findMany').mockResolvedValue([
        { symbol: 'NIFTY24JAN21500CE' },
      ] as any);
      jest.spyOn(prismaService.position, 'count').mockResolvedValue(5);

      const tradeRequest: TradeRequest = {
        symbol: 'NIFTY24JAN22000CE',
        action: 'BUY',
        quantity: 100,
        price: 200, // 100 * 200 = 20000
        assetType: 'OPTION_CALL',
      };

      const result = await service.validateTrade(mockUserId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'MAX_OPTIONS_EXPOSURE',
          severity: 'ERROR',
        })
      );
    });

    it('should pass when options exposure is within 20% limit', async () => {
      jest.spyOn(prismaService.riskProfile, 'findUnique').mockResolvedValue(mockRiskProfile as any);
      jest.spyOn(prismaService.portfolio, 'findUnique').mockResolvedValue({
        ...mockPortfolio,
        positions: [],
      } as any);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.instrument, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.position, 'count').mockResolvedValue(5);

      const tradeRequest: TradeRequest = {
        symbol: 'NIFTY24JAN21500CE',
        action: 'BUY',
        quantity: 50,
        price: 500, // 50 * 500 = 25000 = 5% of portfolio (within 20%)
        assetType: 'OPTION_CALL',
        bidAskSpread: 5, // 1% spread
        openInterest: 1000, // Good liquidity
      };

      const result = await service.validateTrade(mockUserId, tradeRequest);

      expect(result.passed).toBe(true);
    });
  });

  describe('Options Position Size Validation', () => {
    it('should reject options position larger than 40% of stock max', async () => {
      jest.spyOn(prismaService.riskProfile, 'findUnique').mockResolvedValue(mockRiskProfile as any);
      jest.spyOn(prismaService.portfolio, 'findUnique').mockResolvedValue({
        ...mockPortfolio,
        positions: [],
      } as any);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.instrument, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.position, 'count').mockResolvedValue(5);

      const tradeRequest: TradeRequest = {
        symbol: 'NIFTY24JAN22000CE',
        action: 'BUY',
        quantity: 300,
        price: 150, // 300 * 150 = 45000 > 40000
        assetType: 'OPTION_CALL',
      };

      const result = await service.validateTrade(mockUserId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'OPTIONS_POSITION_TOO_LARGE',
          severity: 'ERROR',
        })
      );
    });
  });

  describe('Options Liquidity Validation', () => {
    it('should reject illiquid options with wide bid-ask spread (>5%)', async () => {
      jest.spyOn(prismaService.riskProfile, 'findUnique').mockResolvedValue(mockRiskProfile as any);
      jest.spyOn(prismaService.portfolio, 'findUnique').mockResolvedValue({
        ...mockPortfolio,
        positions: [],
      } as any);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.instrument, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.position, 'count').mockResolvedValue(5);

      const tradeRequest: TradeRequest = {
        symbol: 'NIFTY24JAN22000CE',
        action: 'BUY',
        quantity: 50,
        price: 100,
        assetType: 'OPTION_CALL',
        bidAskSpread: 8, // 8% spread - too wide
        openInterest: 200,
      };

      const result = await service.validateTrade(mockUserId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'OPTIONS_ILLIQUID_SPREAD',
          severity: 'ERROR',
        })
      );
    });

    it('should reject options with very low open interest (<100)', async () => {
      jest.spyOn(prismaService.riskProfile, 'findUnique').mockResolvedValue(mockRiskProfile as any);
      jest.spyOn(prismaService.portfolio, 'findUnique').mockResolvedValue({
        ...mockPortfolio,
        positions: [],
      } as any);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.instrument, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.position, 'count').mockResolvedValue(5);

      const tradeRequest: TradeRequest = {
        symbol: 'NIFTY24JAN22000CE',
        action: 'BUY',
        quantity: 50,
        price: 100,
        assetType: 'OPTION_CALL',
        bidAskSpread: 2, // 2% spread - OK
        openInterest: 50, // Too low
      };

      const result = await service.validateTrade(mockUserId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'OPTIONS_LOW_OPEN_INTEREST',
          severity: 'ERROR',
        })
      );
    });

    it('should warn when open interest is moderate (100-500)', async () => {
      jest.spyOn(prismaService.riskProfile, 'findUnique').mockResolvedValue(mockRiskProfile as any);
      jest.spyOn(prismaService.portfolio, 'findUnique').mockResolvedValue({
        ...mockPortfolio,
        positions: [],
      } as any);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.instrument, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.position, 'count').mockResolvedValue(5);

      const tradeRequest: TradeRequest = {
        symbol: 'NIFTY24JAN21500CE',
        action: 'BUY',
        quantity: 50,
        price: 400, // 50 * 400 = 20000 (well within position size)
        assetType: 'OPTION_CALL',
        bidAskSpread: 10, // 2.5% spread (within 5%)
        openInterest: 300, // Moderate
      };

      const result = await service.validateTrade(mockUserId, tradeRequest);

      expect(result.passed).toBe(true); // Should pass but with warnings
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'OPTIONS_MODERATE_OPEN_INTEREST',
          severity: 'WARNING',
        })
      );
    });
  });

  describe('Options Margin Validation', () => {
    it('should reject trade when insufficient margin available', async () => {
      const lowCashPortfolio = {
        ...mockPortfolio,
        cashBalance: 10000, // Only 10k available
      };

      jest.spyOn(prismaService.riskProfile, 'findUnique').mockResolvedValue(mockRiskProfile as any);
      jest.spyOn(prismaService.portfolio, 'findUnique').mockResolvedValue({
        ...lowCashPortfolio,
        positions: [],
      } as any);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.instrument, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.position, 'count').mockResolvedValue(5);

      const tradeRequest: TradeRequest = {
        symbol: 'NIFTY24JAN21500CE',
        action: 'BUY',
        quantity: 100,
        price: 500, // 50000 position, needs 20000 margin (40%)
        assetType: 'OPTION_CALL',
        bidAskSpread: 10,
        openInterest: 1000,
      };

      const result = await service.validateTrade(mockUserId, tradeRequest);

      expect(result.passed).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'INSUFFICIENT_MARGIN',
          severity: 'ERROR',
        })
      );
    });

    it('should warn when margin buffer is low', async () => {
      const lowCashPortfolio = {
        ...mockPortfolio,
        cashBalance: 11000, // Just above margin requirement but low buffer
      };

      jest.spyOn(prismaService.riskProfile, 'findUnique').mockResolvedValue(mockRiskProfile as any);
      jest.spyOn(prismaService.portfolio, 'findUnique').mockResolvedValue({
        ...lowCashPortfolio,
        positions: [],
      } as any);
      jest.spyOn(prismaService.position, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.instrument, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.position, 'count').mockResolvedValue(5);

      const tradeRequest: TradeRequest = {
        symbol: 'NIFTY24JAN21500CE',
        action: 'BUY',
        quantity: 50,
        price: 400, // 20000 position, needs 8000 margin (40%). We have 11000 which is less than 1.5 * 8000 = 12000
        assetType: 'OPTION_CALL',
        bidAskSpread: 10,
        openInterest: 1000,
      };

      const result = await service.validateTrade(mockUserId, tradeRequest);

      expect(result.passed).toBe(true);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'LOW_MARGIN_BUFFER',
          severity: 'WARNING',
        })
      );
    });
  });

  describe('Stock trades (non-options) should not trigger options validation', () => {
    it('should not apply options rules to stock trades', async () => {
      jest.spyOn(prismaService.riskProfile, 'findUnique').mockResolvedValue(mockRiskProfile as any);
      jest.spyOn(prismaService.portfolio, 'findUnique').mockResolvedValue({
        ...mockPortfolio,
        positions: [],
      } as any);
      jest.spyOn(prismaService.position, 'count').mockResolvedValue(5);

      const tradeRequest: TradeRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 100,
        price: 2500,
        assetType: 'STOCK', // Stock, not options
      };

      const result = await service.validateTrade(mockUserId, tradeRequest);

      // Should not have any options-specific violations
      const optionsViolations = result.violations.filter((v) =>
        v.rule.includes('OPTIONS')
      );
      expect(optionsViolations).toHaveLength(0);
    });
  });
});
