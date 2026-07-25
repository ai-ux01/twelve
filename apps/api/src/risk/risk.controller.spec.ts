import { Test, TestingModule } from '@nestjs/testing';
import { RiskController } from './risk.controller';
import { RiskService, RiskValidationResult } from './risk.service';

describe('RiskController', () => {
  let controller: RiskController;

  const mockRiskService = {
    validateTrade: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RiskController],
      providers: [
        {
          provide: RiskService,
          useValue: mockRiskService,
        },
      ],
    }).compile();

    controller = module.get<RiskController>(RiskController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /risk/validate', () => {
    it('should validate trade and return result', async () => {
      const dto = {
        userId: 'test-user-id',
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2500,
        stopLoss: 2400,
        target: 2700,
      };

      const expectedResult: RiskValidationResult = {
        passed: true,
        violations: [],
      };

      mockRiskService.validateTrade.mockResolvedValue(expectedResult);

      const result = await controller.validateTrade(dto);

      expect(result).toEqual(expectedResult);
      expect(mockRiskService.validateTrade).toHaveBeenCalledWith('test-user-id', {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        stopLoss: 2400,
        target: 2700,
      });
    });

    it('should validate trade without optional fields', async () => {
      const dto = {
        userId: 'test-user-id',
        symbol: 'TCS',
        action: 'SELL' as const,
        quantity: 5,
        price: 3500,
      };

      const expectedResult: RiskValidationResult = {
        passed: true,
        violations: [],
      };

      mockRiskService.validateTrade.mockResolvedValue(expectedResult);

      const result = await controller.validateTrade(dto);

      expect(result).toEqual(expectedResult);
      expect(mockRiskService.validateTrade).toHaveBeenCalledWith('test-user-id', {
        symbol: 'TCS',
        action: 'SELL',
        quantity: 5,
        price: 3500,
        stopLoss: undefined,
        target: undefined,
      });
    });

    it('should return validation failures when trade fails validation', async () => {
      const dto = {
        userId: 'test-user-id',
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 100,
        price: 5000,
      };

      const expectedResult: RiskValidationResult = {
        passed: false,
        violations: [
          {
            rule: 'MAX_POSITION_SIZE',
            message: 'Position size 500000.00 exceeds max 100000.00',
            severity: 'ERROR',
          },
        ],
      };

      mockRiskService.validateTrade.mockResolvedValue(expectedResult);

      const result = await controller.validateTrade(dto);

      expect(result).toEqual(expectedResult);
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].rule).toBe('MAX_POSITION_SIZE');
    });

    it('should handle invalid stop loss validation', async () => {
      const dto = {
        userId: 'test-user-id',
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2500,
        stopLoss: 2600, // Invalid: stop loss > entry price for BUY
      };

      const expectedResult: RiskValidationResult = {
        passed: false,
        violations: [
          {
            rule: 'INVALID_STOP_LOSS',
            message: 'Stop loss 2600 is invalid for BUY at 2500',
            severity: 'ERROR',
          },
        ],
      };

      mockRiskService.validateTrade.mockResolvedValue(expectedResult);

      const result = await controller.validateTrade(dto);

      expect(result).toEqual(expectedResult);
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].rule).toBe('INVALID_STOP_LOSS');
    });

    it('should handle multiple validation violations', async () => {
      const dto = {
        userId: 'test-user-id',
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 100,
        price: 5000,
        stopLoss: 5100,
      };

      const expectedResult: RiskValidationResult = {
        passed: false,
        violations: [
          {
            rule: 'MAX_POSITION_SIZE',
            message: 'Position size 500000.00 exceeds max 100000.00',
            severity: 'ERROR',
          },
          {
            rule: 'INVALID_STOP_LOSS',
            message: 'Stop loss 5100 is invalid for BUY at 5000',
            severity: 'ERROR',
          },
          {
            rule: 'MAX_PORTFOLIO_EXPOSURE',
            message: 'Total exposure 120.00% exceeds max 30.00%',
            severity: 'ERROR',
          },
        ],
      };

      mockRiskService.validateTrade.mockResolvedValue(expectedResult);

      const result = await controller.validateTrade(dto);

      expect(result).toEqual(expectedResult);
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(1);
    });

    it('should handle warnings without failing validation', async () => {
      const dto = {
        userId: 'test-user-id',
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        price: 2500,
      };

      const expectedResult: RiskValidationResult = {
        passed: true, // Still passes with warnings
        violations: [
          {
            rule: 'MAX_OPEN_POSITIONS',
            message: 'Already at max open positions (10)',
            severity: 'WARNING',
          },
        ],
      };

      mockRiskService.validateTrade.mockResolvedValue(expectedResult);

      const result = await controller.validateTrade(dto);

      expect(result).toEqual(expectedResult);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('WARNING');
    });

    it('should transform DTO to TradeRequest correctly', async () => {
      const dto = {
        userId: 'user-123',
        symbol: 'NIFTY_50',
        action: 'SELL' as const,
        quantity: 50,
        price: 21500.75,
        stopLoss: 21600.25,
        target: 21400.5,
      };

      mockRiskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      await controller.validateTrade(dto);

      expect(mockRiskService.validateTrade).toHaveBeenCalledWith('user-123', {
        symbol: 'NIFTY_50',
        action: 'SELL',
        quantity: 50,
        price: 21500.75,
        stopLoss: 21600.25,
        target: 21400.5,
      });
    });
  });
});
