import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RiskService, TradeRequest } from '../risk/risk.service';
import { PaperTradingService, PaperTradeRequest } from './paper-trading.service';
import { KotakNeoProvider, PlaceOrderRequest } from './brokers/kotak-neo.provider';
import { AuditLogService } from '../audit/audit.service';
import { KillSwitchService } from './kill-switch/kill-switch.service';

export interface TradeResult {
  tradeId: string;
  status: 'EXECUTED' | 'FAILED' | 'PENDING';
  executedPrice?: number;
  slippage?: number;
  brokerOrderId?: string;
  positionId?: string;
  error?: string;
}

/**
 * Trading Service - Handles both paper and live trade execution
 *
 * This service orchestrates live trade execution with proper validation,
 * confirmation checks, and broker integration. It ensures architectural
 * constraints are maintained (AI cannot bypass this service).
 *
 * Requirements covered:
 * - 10.1: Require explicit user confirmation for live trades
 * - 10.2: Validate trade with RiskService before execution
 * - 10.4: Send order to Broker API (via KotakNeoProvider)
 * - 10.6: Store trade execution details with brokerOrderId
 * - 18.2: Ensure AI cannot bypass this service
 * - 18.4: Enforce data flow: AI → Risk → User → Broker
 */
@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly riskService: RiskService,
    private readonly paperTradingService: PaperTradingService,
    private readonly kotakNeoProvider: KotakNeoProvider,
    private readonly auditLogService: AuditLogService,
    private readonly killSwitchService: KillSwitchService
  ) {}

  /**
   * Execute a paper trade (simulation only)
   * Does NOT call broker API
   * Task 64.1: Supports intradayFlag to mark intraday positions
   */
  async executePaperTrade(
    userId: string,
    tradeRequest: TradeRequest,
    signalId?: string,
    intradayFlag?: boolean
  ): Promise<TradeResult> {
    this.logger.log(
      `Executing paper trade: ${tradeRequest.action} ${tradeRequest.quantity} ${tradeRequest.symbol}${intradayFlag ? ' (INTRADAY)' : ''}`
    );

    // Validate with Risk Engine first
    const validation = await this.riskService.validateTrade(userId, tradeRequest);

    if (!validation.passed) {
      return {
        tradeId: '',
        status: 'FAILED',
        error: `Risk validation failed: ${validation.violations.map((v) => v.message).join(', ')}`,
      };
    }

    // Delegate to PaperTradingService
    const paperTradeRequest: PaperTradeRequest = {
      symbol: tradeRequest.symbol,
      action: tradeRequest.action,
      quantity: tradeRequest.quantity,
      price: tradeRequest.price,
      stopLoss: tradeRequest.stopLoss,
      target: tradeRequest.target,
    };

    const result = await this.paperTradingService.executePaperTrade(
      userId,
      paperTradeRequest,
      signalId,
      intradayFlag
    );

    return {
      tradeId: result.tradeId,
      status: result.status,
      executedPrice: result.executedPrice,
      slippage: result.slippage,
      positionId: result.positionId,
      error: result.error,
    };
  }

  /**
   * Execute a live trade (requires user confirmation and broker API)
   *
   * This method implements the complete live trade execution flow:
   * 1. Enforce user confirmation (CRITICAL: AI cannot bypass)
   * 2. Validate trade with RiskService
   * 3. Place order with Kotak Neo broker
   * 4. Store execution details in database with brokerOrderId
   *
   * Requirements covered:
   * - 10.1: Enforce user confirmation check
   * - 10.2: Validate trade with RiskService before broker call
   * - 10.4: Call Kotak Neo provider to place order
   * - 10.6: Store trade execution details with brokerOrderId
   * - 18.2: AI cannot bypass this service (architectural constraint)
   * - 18.4: Enforce flow: AI → Risk → User → Broker
   */
  async executeLiveTrade(
    userId: string,
    tradeRequest: TradeRequest,
    userConfirmed: boolean,
    signalId?: string
  ): Promise<TradeResult> {
    this.logger.log(
      `Live trade request: ${tradeRequest.action} ${tradeRequest.quantity} ${tradeRequest.symbol} (confirmed: ${userConfirmed})`
    );

    // STEP 0: Kill Switch Check (defense in depth — also checked at controller level)
    if (!this.killSwitchService.isLiveTradingAllowed()) {
      this.logger.warn('Live trade rejected: Kill switch is enabled');
      return {
        tradeId: '',
        status: 'FAILED',
        error: 'Live trading is disabled. Kill switch is active.',
      };
    }

    // STEP 1: Enforce user confirmation (Requirement 10.1)
    // CRITICAL: This prevents AI from executing trades without human approval
    if (!userConfirmed) {
      this.logger.warn('Live trade rejected: User confirmation not provided');
      return {
        tradeId: '',
        status: 'FAILED',
        error: 'User confirmation required for live trades',
      };
    }

    // STEP 2: Validate with Risk Engine (Requirement 10.2, 18.4)
    const validation = await this.riskService.validateTrade(userId, tradeRequest);

    if (!validation.passed) {
      const errorMsg = `Risk validation failed: ${validation.violations.map((v) => v.message).join(', ')}`;
      this.logger.warn(errorMsg);

      return {
        tradeId: '',
        status: 'FAILED',
        error: errorMsg,
      };
    }

    try {
      // STEP 3: Place order with Kotak Neo broker (Requirement 10.4)
      const orderRequest: PlaceOrderRequest = {
        symbol: tradeRequest.symbol,
        action: tradeRequest.action,
        quantity: tradeRequest.quantity,
        price: tradeRequest.price,
        orderType: 'MARKET',
        productType: 'MIS', // Intraday by default
        stopLoss: tradeRequest.stopLoss,
        target: tradeRequest.target,
      };

      const orderResponse = await this.kotakNeoProvider.placeOrder(orderRequest);

      // Log Broker API call (Requirement 18.6)
      await this.auditLogService.logBrokerCall(
        'place_order',
        userId,
        {
          symbol: tradeRequest.symbol,
          action: tradeRequest.action,
          quantity: tradeRequest.quantity,
          price: tradeRequest.price,
        },
        orderResponse.success && orderResponse.status !== 'REJECTED',
        orderResponse.success ? undefined : orderResponse.message,
        {
          brokerOrderId: orderResponse.brokerOrderId,
          status: orderResponse.status,
        }
      );

      if (!orderResponse.success || orderResponse.status === 'REJECTED') {
        this.logger.error(`Broker rejected order: ${orderResponse.message}`);
        return {
          tradeId: '',
          status: 'FAILED',
          error: `Broker rejected order: ${orderResponse.message}`,
        };
      }

      // STEP 4: Store trade execution details in database (Requirement 10.6)
      const liveTrade = await this.prisma.liveTrade.create({
        data: {
          userId,
          signalId: signalId || null,
          symbol: tradeRequest.symbol,
          direction: tradeRequest.action === 'BUY' ? 'LONG' : 'SHORT',
          quantity: tradeRequest.quantity,
          entryPrice: tradeRequest.price,
          stopLoss: tradeRequest.stopLoss || tradeRequest.price * 0.98, // Default 2% stop loss
          target: tradeRequest.target || tradeRequest.price * 1.05, // Default 5% target
          brokerOrderId: orderResponse.brokerOrderId,
          broker: 'KOTAK_NEO',
          status: 'PENDING', // Will be updated when order fills
          currentPrice: tradeRequest.price,
          unrealizedPnL: 0,
        },
      });

      this.logger.log(
        `Live trade stored: ${liveTrade.id} with broker order ID: ${orderResponse.brokerOrderId}`
      );

      // Return success result
      return {
        tradeId: liveTrade.id,
        status: 'PENDING',
        brokerOrderId: orderResponse.brokerOrderId,
        error: undefined,
      };
    } catch (error: any) {
      this.logger.error(`Failed to execute live trade: ${error.message}`, error.stack);

      // Log failed Broker API call (Requirement 18.6)
      await this.auditLogService.logBrokerCall(
        'place_order',
        userId,
        {
          symbol: tradeRequest.symbol,
          action: tradeRequest.action,
        },
        false,
        error.message
      );

      return {
        tradeId: '',
        status: 'FAILED',
        error: `Failed to execute live trade: ${error.message}`,
      };
    }
  }

  /**
   * Check if AI service has access to this trading service
   * This method is for testing architectural constraints
   *
   * @returns false - AI should NEVER have direct access to TradingService
   */
  canAIAccessDirectly(): boolean {
    // This method exists to document the architectural constraint
    // AI service should NOT inject TradingService
    return false;
  }

  /**
   * Execute a paper trade for options (Task 73.3)
   *
   * This method implements paper trading for options with:
   * 1. Symbol validation (NIFTY/BANKNIFTY only)
   * 2. Options-specific risk validation
   * 3. Paper trade execution via PaperTradingService
   * 4. Audit logging for all trades
   *
   * Requirements covered:
   * - 9.1: Execute paper trades via PaperTradingService
   * - 10.1: Options paper trading only (no live trading)
   * - 18.2: Log trade execution in AuditLog
   */
  async executePaperOptionTrade(
    userId: string,
    request: {
      symbol: string;
      strikePrice: number;
      optionType: 'CALL' | 'PUT';
      expiry: string;
      action: 'BUY' | 'SELL';
      quantity: number;
      price: number;
      stopLoss?: number;
      target?: number;
      signalId?: string;
    }
  ): Promise<TradeResult> {
    this.logger.log(
      `Executing paper option trade: ${request.action} ${request.quantity} ${request.symbol} ${request.strikePrice} ${request.optionType} exp:${request.expiry}`
    );

    // Validate symbol (NIFTY/BANKNIFTY only)
    if (!['NIFTY', 'BANKNIFTY'].includes(request.symbol)) {
      const errorMsg = `Invalid symbol: ${request.symbol}. Only NIFTY and BANKNIFTY options are supported.`;
      this.logger.error(errorMsg);

      await this.auditLogService.log({
        userId,
        service: 'trading',
        action: 'paper_option_trade',
        entityType: 'option',
        entityId: `${request.symbol}_${request.strikePrice}_${request.optionType}`,
        payload: request,
        success: false,
        error: errorMsg,
      });

      return {
        tradeId: '',
        status: 'FAILED',
        error: errorMsg,
      };
    }

    // Build trade request for risk validation
    const assetType = request.optionType === 'CALL' ? 'OPTION_CALL' : 'OPTION_PUT';
    
    const tradeRequest: TradeRequest = {
      symbol: request.symbol,
      action: request.action,
      quantity: request.quantity,
      price: request.price,
      stopLoss: request.stopLoss,
      target: request.target,
      assetType,
    };

    // Validate with Risk Engine (options-specific rules from Task 71.1)
    const validation = await this.riskService.validateTrade(userId, tradeRequest);

    if (!validation.passed) {
      const errorMsg = `Options risk validation failed: ${validation.violations.map((v) => v.message).join(', ')}`;
      this.logger.warn(errorMsg);

      await this.auditLogService.log({
        userId,
        service: 'trading',
        action: 'paper_option_trade',
        entityType: 'option',
        entityId: `${request.symbol}_${request.strikePrice}_${request.optionType}`,
        payload: request,
        success: false,
        error: errorMsg,
      });

      return {
        tradeId: '',
        status: 'FAILED',
        error: errorMsg,
      };
    }

    // Execute paper trade via PaperTradingService
    const result = await this.paperTradingService.executePaperOptionTrade(
      userId,
      {
        symbol: request.symbol,
        strikePrice: request.strikePrice,
        optionType: request.optionType,
        expiry: new Date(request.expiry),
        action: request.action,
        quantity: request.quantity,
        price: request.price,
        stopLoss: request.stopLoss,
        target: request.target,
      },
      request.signalId
    );

    // Log successful trade execution in AuditLog
    await this.auditLogService.log({
      userId,
      service: 'trading',
      action: 'paper_option_trade',
      entityType: 'option',
      entityId: `${request.symbol}_${request.strikePrice}_${request.optionType}`,
      payload: {
        symbol: request.symbol,
        strikePrice: request.strikePrice,
        optionType: request.optionType,
        expiry: request.expiry,
        action: request.action,
        quantity: request.quantity,
        price: request.price,
      },
      result: {
        tradeId: result.tradeId,
        status: result.status,
        executedPrice: result.executedPrice,
        slippage: result.slippage,
      },
      success: result.status === 'EXECUTED',
      error: result.error,
    });

    return {
      tradeId: result.tradeId,
      status: result.status,
      executedPrice: result.executedPrice,
      slippage: result.slippage,
      positionId: result.positionId,
      error: result.error,
    };
  }
}
