import { Controller, Post, Body, Logger, Get } from '@nestjs/common';
import { IsString, IsNumber, IsEnum, IsOptional, IsPositive, Min, IsDateString } from 'class-validator';
import { TradingService } from './trading.service';
import { ExecutionFlowService, TradeRecommendation } from './execution-flow.service';
import { TradeRequest } from '../risk/risk.service';

/**
 * DTO for paper trade execution
 * Validates all required fields for paper trading
 */
class ExecutePaperTradeDto {
  @IsString()
  userId!: string;

  @IsString()
  symbol!: string;

  @IsEnum(['BUY', 'SELL'])
  action!: 'BUY' | 'SELL';

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  stopLoss?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  target?: number;

  @IsOptional()
  @IsString()
  signalId?: string;

  // Task 64.1: Intraday flag for tracking intraday positions
  @IsOptional()
  intradayFlag?: boolean;
}

/**
 * DTO for live trade execution
 * Extends paper trade DTO with user confirmation requirement
 */
class ExecuteLiveTradeDto extends ExecutePaperTradeDto {
  @IsOptional()
  userConfirmed!: boolean;
}

/**
 * DTO for execution flow evaluation
 * Validates trade recommendation with confidence/score
 */
class EvaluateExecutionFlowDto {
  @IsString()
  userId!: string;

  @IsString()
  symbol!: string;

  @IsEnum(['BUY', 'SELL', 'HOLD', 'NO_TRADE'])
  signal!: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE';

  @IsNumber()
  @IsPositive()
  entry!: number;

  @IsNumber()
  @IsPositive()
  stopLoss!: number;

  @IsNumber()
  @IsPositive()
  target!: number;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  confidence?: number; // 0-1 scale

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number; // 0-100 scale

  @IsOptional()
  @IsNumber()
  @Min(0)
  riskRewardRatio?: number;
}

/**
 * DTO for options paper trade execution
 * Task 73.3: Validates all required fields for paper options trading
 */
class ExecutePaperOptionTradeDto {
  @IsString()
  userId!: string;

  @IsString()
  symbol!: string; // Underlying (NIFTY or BANKNIFTY)

  @IsEnum(['CALL', 'PUT'])
  optionType!: 'CALL' | 'PUT';

  @IsNumber()
  @IsPositive()
  strikePrice!: number;

  @IsDateString()
  expiry!: string;

  @IsEnum(['BUY', 'SELL'])
  action!: 'BUY' | 'SELL';

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @IsPositive()
  price!: number; // Premium price

  @IsOptional()
  @IsNumber()
  @IsPositive()
  stopLoss?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  target?: number;

  // For realistic slippage and risk validation
  @IsOptional()
  @IsNumber()
  @Min(0)
  bidAskSpread?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  openInterest?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  impliedVolatility?: number;

  @IsOptional()
  @IsNumber()
  delta?: number;

  @IsOptional()
  @IsString()
  signalId?: string;
}

/**
 * Trading Controller - REST API endpoints for trade execution
 *
 * Endpoints:
 * - POST /api/trade/paper - Execute paper trade (simulation)
 * - POST /api/trade/live - Execute live trade (requires user confirmation)
 * - POST /api/trade/evaluate-flow - Evaluate execution flow for recommendation
 * - POST /api/trade/execute-paper-with-flow - Execute paper trade with flow control
 * - GET /api/trade/execution-thresholds - Get execution flow configuration
 *
 * All trades are validated by RiskService before execution.
 * Paper trades are executed via PaperTradingService (no broker API call).
 * Live trades require userConfirmed=true and call Broker API (Task 20.1).
 *
 * Requirements covered:
 * - 9.1: Execute paper trades via PaperTradingService
 * - 8.1-8.5: Validate all trades with RiskService
 * - 10.1-10.2: Require user confirmation for live trades
 * - 5.7: Paper trading mode selection
 * - 12.2: Store trade history
 */
@Controller('trade')
export class TradingController {
  private readonly logger = new Logger(TradingController.name);

  constructor(
    private readonly tradingService: TradingService,
    private readonly executionFlowService: ExecutionFlowService
  ) {}

  /**
   * Execute a paper trade (simulation only)
   *
   * This endpoint:
   * 1. Validates trade request with RiskService
   * 2. Executes paper trade via PaperTradingService
   * 3. Returns trade result with execution details
   *
   * Paper trades do NOT call broker API (Requirement 9.5)
   * Task 64.1: Supports intradayFlag to mark intraday positions
   *
   * @param dto - Paper trade request details
   * @returns Trade execution result
   */
  @Post('paper')
  async executePaperTrade(@Body() dto: ExecutePaperTradeDto) {
    this.logger.log(
      `Paper trade request: ${dto.action} ${dto.quantity} ${dto.symbol}${dto.intradayFlag ? ' (INTRADAY)' : ''}`
    );

    const tradeRequest: TradeRequest = {
      symbol: dto.symbol,
      action: dto.action,
      quantity: dto.quantity,
      price: dto.price,
      stopLoss: dto.stopLoss,
      target: dto.target,
      isIntraday: dto.intradayFlag,
    };

    return this.tradingService.executePaperTrade(
      dto.userId,
      tradeRequest,
      dto.signalId,
      dto.intradayFlag
    );
  }

  /**
   * Execute a live trade (requires user confirmation and broker API)
   *
   * This endpoint:
   * 1. Enforces user confirmation (userConfirmed must be true)
   * 2. Validates trade request with RiskService
   * 3. Executes live trade via broker API (Task 20.1 - to be implemented)
   * 4. Returns trade result with broker order ID
   *
   * Live trades require explicit user confirmation (Requirement 10.1-10.2)
   *
   * @param dto - Live trade request details with user confirmation
   * @returns Trade execution result
   */
  @Post('live')
  async executeLiveTrade(@Body() dto: ExecuteLiveTradeDto) {
    this.logger.log(
      `Live trade request: ${dto.action} ${dto.quantity} ${dto.symbol} (confirmed: ${dto.userConfirmed})`
    );

    const tradeRequest: TradeRequest = {
      symbol: dto.symbol,
      action: dto.action,
      quantity: dto.quantity,
      price: dto.price,
      stopLoss: dto.stopLoss,
      target: dto.target,
    };

    return this.tradingService.executeLiveTrade(
      dto.userId,
      tradeRequest,
      dto.userConfirmed,
      dto.signalId
    );
  }

  /**
   * Evaluate execution flow for a trade recommendation
   *
   * This endpoint implements the execution decision tree:
   * - NO_TRADE signal → BLOCK
   * - Low confidence (< 60%) → BLOCK
   * - Medium confidence (60-80%) → PAPER_ONLY
   * - High confidence (> 80%) → ALLOW_REAL (requires explicit user action)
   *
   * Returns decision with reasoning and safety check results.
   *
   * Requirements covered: 5.7, 12.2
   *
   * @param dto - Trade recommendation with confidence/score
   * @returns Execution flow evaluation result
   */
  @Post('evaluate-flow')
  async evaluateExecutionFlow(@Body() dto: EvaluateExecutionFlowDto) {
    this.logger.log(
      `Evaluating execution flow for ${dto.symbol}: signal=${dto.signal}, ` +
        `confidence=${dto.confidence}, score=${dto.score}`
    );

    const recommendation: TradeRecommendation = {
      symbol: dto.symbol,
      signal: dto.signal,
      confidence: dto.confidence,
      score: dto.score,
      entry: dto.entry,
      stopLoss: dto.stopLoss,
      target: dto.target,
      quantity: dto.quantity,
      riskRewardRatio: dto.riskRewardRatio,
    };

    return this.executionFlowService.evaluateExecutionFlow(dto.userId, recommendation);
  }

  /**
   * Execute paper trade with execution flow control
   *
   * This endpoint:
   * 1. Evaluates execution flow (NO_TRADE check, confidence check, risk validation)
   * 2. If paper trading allowed, executes paper trade
   * 3. Returns execution result with flow evaluation
   *
   * This is the recommended endpoint for swing trading paper execution.
   *
   * Requirements covered: 5.7, 5.8, 12.2
   *
   * @param dto - Trade recommendation with confidence/score
   * @returns Paper trade execution result with flow evaluation
   */
  @Post('execute-paper-with-flow')
  async executePaperTradeWithFlow(@Body() dto: EvaluateExecutionFlowDto) {
    this.logger.log(`Executing paper trade with flow control for ${dto.symbol}`);

    const recommendation: TradeRecommendation = {
      symbol: dto.symbol,
      signal: dto.signal,
      confidence: dto.confidence,
      score: dto.score,
      entry: dto.entry,
      stopLoss: dto.stopLoss,
      target: dto.target,
      quantity: dto.quantity,
      riskRewardRatio: dto.riskRewardRatio,
    };

    return this.executionFlowService.executePaperTrade(dto.userId, recommendation);
  }

  /**
   * Get execution flow configuration thresholds
   *
   * Returns the confidence and score thresholds used for execution decisions.
   * Useful for frontend display or admin configuration.
   *
   * @returns Execution flow thresholds
   */
  @Get('execution-thresholds')
  async getExecutionThresholds() {
    this.logger.log('Fetching execution flow thresholds');
    return this.executionFlowService.getExecutionThresholds();
  }

  /**
   * Execute a paper trade for options (Task 73.3)
   *
   * This endpoint:
   * 1. Validates symbol (NIFTY/BANKNIFTY only)
   * 2. Validates trade request with RiskService (options-specific rules)
   * 3. Executes paper trade via PaperTradingService
   * 4. Logs trade execution in AuditLog
   * 5. Returns trade result with execution details
   *
   * Paper trades do NOT call broker API (Requirement 9.5)
   * Options paper trading ONLY - no live trading for options (Requirement 9.1, 10.1, 18.2)
   *
   * @param dto - Paper option trade request details
   * @returns Trade execution result
   */
  @Post('paper/option')
  async executePaperOptionTrade(@Body() dto: ExecutePaperOptionTradeDto) {
    this.logger.log(
      `Paper option trade request: ${dto.action} ${dto.quantity} ${dto.symbol} ${dto.strikePrice} ${dto.optionType} exp:${dto.expiry}`
    );

    // Validate symbol (NIFTY/BANKNIFTY only)
    if (!['NIFTY', 'BANKNIFTY'].includes(dto.symbol)) {
      this.logger.error(`Invalid symbol for options: ${dto.symbol}. Only NIFTY/BANKNIFTY allowed.`);
      return {
        tradeId: '',
        status: 'FAILED',
        error: `Invalid symbol: ${dto.symbol}. Only NIFTY and BANKNIFTY options are supported.`,
      };
    }

    return this.tradingService.executePaperOptionTrade(dto.userId, {
      symbol: dto.symbol,
      strikePrice: dto.strikePrice,
      optionType: dto.optionType,
      expiry: dto.expiry,
      action: dto.action,
      quantity: dto.quantity,
      price: dto.price,
      stopLoss: dto.stopLoss,
      target: dto.target,
      signalId: dto.signalId,
    });
  }
}
