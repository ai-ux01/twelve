import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import axios, { AxiosInstance } from 'axios';

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

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.kotakApiKey;

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

      // Don't retry on authentication (401, 403) or validation errors (400)
      if (status === 401 || status === 403 || status === 400) {
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
}
