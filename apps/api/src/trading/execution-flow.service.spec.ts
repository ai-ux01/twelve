import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionFlowService,
  ExecutionDecision,
  TradeRecommendation,
} from './execution-flow.service';
import { PrismaService } from '../database/prisma.service';
import { RiskService } from '../risk/risk.service';
import { PaperTradingService } from './paper-trading.service';
import { AuditLogService } from '../audit/audit.service';

describe('ExecutionFlowService', () => {
  let service: ExecutionFlowService;
  let riskService: RiskService;
  let paperTradingService: PaperTradingService;
  let auditLogService: AuditLogService;

  const mockPrismaService = {};

  const mockRiskService = {
    validateTrade: jest.fn(),
  };

  const mockPaperTradingService = {
    executePaperTrade: jest.fn(),
  };

  const mockAuditLogService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionFlowService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RiskService,
          useValue: mockRiskService,
        },
        {
          provide: PaperTradingService,
          useValue: mockPaperTradingService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<ExecutionFlowService>(ExecutionFlowService);
    riskService = module.get<RiskService>(RiskService);
    paperTradingService = module.get<PaperTradingService>(PaperTradingService);
    auditLogService = module.get<AuditLogService>(AuditLogService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('NO_TRADE Logic', () => {
    it('should BLOCK execution when signal is NO_TRADE', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'NO_TRADE',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      const result = await service.evaluateExecutionFlow('user-123', recommendation);

      expect(result.decision).toBe(ExecutionDecision.BLOCK);
      expect(result.paperTradingAllowed).toBe(false);
      expect(result.liveTradingAllowed).toBe(false);
      expect(result.reason).toContain('NO_TRADE');
      expect(result.safetyChecks.noTradeCheck.passed).toBe(false);
    });

    it('should BLOCK execution when signal is HOLD', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'HOLD',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      const result = await service.evaluateExecutionFlow('user-123', recommendation);

      expect(result.decision).toBe(ExecutionDecision.BLOCK);
      expect(result.paperTradingAllowed).toBe(false);
      expect(result.liveTradingAllowed).toBe(false);
      expect(result.reason).toContain('HOLD');
    });

    it('should BLOCK execution when score is below minimum threshold', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.7,
        score: 50, // Below 60 threshold
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      const result = await service.evaluateExecutionFlow('user-123', recommendation);

      expect(result.decision).toBe(ExecutionDecision.BLOCK);
      expect(result.paperTradingAllowed).toBe(false);
      expect(result.liveTradingAllowed).toBe(false);
      expect(result.reason).toContain('Score');
      expect(result.reason).toContain('50');
      expect(result.reason).toContain('60');
    });

    it('should BLOCK execution when risk/reward ratio is below minimum', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2450,
        target: 2550, // R:R = 1.0 (below 2.0 threshold)
        quantity: 10,
        riskRewardRatio: 1.0,
      };

      const result = await service.evaluateExecutionFlow('user-123', recommendation);

      expect(result.decision).toBe(ExecutionDecision.BLOCK);
      expect(result.paperTradingAllowed).toBe(false);
      expect(result.liveTradingAllowed).toBe(false);
      expect(result.reason).toContain('Risk/Reward');
      expect(result.reason).toContain('1.00');
      expect(result.reason).toContain('2');
    });

    it('should BLOCK execution when stop loss is invalid for BUY trade', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2550, // Stop loss above entry for BUY - invalid
        target: 2600,
        quantity: 10,
      };

      const result = await service.evaluateExecutionFlow('user-123', recommendation);

      expect(result.decision).toBe(ExecutionDecision.BLOCK);
      expect(result.reason).toContain('stop loss must be below entry');
    });

    it('should BLOCK execution when target is invalid for BUY trade', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2450,
        target: 2400, // Target below entry for BUY - invalid
        quantity: 10,
      };

      const result = await service.evaluateExecutionFlow('user-123', recommendation);

      expect(result.decision).toBe(ExecutionDecision.BLOCK);
      expect(result.reason).toContain('target must be above entry');
    });
  });

  describe('Confidence Level Checks', () => {
    beforeEach(() => {
      // Mock risk validation to pass for these tests
      mockRiskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });
    });

    it('should BLOCK execution when confidence is below 0.6', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.5, // 50% - below minimum
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      const result = await service.evaluateExecutionFlow('user-123', recommendation);

      expect(result.decision).toBe(ExecutionDecision.BLOCK);
      expect(result.paperTradingAllowed).toBe(false);
      expect(result.liveTradingAllowed).toBe(false);
      expect(result.reason).toContain('Confidence too low');
      expect(result.reason).toContain('50%');
      expect(result.reason).toContain('60%');
    });

    it('should allow PAPER_ONLY when confidence is 0.6-0.8', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.7, // 70% - medium confidence
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      const result = await service.evaluateExecutionFlow('user-123', recommendation);

      expect(result.decision).toBe(ExecutionDecision.PAPER_ONLY);
      expect(result.paperTradingAllowed).toBe(true);
      expect(result.liveTradingAllowed).toBe(false);
      expect(result.reason).toContain('Medium confidence');
      expect(result.reason).toContain('70%');
    });

    it('should allow ALLOW_REAL when confidence is above 0.8', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.85, // 85% - high confidence
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      const result = await service.evaluateExecutionFlow('user-123', recommendation);

      expect(result.decision).toBe(ExecutionDecision.ALLOW_REAL);
      expect(result.paperTradingAllowed).toBe(true);
      expect(result.liveTradingAllowed).toBe(true);
      expect(result.reason).toContain('High confidence');
      expect(result.reason).toContain('85%');
    });

    it('should BLOCK execution when confidence is 0 (no confidence provided)', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: undefined, // No confidence - defaults to 0
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      const result = await service.evaluateExecutionFlow('user-123', recommendation);

      expect(result.decision).toBe(ExecutionDecision.BLOCK);
      expect(result.paperTradingAllowed).toBe(false);
      expect(result.liveTradingAllowed).toBe(false);
    });
  });

  describe('Risk Validation Integration', () => {
    it('should BLOCK execution when risk validation fails', async () => {
      // Mock risk validation to fail
      mockRiskService.validateTrade.mockResolvedValue({
        passed: false,
        violations: [
          {
            rule: 'MAX_POSITION_SIZE',
            message: 'Position size exceeds maximum',
            severity: 'ERROR',
          },
        ],
      });

      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.85,
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      const result = await service.evaluateExecutionFlow('user-123', recommendation);

      expect(result.decision).toBe(ExecutionDecision.BLOCK);
      expect(result.paperTradingAllowed).toBe(false);
      expect(result.liveTradingAllowed).toBe(false);
      expect(result.reason).toContain('Risk validation failed');
      expect(result.reason).toContain('Position size exceeds maximum');
      expect(result.safetyChecks.riskValidation.passed).toBe(false);
      expect(result.safetyChecks.riskValidation.violations).toHaveLength(1);
    });

    it('should call risk service with correct trade request', async () => {
      mockRiskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });

      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      await service.evaluateExecutionFlow('user-123', recommendation);

      expect(mockRiskService.validateTrade).toHaveBeenCalledWith('user-123', {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        stopLoss: 2450,
        target: 2600,
      });
    });
  });

  describe('Paper Trade Execution with Flow Control', () => {
    beforeEach(() => {
      mockRiskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });
    });

    it('should execute paper trade when flow allows', async () => {
      mockPaperTradingService.executePaperTrade.mockResolvedValue({
        tradeId: 'trade-123',
        status: 'EXECUTED',
        executedPrice: 2502,
        slippage: 2,
        positionId: 'pos-123',
      });

      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      const result = await service.executePaperTrade('user-123', recommendation);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.tradeId).toBe('trade-123');
      expect(result.result!.status).toBe('EXECUTED');
      expect(result.flowResult.decision).toBe(ExecutionDecision.PAPER_ONLY);

      expect(mockPaperTradingService.executePaperTrade).toHaveBeenCalledWith('user-123', {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        stopLoss: 2450,
        target: 2600,
      });
    });

    it('should NOT execute paper trade when flow blocks', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'NO_TRADE',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      const result = await service.executePaperTrade('user-123', recommendation);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Paper trading blocked');
      expect(result.flowResult.decision).toBe(ExecutionDecision.BLOCK);

      expect(mockPaperTradingService.executePaperTrade).not.toHaveBeenCalled();
    });

    it('should log audit trail for successful paper trade', async () => {
      mockPaperTradingService.executePaperTrade.mockResolvedValue({
        tradeId: 'trade-123',
        status: 'EXECUTED',
        executedPrice: 2502,
        slippage: 2,
        positionId: 'pos-123',
      });

      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      await service.executePaperTrade('user-123', recommendation);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'execution-flow',
          action: 'execute_paper_trade',
          success: true,
        })
      );
    });

    it('should log audit trail for blocked paper trade', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'NO_TRADE',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      await service.executePaperTrade('user-123', recommendation);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'execution-flow',
          action: 'execute_paper_trade',
          success: false,
          error: 'Paper trading not allowed',
        })
      );
    });
  });

  describe('Execution Thresholds Configuration', () => {
    it('should return execution thresholds', () => {
      const thresholds = service.getExecutionThresholds();

      expect(thresholds).toEqual({
        minConfidenceForPaper: 0.6,
        minConfidenceForLive: 0.8,
        minScoreThreshold: 60,
        minRiskReward: 2.0,
      });
    });
  });

  describe('Audit Logging', () => {
    beforeEach(() => {
      mockRiskService.validateTrade.mockResolvedValue({
        passed: true,
        violations: [],
      });
    });

    it('should log audit trail for BLOCK decision', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'NO_TRADE',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      await service.evaluateExecutionFlow('user-123', recommendation);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'execution-flow',
          action: 'evaluate_flow',
          payload: expect.objectContaining({
            userId: 'user-123',
            symbol: 'RELIANCE',
            decision: ExecutionDecision.BLOCK,
          }),
          success: true,
        })
      );
    });

    it('should log audit trail for PAPER_ONLY decision', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.7,
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      await service.evaluateExecutionFlow('user-123', recommendation);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'execution-flow',
          action: 'evaluate_flow',
          payload: expect.objectContaining({
            userId: 'user-123',
            symbol: 'RELIANCE',
            decision: ExecutionDecision.PAPER_ONLY,
            confidence: 0.7,
          }),
          success: true,
        })
      );
    });

    it('should log audit trail for ALLOW_REAL decision', async () => {
      const recommendation: TradeRecommendation = {
        symbol: 'RELIANCE',
        signal: 'BUY',
        confidence: 0.85,
        entry: 2500,
        stopLoss: 2450,
        target: 2600,
        quantity: 10,
      };

      await service.evaluateExecutionFlow('user-123', recommendation);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'execution-flow',
          action: 'evaluate_flow',
          payload: expect.objectContaining({
            userId: 'user-123',
            symbol: 'RELIANCE',
            decision: ExecutionDecision.ALLOW_REAL,
            confidence: 0.85,
          }),
          success: true,
        })
      );
    });
  });
});
