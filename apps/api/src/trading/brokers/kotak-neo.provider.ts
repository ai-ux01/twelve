import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { AuditLogService } from '../../audit/audit.service';
import axios, { AxiosInstance } from 'axios';
import {
  BrokerOrder,
  BrokerPosition,
  BrokerHolding,
  BrokerTrade,
  ModifyOrderRequest,
  CancelOrderRequest,
  KotakNeoRawOrderResponse,
  KotakNeoRawPositionResponse,
  KotakNeoRawHoldingResponse,
  KotakNeoRawTradeResponse,
} from './kotak-neo.interfaces';

/**
 * Order placement request structure
 */
export interface PlaceOrderRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
  productType: 'DELIVERY' | 'INTRADAY' | 'MIS' | 'CNC';
  stopLoss?: number;
  target?: number;
}

/**
 * Order placement response from broker
 */
export interface PlaceOrderResponse {
  success: boolean;
  brokerOrderId: string;
  status: 'PENDING' | 'OPEN' | 'COMPLETE' | 'REJECTED' | 'CANCELLED';
  message: string;
  timestamp: Date;
}

/**
 * Order status response from broker
 */
export interface OrderStatusResponse {
  brokerOrderId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  filledQuantity: number;
  price: number;
  averagePrice?: number;
  status: 'PENDING' | 'OPEN' | 'COMPLETE' | 'REJECTED' | 'CANCELLED';
  orderType: string;
  productType: string;
  timestamp: Date;
  statusMessage?: string;
}

/**
 * Circuit breaker state for managing service health
 */
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number | null;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

/**
 * Kotak Neo API provider for executing live trades.
 *
 * Implements:
 * - Order placement to Kotak Neo API
 * - Order status retrieval
 * - Error handling with meaningful messages
 * - Circuit breaker pattern (5 failures → 30s cooldown)
 *
 * Requirements covered: 10.1, 10.2, 10.3, 10.4, 20.4
 *
 * CRITICAL: This provider should ONLY be called by TradingService after:
 * 1. User confirmation (userConfirmed flag)
 * 2. Risk_Engine validation
 *
 * AI_Service must NOT have access to this provider.
 */
@Injectable()
export class KotakNeoProvider {
  private readonly logger = new Logger(KotakNeoProvider.name);
  private readonly httpClient: AxiosInstance;
  private readonly circuitBreaker: CircuitBreakerState;

  // Constants
  private readonly REQUEST_TIMEOUT_MS = 15000; // 15 seconds for order placement
  private readonly MAX_RETRIES = 2; // Retry once for order placement
  private readonly INITIAL_BACKOFF_MS = 1000; // 1 second
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // 5 failures trigger circuit breaker
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 30000; // 30 seconds cooldown

  // Session token for authenticated requests (refreshable)
  private sessionToken: string | undefined;
  private isRefreshing = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService
  ) {
    // Validate required environment variables
    this.validateEnvironmentVariables();

    const apiKey = this.configService.kotakNeoConsumerKey;
    this.sessionToken = this.configService.kotakNeoSessionToken;

    // Initialize HTTP client with Kotak Neo base URL
    this.httpClient = axios.create({
      baseURL: 'https://gw-napi.kotaksecurities.com', // Kotak Neo production endpoint
      timeout: this.REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
    });

    // Initialize circuit breaker in closed state
    this.circuitBreaker = {
      failureCount: 0,
      lastFailureTime: null,
      state: 'CLOSED',
    };

    this.logger.log('KotakNeoProvider initialized');
  }

  /**
   * Validate that required Kotak Neo environment variables are present.
   * Logs warnings for missing optional credentials.
   */
  private validateEnvironmentVariables(): void {
    const consumerKey = this.configService.kotakNeoConsumerKey;
    const consumerSecret = this.configService.kotakNeoConsumerSecret;
    const accessToken = this.configService.kotakNeoAccessToken;

    if (!consumerKey) {
      this.logger.warn('KOTAK_NEO_CONSUMER_KEY is not configured. Broker API calls will fail.');
    }
    if (!consumerSecret) {
      this.logger.warn('KOTAK_NEO_CONSUMER_SECRET is not configured. Token refresh will fail.');
    }
    if (!accessToken) {
      this.logger.warn('KOTAK_NEO_ACCESS_TOKEN is not configured. Broker API calls will fail.');
    }
  }

  /**
   * Refresh the session token using stored credentials.
   * Called automatically on 401 responses.
   *
   * @returns true if refresh was successful, false otherwise
   */
  async refreshToken(): Promise<boolean> {
    if (this.isRefreshing) {
      return false;
    }

    this.isRefreshing = true;
    this.logger.log('Attempting to refresh session token...');

    try {
      const consumerKey = this.configService.kotakNeoConsumerKey;
      const consumerSecret = this.configService.kotakNeoConsumerSecret;
      const accessToken = this.configService.kotakNeoAccessToken;

      if (!consumerKey || !consumerSecret || !accessToken) {
        this.logger.error('Cannot refresh token: missing credentials');
        return false;
      }

      const response = await axios.post(
        'https://gw-napi.kotaksecurities.com/login/1.0/login/v2/validate',
        {
          userId: consumerKey,
          password: consumerSecret,
          accessToken,
        },
        { timeout: this.REQUEST_TIMEOUT_MS }
      );

      if (response.data?.token) {
        this.sessionToken = response.data.token;
        // Update the default headers with new token
        this.httpClient.defaults.headers['Authorization'] = `Bearer ${this.sessionToken}`;
        this.logger.log('Session token refreshed successfully');
        return true;
      }

      this.logger.error('Token refresh failed: no token in response');
      return false;
    } catch (error: any) {
      this.logger.error(`Token refresh failed: ${error.message}`);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Place an order with Kotak Neo broker
   *
   * @param request - Order placement request with symbol, action, quantity, price, etc.
   * @returns PlaceOrderResponse with broker order ID and status
   * @throws HttpException on authentication, validation, or broker errors
   *
   * Requirements: 10.4 (send order to Broker_API), 20.4 (circuit breaker)
   */
  async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResponse> {
    this.logger.log(
      `Placing order: ${request.action} ${request.quantity} ${request.symbol} @ ${request.price}`
    );

    // Validate request
    this.validateOrderRequest(request);

    // Check circuit breaker state
    this.checkCircuitBreaker();

    try {
      // Execute with retry (max 2 attempts for order placement)
      const response = await this.executeWithRetry(async () => {
        // Kotak Neo order placement endpoint
        // POST /Orders/2.0/quick/order/rule/ms
        const result = await this.httpClient.post('/Orders/2.0/quick/order/rule/ms', {
          am: request.action === 'BUY' ? 'YES' : 'NO', // After Market order
          es: 'nse_cm', // Exchange segment (NSE Cash Market)
          mp: '0', // Market Protection percentage
          pc: request.productType, // Product Code: CNC (Cash and Carry) or MIS (Intraday)
          pf: 'N', // Disclosed quantity flag
          pr: request.price.toString(),
          pt: this.mapOrderType(request.orderType), // Price Type (order type)
          qt: request.quantity.toString(),
          rt: 'DAY', // Retention Type
          tp: request.target?.toString() || '0', // Target Price (for bracket orders)
          ts: request.symbol, // Trading Symbol
          tt: request.stopLoss ? 'SL' : 'L', // Trigger Type
          ig: '0', // IOC/GFD
        });

        return result.data;
      });

      // Transform Kotak Neo response to our format
      const result = this.transformPlaceOrderResponse(response);

      // Mark success for circuit breaker
      this.onSuccess();

      return result;
    } catch (error) {
      // Mark failure for circuit breaker
      this.onFailure();
      this.handleError(error, 'placeOrder');
    }
  }

  /**
   * Get order status from Kotak Neo broker
   *
   * @param brokerOrderId - The order ID returned by Kotak Neo
   * @returns OrderStatusResponse with current order status and execution details
   * @throws HttpException on authentication or broker errors
   *
   * Requirements: 10.5 (receive order status from Broker_API), 20.4 (circuit breaker)
   */
  async getOrderStatus(brokerOrderId: string): Promise<OrderStatusResponse> {
    this.logger.debug(`Fetching order status for broker order ID: ${brokerOrderId}`);

    if (!brokerOrderId || brokerOrderId.trim() === '') {
      throw new HttpException('Invalid broker order ID', HttpStatus.BAD_REQUEST);
    }

    // Check circuit breaker state
    this.checkCircuitBreaker();

    try {
      // Kotak Neo order status endpoint
      // GET /Orders/2.0/quick/order/info?ono={orderNumber}
      const response = await this.httpClient.get('/Orders/2.0/quick/order/info', {
        params: {
          ono: brokerOrderId,
        },
      });

      // Transform Kotak Neo response to our format
      const result = this.transformOrderStatusResponse(response.data);

      // Mark success for circuit breaker
      this.onSuccess();

      return result;
    } catch (error) {
      // Mark failure for circuit breaker
      this.onFailure();
      this.handleError(error, 'getOrderStatus');
    }
  }

  /**
   * Validate order request before sending to broker
   */
  private validateOrderRequest(request: PlaceOrderRequest): void {
    if (!request.symbol || request.symbol.trim() === '') {
      throw new HttpException('Symbol is required', HttpStatus.BAD_REQUEST);
    }

    if (!['BUY', 'SELL'].includes(request.action)) {
      throw new HttpException('Action must be BUY or SELL', HttpStatus.BAD_REQUEST);
    }

    if (request.quantity <= 0 || !Number.isInteger(request.quantity)) {
      throw new HttpException('Quantity must be a positive integer', HttpStatus.BAD_REQUEST);
    }

    if (request.price <= 0) {
      throw new HttpException('Price must be positive', HttpStatus.BAD_REQUEST);
    }

    if (!['LIMIT', 'MARKET', 'SL', 'SL-M'].includes(request.orderType)) {
      throw new HttpException(
        'Order type must be LIMIT, MARKET, SL, or SL-M',
        HttpStatus.BAD_REQUEST
      );
    }

    if (!['DELIVERY', 'INTRADAY', 'MIS', 'CNC'].includes(request.productType)) {
      throw new HttpException(
        'Product type must be DELIVERY, INTRADAY, MIS, or CNC',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate stop loss is below entry price for BUY, above for SELL
    if (request.stopLoss) {
      if (request.action === 'BUY' && request.stopLoss >= request.price) {
        throw new HttpException(
          'Stop loss must be below entry price for BUY orders',
          HttpStatus.BAD_REQUEST
        );
      }
      if (request.action === 'SELL' && request.stopLoss <= request.price) {
        throw new HttpException(
          'Stop loss must be above entry price for SELL orders',
          HttpStatus.BAD_REQUEST
        );
      }
    }
  }

  /**
   * Map our order types to Kotak Neo price types
   */
  private mapOrderType(orderType: string): string {
    const mapping: Record<string, string> = {
      LIMIT: 'L', // Limit order
      MARKET: 'MKT', // Market order
      SL: 'SL', // Stop Loss Limit
      'SL-M': 'SL-M', // Stop Loss Market
    };
    return mapping[orderType] || 'L';
  }

  /**
   * Transform Kotak Neo place order response to our format
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformPlaceOrderResponse(kotakResponse: any): PlaceOrderResponse {
    // Kotak Neo response structure:
    // {
    //   "stat": "Ok",
    //   "nOrdNo": "240125000123456",
    //   "stCode": 200,
    //   "message": "Order placed successfully"
    // }

    const isSuccess = kotakResponse.stat === 'Ok' || kotakResponse.stCode === 200;
    const brokerOrderId = kotakResponse.nOrdNo || kotakResponse.orderId || '';
    const message = kotakResponse.message || 'Order submitted to broker';

    // Map broker status to our standard status
    let status: 'PENDING' | 'OPEN' | 'COMPLETE' | 'REJECTED' | 'CANCELLED' = 'PENDING';
    if (isSuccess) {
      status = 'OPEN'; // Order accepted by broker, awaiting execution
    } else {
      status = 'REJECTED';
    }

    return {
      success: isSuccess,
      brokerOrderId,
      status,
      message,
      timestamp: new Date(),
    };
  }

  /**
   * Transform Kotak Neo order status response to our format
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformOrderStatusResponse(kotakResponse: any): OrderStatusResponse {
    // Kotak Neo order status response structure:
    // {
    //   "orderId": "240125000123456",
    //   "tradingSymbol": "RELIANCE",
    //   "transactionType": "BUY",
    //   "quantity": 10,
    //   "filledQuantity": 10,
    //   "orderPrice": 2460.50,
    //   "averagePrice": 2460.75,
    //   "orderStatus": "COMPLETE",
    //   "orderType": "LIMIT",
    //   "productType": "CNC",
    //   "orderTimestamp": "2024-01-25T10:30:15Z",
    //   "statusMessage": "Order executed successfully"
    // }

    const orderData = kotakResponse.data || kotakResponse;

    // Map Kotak Neo status to our standard status
    const kotakStatus = orderData.orderStatus || orderData.status || 'PENDING';
    let status: 'PENDING' | 'OPEN' | 'COMPLETE' | 'REJECTED' | 'CANCELLED' = 'PENDING';

    if (kotakStatus === 'COMPLETE' || kotakStatus === 'EXECUTED') {
      status = 'COMPLETE';
    } else if (kotakStatus === 'REJECTED' || kotakStatus === 'FAILED') {
      status = 'REJECTED';
    } else if (kotakStatus === 'CANCELLED') {
      status = 'CANCELLED';
    } else if (kotakStatus === 'OPEN' || kotakStatus === 'PENDING') {
      status = 'OPEN';
    }

    return {
      brokerOrderId: orderData.orderId || orderData.nOrdNo || '',
      symbol: orderData.tradingSymbol || orderData.ts || '',
      action: (orderData.transactionType || orderData.tt || 'BUY') as 'BUY' | 'SELL',
      quantity: parseInt(orderData.quantity || orderData.qt || '0', 10),
      filledQuantity: parseInt(orderData.filledQuantity || orderData.fq || '0', 10),
      price: parseFloat(orderData.orderPrice || orderData.pr || '0'),
      averagePrice: orderData.averagePrice ? parseFloat(orderData.averagePrice) : undefined,
      status,
      orderType: orderData.orderType || orderData.pt || 'LIMIT',
      productType: orderData.productType || orderData.pc || 'CNC',
      timestamp: orderData.orderTimestamp ? new Date(orderData.orderTimestamp) : new Date(),
      statusMessage: orderData.statusMessage || orderData.message,
    };
  }

  /**
   * Execute a function with exponential backoff retry logic
   * Only retries once for order placement (total 2 attempts)
   */
  private async executeWithRetry<T>(operation: () => Promise<T>, attempt: number = 1): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.MAX_RETRIES) {
        this.logger.error(`Max retry attempts (${this.MAX_RETRIES}) reached, failing operation`);
        throw error;
      }

      // Only retry on network errors, not on validation or authentication errors
      if (this.isRetryableError(error)) {
        const delayMs = this.INITIAL_BACKOFF_MS * attempt;
        this.logger.warn(
          `Attempt ${attempt} failed, retrying in ${delayMs}ms... (${this.MAX_RETRIES - attempt} retries remaining)`
        );

        await this.sleep(delayMs);
        return this.executeWithRetry(operation, attempt + 1);
      }

      // Non-retryable error, throw immediately
      throw error;
    }
  }

  /**
   * Determine if an error is retryable (network issues, timeouts)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isRetryableError(error: any): boolean {
    // Network errors without response (timeout, connection refused, etc.)
    if (error.isAxiosError && !error.response) {
      return true;
    }

    // Check if we have a response with status code
    if (error.isAxiosError && error.response && error.response.status) {
      const status = error.response.status;

      // 401 is retryable after token refresh
      if (status === 401) {
        return true;
      }

      // Don't retry on 403 or validation errors (400)
      if (status === 403 || status === 400) {
        return false;
      }

      // Retry on server errors (500+)
      if (status >= 500) {
        return true;
      }

      // Don't retry on other client errors (4xx)
      if (status >= 400 && status < 500) {
        return false;
      }
    }

    return false;
  }

  /**
   * Execute with retry, including automatic token refresh on 401
   */
  private async executeWithRetryAndAuth<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.executeWithRetry(operation);
    } catch (error: any) {
      // On 401, attempt token refresh and retry once
      if (error.isAxiosError && error.response?.status === 401) {
        this.logger.warn('Received 401, attempting token refresh...');
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return await operation();
        }
      }
      throw error;
    }
  }

  /**
   * Handle errors and throw appropriate HTTP exceptions
   *
   * Requirements: 10.4 (handle broker API errors and return meaningful error messages)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleError(error: any, context: string): never {
    // Check if this is an axios error with a response (server responded with error)
    if (error.isAxiosError && error.response && error.response.status) {
      const status = error.response.status;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responseData = error.response.data as any;
      const message = responseData?.message || responseData?.errMsg || error.message;

      this.logger.error(`${context} failed: ${message}`, error.stack);

      // Handle specific error codes
      if (status === 401 || status === 403) {
        throw new HttpException(
          'Kotak Neo authentication failed. Check API credentials.',
          HttpStatus.UNAUTHORIZED
        );
      }

      if (status === 400) {
        throw new HttpException(`Invalid order request: ${message}`, HttpStatus.BAD_REQUEST);
      }

      if (status === 429) {
        throw new HttpException(
          'Kotak Neo rate limit exceeded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      if (status >= 500) {
        throw new HttpException(
          `Broker service temporarily unavailable: ${message}`,
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      throw new HttpException(`Broker API error: ${message}`, status);
    }

    // Network errors (no response from server - timeouts, connection issues)
    this.logger.error(`${context} failed: ${error.message}`, error.stack);
    throw new HttpException(
      'Failed to communicate with broker. Please try again.',
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check circuit breaker state before making requests
   */
  private checkCircuitBreaker(): void {
    if (this.circuitBreaker.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - (this.circuitBreaker.lastFailureTime || 0);

      if (timeSinceLastFailure >= this.CIRCUIT_BREAKER_TIMEOUT_MS) {
        // Transition to HALF_OPEN state after timeout
        this.logger.log('Circuit breaker transitioning to HALF_OPEN state');
        this.circuitBreaker.state = 'HALF_OPEN';
      } else {
        const remainingMs = this.CIRCUIT_BREAKER_TIMEOUT_MS - timeSinceLastFailure;
        throw new HttpException(
          `Circuit breaker is OPEN. Broker API unavailable for ${Math.ceil(remainingMs / 1000)}s`,
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
    }
  }

  /**
   * Handle successful request - reset circuit breaker if needed
   */
  private onSuccess(): void {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.logger.log('Circuit breaker transitioning to CLOSED state after successful request');
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.lastFailureTime = null;
    }
    // Don't reset failure count in CLOSED state - only consecutive failures matter
  }

  /**
   * Handle failed request - increment failure count and open circuit if threshold reached
   */
  private onFailure(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.logger.error(
        `Circuit breaker threshold (${this.CIRCUIT_BREAKER_THRESHOLD}) reached. Opening circuit for ${this.CIRCUIT_BREAKER_TIMEOUT_MS / 1000}s`
      );
      this.circuitBreaker.state = 'OPEN';
    } else {
      this.logger.warn(
        `Failure count: ${this.circuitBreaker.failureCount}/${this.CIRCUIT_BREAKER_THRESHOLD}`
      );
    }
  }

  /**
   * Get current circuit breaker state (for monitoring/debugging)
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  /**
   * Reset circuit breaker (for testing or manual recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.failureCount = 0;
    this.circuitBreaker.lastFailureTime = null;
    this.circuitBreaker.state = 'CLOSED';
    this.logger.log('Circuit breaker manually reset to CLOSED state');
  }

  // ============ Read Operations (Task 3) ============

  /**
   * Get all orders from Kotak Neo order book
   *
   * @returns Array of standardized BrokerOrder objects
   * @throws HttpException on authentication or broker errors
   */
  async getOrders(): Promise<BrokerOrder[]> {
    this.logger.debug('Fetching order book from Kotak Neo');
    this.checkCircuitBreaker();

    const startTime = Date.now();

    try {
      const response = await this.executeWithRetryAndAuth(async () => {
        const result = await this.httpClient.get('/Orders/2.0/quick/user/orders');
        return result.data;
      });

      this.onSuccess();

      const orders = this.transformOrdersResponse(response);

      // Audit log
      await this.auditLogService.logBrokerCall(
        'get_orders',
        'system',
        {},
        true,
        undefined,
        { count: orders.length, latencyMs: Date.now() - startTime }
      );

      return orders;
    } catch (error) {
      this.onFailure();
      await this.auditLogService.logBrokerCall(
        'get_orders',
        'system',
        {},
        false,
        (error as any).message,
        { latencyMs: Date.now() - startTime }
      );
      this.handleError(error, 'getOrders');
    }
  }

  /**
   * Get all positions from Kotak Neo
   *
   * @returns Array of standardized BrokerPosition objects
   */
  async getPositions(): Promise<BrokerPosition[]> {
    this.logger.debug('Fetching positions from Kotak Neo');
    this.checkCircuitBreaker();

    const startTime = Date.now();

    try {
      const response = await this.executeWithRetryAndAuth(async () => {
        const result = await this.httpClient.get('/Orders/2.0/quick/user/positions');
        return result.data;
      });

      this.onSuccess();

      const positions = this.transformPositionsResponse(response);

      await this.auditLogService.logBrokerCall(
        'get_positions',
        'system',
        {},
        true,
        undefined,
        { count: positions.length, latencyMs: Date.now() - startTime }
      );

      return positions;
    } catch (error) {
      this.onFailure();
      await this.auditLogService.logBrokerCall(
        'get_positions',
        'system',
        {},
        false,
        (error as any).message,
        { latencyMs: Date.now() - startTime }
      );
      this.handleError(error, 'getPositions');
    }
  }

  /**
   * Get all holdings from Kotak Neo
   *
   * @returns Array of standardized BrokerHolding objects
   */
  async getHoldings(): Promise<BrokerHolding[]> {
    this.logger.debug('Fetching holdings from Kotak Neo');
    this.checkCircuitBreaker();

    const startTime = Date.now();

    try {
      const response = await this.executeWithRetryAndAuth(async () => {
        const result = await this.httpClient.get('/Orders/2.0/quick/user/holdings');
        return result.data;
      });

      this.onSuccess();

      const holdings = this.transformHoldingsResponse(response);

      await this.auditLogService.logBrokerCall(
        'get_holdings',
        'system',
        {},
        true,
        undefined,
        { count: holdings.length, latencyMs: Date.now() - startTime }
      );

      return holdings;
    } catch (error) {
      this.onFailure();
      await this.auditLogService.logBrokerCall(
        'get_holdings',
        'system',
        {},
        false,
        (error as any).message,
        { latencyMs: Date.now() - startTime }
      );
      this.handleError(error, 'getHoldings');
    }
  }

  /**
   * Get all trades from Kotak Neo trade book
   *
   * @returns Array of standardized BrokerTrade objects
   */
  async getTrades(): Promise<BrokerTrade[]> {
    this.logger.debug('Fetching trade book from Kotak Neo');
    this.checkCircuitBreaker();

    const startTime = Date.now();

    try {
      const response = await this.executeWithRetryAndAuth(async () => {
        const result = await this.httpClient.get('/Orders/2.0/quick/user/trades');
        return result.data;
      });

      this.onSuccess();

      const trades = this.transformTradesResponse(response);

      await this.auditLogService.logBrokerCall(
        'get_trades',
        'system',
        {},
        true,
        undefined,
        { count: trades.length, latencyMs: Date.now() - startTime }
      );

      return trades;
    } catch (error) {
      this.onFailure();
      await this.auditLogService.logBrokerCall(
        'get_trades',
        'system',
        {},
        false,
        (error as any).message,
        { latencyMs: Date.now() - startTime }
      );
      this.handleError(error, 'getTrades');
    }
  }

  // ============ Modify and Cancel Operations (Task 4) ============

  /**
   * Modify an existing order with Kotak Neo
   *
   * @param request - Modification request with brokerOrderId and new parameters
   * @returns Updated BrokerOrder
   * @throws HttpException if order cannot be modified (already executed/cancelled)
   */
  async modifyOrder(request: ModifyOrderRequest): Promise<BrokerOrder> {
    this.logger.log(`Modifying order: ${request.brokerOrderId}`);
    this.checkCircuitBreaker();

    if (!request.brokerOrderId || request.brokerOrderId.trim() === '') {
      throw new HttpException('Broker order ID is required', HttpStatus.BAD_REQUEST);
    }

    const startTime = Date.now();

    try {
      const response = await this.executeWithRetryAndAuth(async () => {
        const result = await this.httpClient.post('/Orders/2.0/quick/order/modify', {
          nOrdNo: request.brokerOrderId,
          pr: request.price?.toString(),
          qt: request.quantity?.toString(),
          pt: request.orderType ? this.mapOrderType(request.orderType) : undefined,
          tp: request.triggerPrice?.toString(),
        });
        return result.data;
      });

      this.onSuccess();

      const order = this.transformSingleOrderResponse(response);

      await this.auditLogService.logBrokerCall(
        'modify_order',
        'system',
        { ...request },
        true,
        undefined,
        { latencyMs: Date.now() - startTime }
      );

      return order;
    } catch (error: any) {
      this.onFailure();

      // Check for already-executed or already-cancelled errors
      const message = error.response?.data?.message || error.message || '';
      if (
        message.toLowerCase().includes('already executed') ||
        message.toLowerCase().includes('already cancelled') ||
        message.toLowerCase().includes('cannot modify')
      ) {
        await this.auditLogService.logBrokerCall(
          'modify_order',
          'system',
          { brokerOrderId: request.brokerOrderId },
          false,
          `Order cannot be modified: ${message}`,
          { latencyMs: Date.now() - startTime }
        );
        throw new HttpException(
          `Order cannot be modified: ${message}`,
          HttpStatus.CONFLICT
        );
      }

      await this.auditLogService.logBrokerCall(
        'modify_order',
        'system',
        { brokerOrderId: request.brokerOrderId },
        false,
        error.message,
        { latencyMs: Date.now() - startTime }
      );
      this.handleError(error, 'modifyOrder');
    }
  }

  /**
   * Cancel an existing order with Kotak Neo
   *
   * @param request - Cancellation request with brokerOrderId
   * @returns Updated BrokerOrder with cancelled status
   * @throws HttpException if order cannot be cancelled (already executed/cancelled)
   */
  async cancelOrder(request: CancelOrderRequest): Promise<BrokerOrder> {
    this.logger.log(`Cancelling order: ${request.brokerOrderId}`);
    this.checkCircuitBreaker();

    if (!request.brokerOrderId || request.brokerOrderId.trim() === '') {
      throw new HttpException('Broker order ID is required', HttpStatus.BAD_REQUEST);
    }

    const startTime = Date.now();

    try {
      const response = await this.executeWithRetryAndAuth(async () => {
        const result = await this.httpClient.post('/Orders/2.0/quick/order/cancel', {
          nOrdNo: request.brokerOrderId,
        });
        return result.data;
      });

      this.onSuccess();

      const order = this.transformSingleOrderResponse(response);

      await this.auditLogService.logBrokerCall(
        'cancel_order',
        'system',
        { brokerOrderId: request.brokerOrderId },
        true,
        undefined,
        { latencyMs: Date.now() - startTime }
      );

      return order;
    } catch (error: any) {
      this.onFailure();

      // Check for already-executed or already-cancelled errors
      const message = error.response?.data?.message || error.message || '';
      if (
        message.toLowerCase().includes('already executed') ||
        message.toLowerCase().includes('already cancelled') ||
        message.toLowerCase().includes('cannot cancel')
      ) {
        await this.auditLogService.logBrokerCall(
          'cancel_order',
          'system',
          { brokerOrderId: request.brokerOrderId },
          false,
          `Order cannot be cancelled: ${message}`,
          { latencyMs: Date.now() - startTime }
        );
        throw new HttpException(
          `Order cannot be cancelled: ${message}`,
          HttpStatus.CONFLICT
        );
      }

      await this.auditLogService.logBrokerCall(
        'cancel_order',
        'system',
        { brokerOrderId: request.brokerOrderId },
        false,
        error.message,
        { latencyMs: Date.now() - startTime }
      );
      this.handleError(error, 'cancelOrder');
    }
  }

  // ============ Response Transformation Helpers ============

  /**
   * Transform Kotak Neo orders list response to BrokerOrder[]
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformOrdersResponse(response: any): BrokerOrder[] {
    const orders = response?.data || response?.orders || response || [];

    if (!Array.isArray(orders)) {
      return [];
    }

    return orders.map((order: KotakNeoRawOrderResponse) => this.mapRawToBrokerOrder(order));
  }

  /**
   * Transform single order response to BrokerOrder
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformSingleOrderResponse(response: any): BrokerOrder {
    const orderData = response?.data || response;
    return this.mapRawToBrokerOrder(orderData);
  }

  /**
   * Map a raw Kotak Neo order to standardized BrokerOrder
   */
  private mapRawToBrokerOrder(raw: KotakNeoRawOrderResponse): BrokerOrder {
    const symbol = raw.tradingSymbol || raw.ts || '';
    const action = (raw.transactionType || raw.tt || 'BUY').toUpperCase() as 'BUY' | 'SELL';
    const quantity = parseInt(raw.quantity || raw.qt || '0', 10);
    const filledQuantity = parseInt(raw.filledQuantity || raw.fq || '0', 10);
    const price = parseFloat(raw.orderPrice || raw.pr || '0');
    const averagePrice = raw.averagePrice ? parseFloat(raw.averagePrice) : undefined;
    const orderType = this.mapToStandardOrderType(raw.orderType || raw.pt || 'L');
    const productType = this.mapToStandardProductType(raw.productType || raw.pc || 'CNC');
    const status = this.mapToStandardStatus(raw.orderStatus || raw.status || 'PENDING');

    return {
      brokerOrderId: raw.nOrdNo || raw.orderId || '',
      symbol,
      action,
      quantity,
      filledQuantity,
      price,
      averagePrice,
      status,
      orderType,
      productType,
      timestamp: raw.orderTimestamp ? new Date(raw.orderTimestamp) : new Date(),
      statusMessage: raw.statusMessage || raw.message,
    };
  }

  /**
   * Transform Kotak Neo positions response to BrokerPosition[]
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformPositionsResponse(response: any): BrokerPosition[] {
    const positions = response?.data || response?.positions || response || [];

    if (!Array.isArray(positions)) {
      return [];
    }

    return positions.map((pos: KotakNeoRawPositionResponse) => ({
      symbol: pos.tradingSymbol || pos.ts || '',
      quantity: parseInt(pos.netQuantity || pos.nq || '0', 10),
      averagePrice: parseFloat(pos.averagePrice || pos.ap || '0'),
      currentPrice: parseFloat(pos.lastTradedPrice || pos.ltp || '0'),
      pnl: parseFloat(pos.pnl || '0'),
      productType: this.mapToStandardProductType(pos.productType || pos.pc || 'CNC'),
      exchange: pos.exchange || pos.es || 'NSE',
    }));
  }

  /**
   * Transform Kotak Neo holdings response to BrokerHolding[]
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformHoldingsResponse(response: any): BrokerHolding[] {
    const holdings = response?.data || response?.holdings || response || [];

    if (!Array.isArray(holdings)) {
      return [];
    }

    return holdings.map((holding: KotakNeoRawHoldingResponse) => {
      const quantity = parseInt(holding.quantity || holding.qt || '0', 10);
      const averagePrice = parseFloat(holding.averagePrice || holding.ap || '0');
      const ltp = parseFloat(holding.lastTradedPrice || holding.ltp || '0');
      const currentValue = quantity * ltp;
      const pnl = holding.pnl ? parseFloat(holding.pnl) : currentValue - quantity * averagePrice;

      return {
        symbol: holding.tradingSymbol || holding.ts || '',
        quantity,
        averagePrice,
        currentValue,
        pnl,
        isin: holding.isin || '',
      };
    });
  }

  /**
   * Transform Kotak Neo trades response to BrokerTrade[]
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformTradesResponse(response: any): BrokerTrade[] {
    const trades = response?.data || response?.trades || response || [];

    if (!Array.isArray(trades)) {
      return [];
    }

    return trades.map((trade: KotakNeoRawTradeResponse) => ({
      tradeId: trade.tradeId || trade.tid || '',
      brokerOrderId: trade.orderId || trade.nOrdNo || '',
      symbol: trade.tradingSymbol || trade.ts || '',
      action: (trade.transactionType || trade.tt || 'BUY').toUpperCase() as 'BUY' | 'SELL',
      quantity: parseInt(trade.quantity || trade.qt || '0', 10),
      price: parseFloat(trade.tradePrice || trade.tp || '0'),
      timestamp: trade.tradeTimestamp ? new Date(trade.tradeTimestamp) : new Date(),
      exchange: trade.exchange || trade.es || 'NSE',
    }));
  }

  /**
   * Map Kotak Neo order type code to standard order type
   */
  private mapToStandardOrderType(kotakType: string): 'LIMIT' | 'MARKET' | 'SL' | 'SL-M' {
    const mapping: Record<string, 'LIMIT' | 'MARKET' | 'SL' | 'SL-M'> = {
      L: 'LIMIT',
      LIMIT: 'LIMIT',
      MKT: 'MARKET',
      MARKET: 'MARKET',
      SL: 'SL',
      'SL-M': 'SL-M',
    };
    return mapping[kotakType.toUpperCase()] || 'LIMIT';
  }

  /**
   * Map Kotak Neo product type code to standard product type
   */
  private mapToStandardProductType(
    kotakType: string
  ): 'DELIVERY' | 'INTRADAY' | 'MIS' | 'CNC' {
    const mapping: Record<string, 'DELIVERY' | 'INTRADAY' | 'MIS' | 'CNC'> = {
      CNC: 'CNC',
      DELIVERY: 'DELIVERY',
      MIS: 'MIS',
      INTRADAY: 'INTRADAY',
      NRML: 'DELIVERY',
    };
    return mapping[kotakType.toUpperCase()] || 'CNC';
  }

  /**
   * Map Kotak Neo status string to standard status
   */
  private mapToStandardStatus(
    kotakStatus: string
  ): 'PENDING' | 'OPEN' | 'COMPLETE' | 'REJECTED' | 'CANCELLED' {
    const upperStatus = kotakStatus.toUpperCase();
    if (upperStatus === 'COMPLETE' || upperStatus === 'EXECUTED') return 'COMPLETE';
    if (upperStatus === 'REJECTED' || upperStatus === 'FAILED') return 'REJECTED';
    if (upperStatus === 'CANCELLED') return 'CANCELLED';
    if (upperStatus === 'OPEN' || upperStatus === 'TRIGGER_PENDING') return 'OPEN';
    return 'PENDING';
  }

  /**
   * Check if the provider is properly authenticated
   */
  isAuthenticated(): boolean {
    return !!this.sessionToken;
  }
}
