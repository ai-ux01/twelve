import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { KotakNeoProvider } from './brokers/kotak-neo.provider';
import { KillSwitchService } from './kill-switch/kill-switch.service';
import { TradingService } from './trading.service';
import { AuditLogService } from '../audit/audit.service';
import {
  BrokerOrder,
  BrokerPosition,
  BrokerHolding,
  BrokerTrade,
  KillSwitchState,
} from './brokers/kotak-neo.interfaces';

// ============ DTOs ============

class ToggleKillSwitchDto {
  userId!: string;
  enabled?: boolean;
}

class PlaceOrderDto {
  symbol!: string;
  action!: 'BUY' | 'SELL';
  quantity!: number;
  price!: number;
  orderType!: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
  productType!: 'DELIVERY' | 'INTRADAY' | 'MIS' | 'CNC';
  exchange?: string;
  triggerPrice?: number;
  userConfirmed!: boolean;
  userId!: string;
  stopLoss?: number;
  target?: number;
}

class ModifyOrderDto {
  price?: number;
  quantity?: number;
  orderType?: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
  triggerPrice?: number;
}

/**
 * LiveTradingController - REST endpoints for live broker trading operations
 *
 * Safety gates applied at controller level (defense in depth):
 * - Kill switch check before ANY broker mutation
 * - User confirmation required for order placement
 * - All operations audit-logged
 *
 * Route prefix: /api/live-trading
 */
@Controller('api/live-trading')
export class LiveTradingController {
  private readonly logger = new Logger(LiveTradingController.name);

  constructor(
    private readonly kotakNeoProvider: KotakNeoProvider,
    private readonly killSwitchService: KillSwitchService,
    private readonly tradingService: TradingService,
    private readonly auditLogService: AuditLogService
  ) {}

  // ============ Status Endpoints ============

  /**
   * GET /api/live-trading/status
   * Returns authentication state and circuit breaker state
   */
  @Get('status')
  getStatus(): any {
    const circuitBreakerState = this.kotakNeoProvider.getCircuitBreakerState();
    const isAuthenticated = this.kotakNeoProvider.isAuthenticated();
    const killSwitchState = this.killSwitchService.getState();

    return {
      authenticated: isAuthenticated,
      circuitBreaker: circuitBreakerState,
      killSwitch: killSwitchState,
      liveTradingAllowed: this.killSwitchService.isLiveTradingAllowed(),
    };
  }

  /**
   * GET /api/live-trading/kill-switch
   * Returns current kill switch state
   */
  @Get('kill-switch')
  getKillSwitch(): KillSwitchState {
    return this.killSwitchService.getState();
  }

  /**
   * POST /api/live-trading/kill-switch/toggle
   * Toggle the kill switch state
   */
  @Post('kill-switch/toggle')
  async toggleKillSwitch(@Body() body: ToggleKillSwitchDto): Promise<KillSwitchState> {
    if (!body.userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    // If enabled is not specified, toggle the current state
    const currentState = this.killSwitchService.getState();
    const newEnabled = body.enabled !== undefined ? body.enabled : !currentState.enabled;

    return this.killSwitchService.toggle(body.userId, newEnabled);
  }

  // ============ Read Endpoints ============

  /**
   * GET /api/live-trading/orders
   * Get all orders from broker
   */
  @Get('orders')
  async getOrders(): Promise<BrokerOrder[]> {
    return this.kotakNeoProvider.getOrders();
  }

  /**
   * GET /api/live-trading/positions
   * Get all positions from broker
   */
  @Get('positions')
  async getPositions(): Promise<BrokerPosition[]> {
    return this.kotakNeoProvider.getPositions();
  }

  /**
   * GET /api/live-trading/holdings
   * Get all holdings from broker
   */
  @Get('holdings')
  async getHoldings(): Promise<BrokerHolding[]> {
    return this.kotakNeoProvider.getHoldings();
  }

  /**
   * GET /api/live-trading/trades
   * Get all trades from broker
   */
  @Get('trades')
  async getTrades(): Promise<BrokerTrade[]> {
    return this.kotakNeoProvider.getTrades();
  }

  // ============ Order Mutation Endpoints ============

  /**
   * POST /api/live-trading/orders/place
   * Place a new order with full safety checks:
   * 1. Kill switch check
   * 2. User confirmation check
   * 3. Risk validation (in TradingService)
   * 4. Broker execution
   */
  @Post('orders/place')
  async placeOrder(@Body() body: PlaceOrderDto) {
    // Validate required fields
    if (!body.symbol || !body.action || !body.quantity || !body.price) {
      throw new HttpException(
        'Missing required fields: symbol, action, quantity, price',
        HttpStatus.BAD_REQUEST
      );
    }

    // SAFETY GATE 1: Kill switch check (controller level)
    if (!this.killSwitchService.isLiveTradingAllowed()) {
      this.logger.warn('Order placement rejected: Kill switch is enabled');
      throw new HttpException(
        'Live trading is disabled. Kill switch is active.',
        HttpStatus.FORBIDDEN
      );
    }

    // SAFETY GATE 2: User confirmation check (controller level)
    if (!body.userConfirmed) {
      this.logger.warn('Order placement rejected: User confirmation not provided');
      throw new HttpException(
        'User confirmation is required for live order placement',
        HttpStatus.BAD_REQUEST
      );
    }

    // Delegate to TradingService (which has its own kill switch + confirmation checks)
    const result = await this.tradingService.executeLiveTrade(
      body.userId || 'unknown',
      {
        symbol: body.symbol,
        action: body.action,
        quantity: body.quantity,
        price: body.price,
        stopLoss: body.stopLoss,
        target: body.target,
      },
      body.userConfirmed
    );

    if (result.status === 'FAILED') {
      throw new HttpException(
        result.error || 'Order placement failed',
        HttpStatus.BAD_REQUEST
      );
    }

    return result;
  }

  /**
   * POST /api/live-trading/orders/:id/modify
   * Modify an existing order with kill switch check
   */
  @Post('orders/:id/modify')
  async modifyOrder(
    @Param('id') brokerOrderId: string,
    @Body() body: ModifyOrderDto
  ): Promise<BrokerOrder> {
    // SAFETY GATE: Kill switch check
    if (!this.killSwitchService.isLiveTradingAllowed()) {
      this.logger.warn('Order modification rejected: Kill switch is enabled');
      throw new HttpException(
        'Live trading is disabled. Kill switch is active.',
        HttpStatus.FORBIDDEN
      );
    }

    return this.kotakNeoProvider.modifyOrder({
      brokerOrderId,
      price: body.price,
      quantity: body.quantity,
      orderType: body.orderType,
      triggerPrice: body.triggerPrice,
    });
  }

  /**
   * POST /api/live-trading/orders/:id/cancel
   * Cancel an existing order with kill switch check
   */
  @Post('orders/:id/cancel')
  async cancelOrder(@Param('id') brokerOrderId: string): Promise<BrokerOrder> {
    // SAFETY GATE: Kill switch check
    if (!this.killSwitchService.isLiveTradingAllowed()) {
      this.logger.warn('Order cancellation rejected: Kill switch is enabled');
      throw new HttpException(
        'Live trading is disabled. Kill switch is active.',
        HttpStatus.FORBIDDEN
      );
    }

    return this.kotakNeoProvider.cancelOrder({ brokerOrderId });
  }
}
