import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit.service';

export interface RiskValidationResult {
  passed: boolean;
  violations: {
    rule: string;
    message: string;
    severity: 'ERROR' | 'WARNING';
  }[];
}

export interface TradeRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  stopLoss?: number;
  target?: number;
  isIntraday?: boolean; // Flag to indicate intraday trade
  atr?: number; // Average True Range for intraday validation
  currentPrice?: number; // Current market price for intraday validation
  // Task 71.1: Options-specific fields
  assetType?: 'STOCK' | 'OPTION_CALL' | 'OPTION_PUT' | 'INDEX' | 'FUTURES';
  bidAskSpread?: number; // For liquidity validation
  openInterest?: number; // For liquidity validation
  impliedVolatility?: number; // For options volatility checks
  delta?: number; // For options Greek validation
}

/**
 * Risk Engine - Validates all trades against risk rules
 * All trades MUST pass through this service before execution
 */
@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService
  ) {}

  /**
   * Validate trade request against risk rules
   *
   * @param userId - User making the trade
   * @param tradeRequest - Trade details to validate
   * @returns Validation result with violations if any
   */
  async validateTrade(userId: string, tradeRequest: TradeRequest): Promise<RiskValidationResult> {
    this.logger.debug(
      `Validating trade: ${tradeRequest.action} ${tradeRequest.quantity} ${tradeRequest.symbol} ${tradeRequest.isIntraday ? '(INTRADAY)' : ''}`
    );

    const violations: RiskValidationResult['violations'] = [];

    // Get user's risk profile
    const riskProfile = await this.prisma.riskProfile.findUnique({
      where: { userId },
    });

    if (!riskProfile) {
      violations.push({
        rule: 'RISK_PROFILE_MISSING',
        message: 'User risk profile not found',
        severity: 'ERROR',
      });

      // Log failed Risk Engine validation (Requirement 18.6)
      await this.auditLogService.logRiskValidation(
        userId,
        tradeRequest,
        { passed: false, violations },
        false
      );

      return { passed: false, violations };
    }

    // Validate position size (price × quantity ≤ maxPositionSize)
    const positionSize = tradeRequest.price * tradeRequest.quantity;
    if (positionSize > riskProfile.maxPositionSize) {
      violations.push({
        rule: 'MAX_POSITION_SIZE',
        message: `Position size ${positionSize.toFixed(2)} exceeds max ${riskProfile.maxPositionSize.toFixed(2)}`,
        severity: 'ERROR',
      });
    }

    // Validate stop loss placement (stopLoss < entryPrice for BUY, stopLoss > entryPrice for SELL)
    if (tradeRequest.stopLoss !== undefined) {
      const stopLossValid = this.validateStopLoss(
        tradeRequest.action,
        tradeRequest.price,
        tradeRequest.stopLoss
      );

      if (!stopLossValid) {
        violations.push({
          rule: 'INVALID_STOP_LOSS',
          message: `Stop loss ${tradeRequest.stopLoss} is invalid for ${tradeRequest.action} at ${tradeRequest.price}`,
          severity: 'ERROR',
        });
      }
    }

    // Task 63.3: Intraday-specific risk validation
    if (tradeRequest.isIntraday) {
      const intradayValidation = await this.validateIntradayTrade(tradeRequest, riskProfile);
      if (!intradayValidation.passed) {
        violations.push(...intradayValidation.violations);
      }
    }

    // Task 71.1: Options-specific risk validation
    const isOptionsPosition =
      tradeRequest.assetType === 'OPTION_CALL' || tradeRequest.assetType === 'OPTION_PUT';

    if (isOptionsPosition) {
      const optionsValidation = await this.validateOptionsTrade(
        userId,
        tradeRequest,
        riskProfile
      );
      // Always add violations (including warnings), not just when failed
      violations.push(...optionsValidation.violations);
    }

    // Validate portfolio exposure (total exposure ≤ maxPortfolioExposure)
    const exposureValidation = await this.validatePortfolioExposure(
      userId,
      positionSize,
      riskProfile.maxPortfolioExposure
    );

    if (!exposureValidation.passed) {
      violations.push(...exposureValidation.violations);
    }

    // Validate maximum drawdown
    const drawdownValidation = await this.validateMaxDrawdown(userId, riskProfile.maxDrawdown);

    if (!drawdownValidation.passed) {
      violations.push(...drawdownValidation.violations);
    }

    // Validate max open positions
    const openPositions = await this.prisma.position.count({
      where: {
        portfolio: { userId },
        status: 'OPEN',
      },
    });

    if (openPositions >= riskProfile.maxOpenPositions) {
      violations.push({
        rule: 'MAX_OPEN_POSITIONS',
        message: `Already at max open positions (${riskProfile.maxOpenPositions})`,
        severity: 'WARNING',
      });
    }

    const passed = violations.filter((v) => v.severity === 'ERROR').length === 0;

    this.logger.debug(
      `Validation result: ${passed ? 'PASSED' : 'FAILED'} (${violations.length} violations)`
    );

    // Log Risk Engine validation (Requirement 18.6)
    await this.auditLogService.logRiskValidation(
      userId,
      tradeRequest,
      { passed, violations },
      passed
    );

    return { passed, violations };
  }

  /**
   * Validate stop loss placement
   * For BUY: stopLoss must be < entryPrice
   * For SELL: stopLoss must be > entryPrice
   */
  private validateStopLoss(action: 'BUY' | 'SELL', entryPrice: number, stopLoss: number): boolean {
    if (action === 'BUY') {
      return stopLoss < entryPrice;
    } else {
      return stopLoss > entryPrice;
    }
  }

  /**
   * Validate portfolio exposure
   * Total exposure (including new position) should not exceed maxPortfolioExposure
   */
  private async validatePortfolioExposure(
    userId: string,
    newPositionSize: number,
    maxExposure: number
  ): Promise<RiskValidationResult> {
    const violations: RiskValidationResult['violations'] = [];

    // Get portfolio
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      include: { Position: { where: { status: 'OPEN' } } },
    });

    if (!portfolio) {
      // No portfolio yet, first trade
      return { passed: true, violations: [] };
    }

    // Calculate current exposure
    const currentExposure = portfolio.Position.reduce(
      (sum, pos) => sum + pos.currentPrice * pos.quantity,
      0
    );

    const totalExposure = currentExposure + newPositionSize;
    const exposureRatio = totalExposure / portfolio.totalValue;

    if (exposureRatio > maxExposure) {
      violations.push({
        rule: 'MAX_PORTFOLIO_EXPOSURE',
        message: `Total exposure ${(exposureRatio * 100).toFixed(2)}% exceeds max ${(maxExposure * 100).toFixed(2)}%`,
        severity: 'ERROR',
      });
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Task 63.3: Validate intraday-specific risk rules
   *
   * Requirements: 8.1, 6.7
   * - Validate stop loss is appropriate for intraday volatility (use ATR)
   * - Validate position size considers intraday risk (smaller than swing)
   * - Validate entry price is within 1% of current price
   */
  private async validateIntradayTrade(
    tradeRequest: TradeRequest,
    riskProfile: any
  ): Promise<RiskValidationResult> {
    const violations: RiskValidationResult['violations'] = [];

    // 1. Validate stop loss is appropriate for intraday volatility (use ATR)
    if (tradeRequest.stopLoss && tradeRequest.atr) {
      const stopLossDistance = Math.abs(tradeRequest.price - tradeRequest.stopLoss);
      const minStopLoss = tradeRequest.atr * 1.5; // Stop loss should be at least 1.5x ATR
      const maxStopLoss = tradeRequest.atr * 3.0; // Stop loss should not be more than 3x ATR

      if (stopLossDistance < minStopLoss) {
        violations.push({
          rule: 'INTRADAY_STOP_LOSS_TOO_TIGHT',
          message: `Stop loss distance ${stopLossDistance.toFixed(2)} is too tight for intraday volatility (ATR: ${tradeRequest.atr.toFixed(2)}, min: ${minStopLoss.toFixed(2)})`,
          severity: 'WARNING',
        });
      }

      if (stopLossDistance > maxStopLoss) {
        violations.push({
          rule: 'INTRADAY_STOP_LOSS_TOO_WIDE',
          message: `Stop loss distance ${stopLossDistance.toFixed(2)} is too wide for intraday trading (ATR: ${tradeRequest.atr.toFixed(2)}, max: ${maxStopLoss.toFixed(2)})`,
          severity: 'WARNING',
        });
      }
    }

    // 2. Validate position size considers intraday risk (smaller than swing)
    const positionSize = tradeRequest.price * tradeRequest.quantity;
    const intradayMaxPosition = riskProfile.maxPositionSize * 0.5; // Intraday should use 50% of max

    if (positionSize > intradayMaxPosition) {
      violations.push({
        rule: 'INTRADAY_POSITION_TOO_LARGE',
        message: `Intraday position size ${positionSize.toFixed(2)} exceeds recommended intraday max ${intradayMaxPosition.toFixed(2)} (50% of swing max)`,
        severity: 'WARNING',
      });
    }

    // 3. Validate entry price is within 1% of current price
    if (tradeRequest.currentPrice) {
      const priceDeviation =
        Math.abs(tradeRequest.price - tradeRequest.currentPrice) / tradeRequest.currentPrice;
      const maxDeviation = 0.01; // 1%

      if (priceDeviation > maxDeviation) {
        violations.push({
          rule: 'INTRADAY_ENTRY_PRICE_STALE',
          message: `Entry price ${tradeRequest.price.toFixed(2)} deviates ${(priceDeviation * 100).toFixed(2)}% from current price ${tradeRequest.currentPrice.toFixed(2)} (max: ${maxDeviation * 100}%)`,
          severity: 'ERROR',
        });
      }
    }

    return {
      passed: violations.filter((v) => v.severity === 'ERROR').length === 0,
      violations,
    };
  }

  /**
   * Validate maximum drawdown
   * Current drawdown should not exceed maxDrawdown limit
   */
  private async validateMaxDrawdown(
    userId: string,
    maxDrawdown: number
  ): Promise<RiskValidationResult> {
    const violations: RiskValidationResult['violations'] = [];

    // Get portfolio
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      include: { Position: { where: { status: 'OPEN' } } },
    });

    if (!portfolio) {
      // No portfolio yet, first trade
      return { passed: true, violations: [] };
    }

    // Calculate current drawdown from realized and unrealized PnL
    const totalPnL = portfolio.realizedPnL + portfolio.unrealizedPnL;
    const currentDrawdown = -totalPnL / portfolio.totalValue;

    // Only check if we're in a drawdown (negative PnL)
    if (currentDrawdown > 0 && currentDrawdown > maxDrawdown) {
      violations.push({
        rule: 'MAX_DRAWDOWN_EXCEEDED',
        message: `Current drawdown ${(currentDrawdown * 100).toFixed(2)}% exceeds max ${(maxDrawdown * 100).toFixed(2)}%`,
        severity: 'ERROR',
      });
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Task 71.1: Validate options-specific risk rules
   *
   * Requirements: 8.1, 8.3
   * - Validate total options exposure <= 20% of portfolio (configurable)
   * - Validate position size limits for options (smaller than stocks)
   * - Validate liquidity requirements (reject illiquid options)
   * - Validate margin requirements for options positions
   */
  private async validateOptionsTrade(
    userId: string,
    tradeRequest: TradeRequest,
    riskProfile: any
  ): Promise<RiskValidationResult> {
    const violations: RiskValidationResult['violations'] = [];

    // Get or use default max options exposure (20% of portfolio)
    const maxOptionsExposure = riskProfile.maxOptionsExposure ?? 0.2;

    // Get portfolio
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      include: {
        Position: {
          where: { status: 'OPEN' },
        },
      },
    });

    if (!portfolio) {
      // First trade - can proceed but validate other rules
      this.logger.debug('No existing portfolio, first options trade');
    } else {
      // 1. Validate total options exposure <= maxOptionsExposure
      const currentOptionsPositions = await this.prisma.position.findMany({
        where: {
          portfolioId: portfolio.id,
          status: 'OPEN',
          symbol: {
            in: await this.getOptionsSymbols(),
          },
        },
      });

      const currentOptionsExposure = currentOptionsPositions.reduce(
        (sum, pos) => sum + pos.currentPrice * pos.quantity,
        0
      );

      const newPositionSize = tradeRequest.price * tradeRequest.quantity;
      const totalOptionsExposure = currentOptionsExposure + newPositionSize;
      const optionsExposureRatio = totalOptionsExposure / portfolio.totalValue;

      if (optionsExposureRatio > maxOptionsExposure) {
        violations.push({
          rule: 'MAX_OPTIONS_EXPOSURE',
          message: `Total options exposure ${(optionsExposureRatio * 100).toFixed(2)}% exceeds max ${(maxOptionsExposure * 100).toFixed(2)}%`,
          severity: 'ERROR',
        });
      }
    }

    // 2. Validate position size limits for options (smaller than stocks)
    const positionSize = tradeRequest.price * tradeRequest.quantity;
    const maxOptionsPosition = (riskProfile.maxOptionsPositionSize ?? riskProfile.maxPositionSize * 0.4); // Default 40% of stock max

    if (positionSize > maxOptionsPosition) {
      violations.push({
        rule: 'OPTIONS_POSITION_TOO_LARGE',
        message: `Options position size ${positionSize.toFixed(2)} exceeds recommended options max ${maxOptionsPosition.toFixed(2)} (40% of stock max)`,
        severity: 'ERROR',
      });
    }

    // 3. Validate liquidity requirements
    const liquidityValidation = this.validateOptionsLiquidity(tradeRequest);
    // Always add violations (including warnings)
    violations.push(...liquidityValidation.violations);

    // 4. Validate margin requirements for options positions
    const marginValidation = this.validateOptionsMargin(tradeRequest, riskProfile, portfolio);
    // Always add violations (including warnings)
    violations.push(...marginValidation.violations);

    return {
      passed: violations.filter((v) => v.severity === 'ERROR').length === 0,
      violations,
    };
  }

  /**
   * Validate options liquidity requirements
   * - Check bid-ask spread is reasonable (< 5% of mid price)
   * - Check open interest is sufficient (> 100 contracts)
   */
  private validateOptionsLiquidity(tradeRequest: TradeRequest): RiskValidationResult {
    const violations: RiskValidationResult['violations'] = [];

    // Check bid-ask spread
    if (tradeRequest.bidAskSpread !== undefined && tradeRequest.price > 0) {
      const spreadPercent = (tradeRequest.bidAskSpread / tradeRequest.price) * 100;
      const maxSpreadPercent = 5.0; // 5% max spread

      if (spreadPercent > maxSpreadPercent) {
        violations.push({
          rule: 'OPTIONS_ILLIQUID_SPREAD',
          message: `Bid-ask spread ${spreadPercent.toFixed(2)}% is too wide, indicating illiquid option (max: ${maxSpreadPercent}%)`,
          severity: 'ERROR',
        });
      } else if (spreadPercent > maxSpreadPercent * 0.6) {
        // Warning at 60% of max
        violations.push({
          rule: 'OPTIONS_WIDE_SPREAD',
          message: `Bid-ask spread ${spreadPercent.toFixed(2)}% is relatively wide (threshold: ${maxSpreadPercent}%)`,
          severity: 'WARNING',
        });
      }
    }

    // Check open interest
    if (tradeRequest.openInterest !== undefined) {
      const minOpenInterest = 100; // Minimum 100 contracts
      const warningOpenInterest = 500; // Warning below 500

      if (tradeRequest.openInterest < minOpenInterest) {
        violations.push({
          rule: 'OPTIONS_LOW_OPEN_INTEREST',
          message: `Open interest ${tradeRequest.openInterest} is too low, indicating illiquid option (min: ${minOpenInterest})`,
          severity: 'ERROR',
        });
      } else if (tradeRequest.openInterest < warningOpenInterest) {
        violations.push({
          rule: 'OPTIONS_MODERATE_OPEN_INTEREST',
          message: `Open interest ${tradeRequest.openInterest} is moderate (recommended: >${warningOpenInterest})`,
          severity: 'WARNING',
        });
      }
    }

    return {
      passed: violations.filter((v) => v.severity === 'ERROR').length === 0,
      violations,
    };
  }

  /**
   * Validate margin requirements for options positions
   * - Ensure sufficient cash balance for margin requirements
   * - Options typically require 20-40% margin
   */
  private validateOptionsMargin(
    tradeRequest: TradeRequest,
    riskProfile: any,
    portfolio: any
  ): RiskValidationResult {
    const violations: RiskValidationResult['violations'] = [];

    if (!portfolio) {
      // Cannot validate margin without portfolio
      return { passed: true, violations: [] };
    }

    // Estimate margin requirement (conservative 40% for options)
    const positionValue = tradeRequest.price * tradeRequest.quantity;
    const marginRequirement = positionValue * 0.4; // 40% margin

    if (portfolio.cashBalance < marginRequirement) {
      violations.push({
        rule: 'INSUFFICIENT_MARGIN',
        message: `Insufficient margin: need ${marginRequirement.toFixed(2)}, available ${portfolio.cashBalance.toFixed(2)}`,
        severity: 'ERROR',
      });
    } else if (portfolio.cashBalance < marginRequirement * 1.5) {
      // Warning if margin buffer is low
      violations.push({
        rule: 'LOW_MARGIN_BUFFER',
        message: `Low margin buffer: ${portfolio.cashBalance.toFixed(2)} available for ${marginRequirement.toFixed(2)} required`,
        severity: 'WARNING',
      });
    }

    return {
      passed: violations.filter((v) => v.severity === 'ERROR').length === 0,
      violations,
    };
  }

  /**
   * Helper method to get all options symbols from the database
   * Returns symbols of all positions with OPTION_CALL or OPTION_PUT asset types
   */
  private async getOptionsSymbols(): Promise<string[]> {
    // Get instruments with options asset types
    const optionsInstruments = await this.prisma.instrument.findMany({
      where: {
        assetType: {
          in: ['OPTION_CALL', 'OPTION_PUT'],
        },
      },
      select: {
        symbol: true,
      },
    });

    return optionsInstruments.map((inst) => inst.symbol);
  }
}
