import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RiskService, TradeRequest } from '../risk/risk.service';
import { PaperTradingService, PaperTradeRequest } from './paper-trading.service';
import { AuditLogService } from '../audit/audit.service';

/**
 * Execution decision based on confidence level and safety checks
 */
export enum ExecutionDecision {
  /** Block trade execution - conditions not favorable */
  BLOCK = 'BLOCK',
  /** Allow paper trading only - low/medium confidence */
  PAPER_ONLY = 'PAPER_ONLY',
  /** Allow real trading - high confidence (requires explicit user action) */
  ALLOW_REAL = 'ALLOW_REAL',
}

/**
 * Result of execution flow evaluation
 */
export interface ExecutionFlowResult {
  /** Decision: BLOCK, PAPER_ONLY, or ALLOW_REAL */
  decision: ExecutionDecision;

  /** Human-readable reason for the decision */
  reason: string;

  /** Whether paper trading is allowed */
  paperTradingAllowed: boolean;

  /** Whether live trading is allowed (requires separate user action) */
  liveTradingAllowed: boolean;

  /** Safety check results */
  safetyChecks: {
    noTradeCheck: { passed: boolean; reason: string };
    confidenceCheck: { passed: boolean; confidence: number; threshold: number };
    riskValidation: { passed: boolean; violations: any[] };
  };
}

/**
 * Trade recommendation with confidence level
 */
export interface TradeRecommendation {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE';
  confidence?: number; // 0-1 scale
  score?: number; // 0-100 scale
  entry: number;
  stopLoss: number;
  target: number;
  quantity: number;
  riskRewardRatio?: number;
}

/**
 * ExecutionFlowService - Controls execution flow with safety checks
 *
 * Implements the execution decision tree:
 * 1. NO_TRADE signal → BLOCK (no execution allowed)
 * 2. Low confidence (< 0.6) → BLOCK
 * 3. Medium confidence (0.6-0.8) → PAPER_ONLY
 * 4. High confidence (> 0.8) → ALLOW_REAL (but requires explicit user action)
 *
 * Safety checks enforced before any execution:
 * - NO_TRADE logic (signal, score thresholds, risk/reward)
 * - Confidence level validation
 * - Risk Engine validation (position size, exposure, etc.)
 *
 * Requirements covered:
 * - 5.7: Paper trading button only (NO automatic live execution)
 * - 5.8: System stops after paper trade (requires separate action for live)
 * - 12.2: Store trade history in database
 * - 18.4: Enforce AI → Risk Engine → Broker flow
 */
@Injectable()
export class ExecutionFlowService {
  private readonly logger = new Logger(ExecutionFlowService.name);

  // Confidence thresholds for execution decisions
  private readonly MIN_CONFIDENCE_FOR_PAPER = 0.6; // 60%
  private readonly MIN_CONFIDENCE_FOR_LIVE = 0.8; // 80%

  // Score thresholds (for swing trading)
  private readonly MIN_SCORE_THRESHOLD = 60; // 0-100 scale

  // Risk/Reward minimum threshold
  private readonly MIN_RISK_REWARD = 2.0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly riskService: RiskService,
    private readonly paperTradingService: PaperTradingService,
    private readonly auditLogService: AuditLogService
  ) {
    this.logger.log('ExecutionFlowService initialized with safety thresholds');
  }

  /**
   * Evaluate execution flow for a trade recommendation
   *
   * This is the main decision tree that determines if a trade should be:
   * - BLOCKED (NO_TRADE conditions)
   * - PAPER_ONLY (low/medium confidence)
   * - ALLOW_REAL (high confidence, but still requires explicit user confirmation)
   *
   * @param userId - User making the trade
   * @param recommendation - Trade recommendation with confidence/score
   * @returns ExecutionFlowResult with decision and reasoning
   */
  async evaluateExecutionFlow(
    userId: string,
    recommendation: TradeRecommendation
  ): Promise<ExecutionFlowResult> {
    this.logger.debug(
      `Evaluating execution flow for ${recommendation.symbol}: ` +
        `signal=${recommendation.signal}, confidence=${recommendation.confidence}, score=${recommendation.score}`
    );

    // Step 1: Check NO_TRADE logic
    const noTradeCheck = this.checkNoTradeConditions(recommendation);

    if (!noTradeCheck.passed) {
      // NO_TRADE conditions met - block all execution
      this.logger.log(`BLOCKED: ${noTradeCheck.reason}`);

      await this.auditLogService.log({
        service: 'execution-flow',
        action: 'evaluate_flow',
        payload: {
          userId,
          symbol: recommendation.symbol,
          decision: ExecutionDecision.BLOCK,
          reason: noTradeCheck.reason,
        },
        success: true,
      });

      return {
        decision: ExecutionDecision.BLOCK,
        reason: noTradeCheck.reason,
        paperTradingAllowed: false,
        liveTradingAllowed: false,
        safetyChecks: {
          noTradeCheck,
          confidenceCheck: {
            passed: false,
            confidence: recommendation.confidence || 0,
            threshold: this.MIN_CONFIDENCE_FOR_PAPER,
          },
          riskValidation: { passed: false, violations: [] },
        },
      };
    }

    // Step 2: Check confidence level
    const confidenceCheck = this.checkConfidenceLevel(recommendation);

    if (!confidenceCheck.passed) {
      // Confidence too low - block execution
      this.logger.log(`BLOCKED: Low confidence (${confidenceCheck.confidence})`);

      await this.auditLogService.log({
        service: 'execution-flow',
        action: 'evaluate_flow',
        payload: {
          userId,
          symbol: recommendation.symbol,
          decision: ExecutionDecision.BLOCK,
          reason: `Confidence ${confidenceCheck.confidence} below minimum ${confidenceCheck.threshold}`,
        },
        success: true,
      });

      return {
        decision: ExecutionDecision.BLOCK,
        reason: `Confidence too low for execution (${(confidenceCheck.confidence * 100).toFixed(0)}% < ${(confidenceCheck.threshold * 100).toFixed(0)}%)`,
        paperTradingAllowed: false,
        liveTradingAllowed: false,
        safetyChecks: {
          noTradeCheck,
          confidenceCheck,
          riskValidation: { passed: false, violations: [] },
        },
      };
    }

    // Step 3: Validate with Risk Engine
    const tradeRequest: TradeRequest = {
      symbol: recommendation.symbol,
      action: recommendation.signal === 'BUY' ? 'BUY' : 'SELL',
      quantity: recommendation.quantity,
      price: recommendation.entry,
      stopLoss: recommendation.stopLoss,
      target: recommendation.target,
    };

    const riskValidation = await this.riskService.validateTrade(userId, tradeRequest);

    if (!riskValidation.passed) {
      // Risk validation failed - block execution
      const violations = riskValidation.violations.map((v) => v.message).join('; ');
      this.logger.log(`BLOCKED: Risk validation failed - ${violations}`);

      await this.auditLogService.log({
        service: 'execution-flow',
        action: 'evaluate_flow',
        payload: {
          userId,
          symbol: recommendation.symbol,
          decision: ExecutionDecision.BLOCK,
          reason: `Risk validation failed: ${violations}`,
          violations: riskValidation.violations,
        },
        success: true,
      });

      return {
        decision: ExecutionDecision.BLOCK,
        reason: `Risk validation failed: ${violations}`,
        paperTradingAllowed: false,
        liveTradingAllowed: false,
        safetyChecks: {
          noTradeCheck,
          confidenceCheck,
          riskValidation: { passed: false, violations: riskValidation.violations },
        },
      };
    }

    // Step 4: Determine execution mode based on confidence
    const confidence = recommendation.confidence || 0;

    if (confidence >= this.MIN_CONFIDENCE_FOR_LIVE) {
      // High confidence - allow real trading (but requires explicit user action)
      this.logger.log(
        `ALLOW_REAL: High confidence (${(confidence * 100).toFixed(0)}%) - ` +
          `user can choose paper or live trading`
      );

      await this.auditLogService.log({
        service: 'execution-flow',
        action: 'evaluate_flow',
        payload: {
          userId,
          symbol: recommendation.symbol,
          decision: ExecutionDecision.ALLOW_REAL,
          confidence,
        },
        success: true,
      });

      return {
        decision: ExecutionDecision.ALLOW_REAL,
        reason: `High confidence trade (${(confidence * 100).toFixed(0)}%) - paper or live trading available`,
        paperTradingAllowed: true,
        liveTradingAllowed: true, // User can choose to go live (requires explicit confirmation)
        safetyChecks: {
          noTradeCheck,
          confidenceCheck,
          riskValidation: { passed: true, violations: [] },
        },
      };
    } else {
      // Medium confidence - paper trading only
      this.logger.log(
        `PAPER_ONLY: Medium confidence (${(confidence * 100).toFixed(0)}%) - ` +
          `paper trading only`
      );

      await this.auditLogService.log({
        service: 'execution-flow',
        action: 'evaluate_flow',
        payload: {
          userId,
          symbol: recommendation.symbol,
          decision: ExecutionDecision.PAPER_ONLY,
          confidence,
        },
        success: true,
      });

      return {
        decision: ExecutionDecision.PAPER_ONLY,
        reason: `Medium confidence trade (${(confidence * 100).toFixed(0)}%) - paper trading recommended`,
        paperTradingAllowed: true,
        liveTradingAllowed: false,
        safetyChecks: {
          noTradeCheck,
          confidenceCheck,
          riskValidation: { passed: true, violations: [] },
        },
      };
    }
  }

  /**
   * Check NO_TRADE conditions
   *
   * Returns true if trade should be blocked based on:
   * - Explicit NO_TRADE signal
   * - Score below minimum threshold
   * - Risk/reward ratio below minimum
   *
   * Requirements covered: 5.6
   */
  private checkNoTradeConditions(recommendation: TradeRecommendation): {
    passed: boolean;
    reason: string;
  } {
    // Check 1: Explicit NO_TRADE signal
    if (recommendation.signal === 'NO_TRADE' || recommendation.signal === 'HOLD') {
      return {
        passed: false,
        reason: `AI recommended ${recommendation.signal} - conditions not favorable for trading`,
      };
    }

    // Check 2: Score threshold (if score is provided)
    if (recommendation.score !== undefined && recommendation.score < this.MIN_SCORE_THRESHOLD) {
      return {
        passed: false,
        reason: `Score ${recommendation.score.toFixed(1)} below minimum threshold ${this.MIN_SCORE_THRESHOLD}`,
      };
    }

    // Check 3: Risk/Reward ratio (if provided)
    if (
      recommendation.riskRewardRatio !== undefined &&
      recommendation.riskRewardRatio < this.MIN_RISK_REWARD
    ) {
      return {
        passed: false,
        reason: `Risk/Reward ratio ${recommendation.riskRewardRatio.toFixed(2)} below minimum ${this.MIN_RISK_REWARD}`,
      };
    }

    // Check 4: Valid entry, stop loss, and target
    if (recommendation.entry <= 0 || recommendation.stopLoss <= 0 || recommendation.target <= 0) {
      return {
        passed: false,
        reason: 'Invalid trade levels (entry, stop loss, or target)',
      };
    }

    // Check 5: Stop loss and target make sense for the trade direction
    if (recommendation.signal === 'BUY') {
      if (recommendation.stopLoss >= recommendation.entry) {
        return {
          passed: false,
          reason: 'Invalid BUY trade: stop loss must be below entry',
        };
      }
      if (recommendation.target <= recommendation.entry) {
        return {
          passed: false,
          reason: 'Invalid BUY trade: target must be above entry',
        };
      }
    } else if (recommendation.signal === 'SELL') {
      if (recommendation.stopLoss <= recommendation.entry) {
        return {
          passed: false,
          reason: 'Invalid SELL trade: stop loss must be above entry',
        };
      }
      if (recommendation.target >= recommendation.entry) {
        return {
          passed: false,
          reason: 'Invalid SELL trade: target must be below entry',
        };
      }
    }

    // All checks passed
    return {
      passed: true,
      reason: 'NO_TRADE checks passed',
    };
  }

  /**
   * Check confidence level
   *
   * Returns whether confidence meets minimum threshold for any execution
   */
  private checkConfidenceLevel(recommendation: TradeRecommendation): {
    passed: boolean;
    confidence: number;
    threshold: number;
  } {
    const confidence = recommendation.confidence || 0;

    return {
      passed: confidence >= this.MIN_CONFIDENCE_FOR_PAPER,
      confidence,
      threshold: this.MIN_CONFIDENCE_FOR_PAPER,
    };
  }

  /**
   * Execute paper trade with safety checks
   *
   * This method:
   * 1. Re-validates execution flow
   * 2. Ensures paper trading is allowed
   * 3. Executes paper trade via PaperTradingService
   * 4. Logs execution to audit trail
   *
   * @param userId - User executing the trade
   * @param recommendation - Trade recommendation
   * @returns Paper trade execution result
   */
  async executePaperTrade(userId: string, recommendation: TradeRecommendation) {
    this.logger.log(`Executing paper trade for ${recommendation.symbol}`);

    // Re-validate execution flow
    const flowResult = await this.evaluateExecutionFlow(userId, recommendation);

    if (!flowResult.paperTradingAllowed) {
      this.logger.warn(
        `Paper trading not allowed for ${recommendation.symbol}: ${flowResult.reason}`
      );

      await this.auditLogService.log({
        service: 'execution-flow',
        action: 'execute_paper_trade',
        payload: {
          userId,
          symbol: recommendation.symbol,
          decision: flowResult.decision,
        },
        success: false,
        error: 'Paper trading not allowed',
      });

      return {
        success: false,
        error: `Paper trading blocked: ${flowResult.reason}`,
        flowResult,
      };
    }

    // Build paper trade request
    const paperTradeRequest: PaperTradeRequest = {
      symbol: recommendation.symbol,
      action: recommendation.signal === 'BUY' ? 'BUY' : 'SELL',
      quantity: recommendation.quantity,
      price: recommendation.entry,
      stopLoss: recommendation.stopLoss,
      target: recommendation.target,
    };

    // Execute paper trade
    const result = await this.paperTradingService.executePaperTrade(userId, paperTradeRequest);

    // Log to audit trail
    await this.auditLogService.log({
      service: 'execution-flow',
      action: 'execute_paper_trade',
      payload: {
        userId,
        symbol: recommendation.symbol,
        tradeId: result.tradeId,
        decision: flowResult.decision,
        executedPrice: result.executedPrice,
        slippage: result.slippage,
      },
      success: result.status === 'EXECUTED',
      error: result.error,
    });

    this.logger.log(
      `Paper trade ${result.status}: ${recommendation.symbol}, tradeId=${result.tradeId}`
    );

    return {
      success: result.status === 'EXECUTED',
      result,
      flowResult,
    };
  }

  /**
   * Get execution flow configuration thresholds
   *
   * Useful for displaying to users or adjusting in admin interface
   */
  getExecutionThresholds() {
    return {
      minConfidenceForPaper: this.MIN_CONFIDENCE_FOR_PAPER,
      minConfidenceForLive: this.MIN_CONFIDENCE_FOR_LIVE,
      minScoreThreshold: this.MIN_SCORE_THRESHOLD,
      minRiskReward: this.MIN_RISK_REWARD,
    };
  }
}
