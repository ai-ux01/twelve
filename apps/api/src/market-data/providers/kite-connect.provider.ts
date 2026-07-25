import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { OHLCVData } from '../market-data.service';

/**
 * Options chain data structure for NIFTY/BANKNIFTY
 */
export interface OptionsChainData {
  strike: number;
  expiryDate: string;
  callOI: number;
  putOI: number;
  callVolume: number;
  putVolume: number;
  callLTP: number;
  putLTP: number;
}

export interface OptionsChainResponse {
  underlying: string;
  spotPrice: number;
  expiryDates: string[];
  chain: OptionsChainData[];
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
 * Kite Connect API provider for fetching NSE market data.
 * Implements:
 * - Retry with exponential backoff (max 3 attempts)
 * - Circuit breaker pattern (5 failures → 30s cooldown)
 *
 * Requirements covered: 2.1, 2.2, 2.3, 2.4, 20.1
 */
@Injectable()
export class KiteConnectProvider {
  private readonly logger = new Logger(KiteConnectProvider.name);
  private readonly httpClient: AxiosInstance;
  private readonly circuitBreaker: CircuitBreakerState;

  // Constants for retry and circuit breaker
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_BACKOFF_MS = 1000; // 1 second
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 30000; // 30 seconds
  private readonly REQUEST_TIMEOUT_MS = 10000; // 10 seconds

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.kiteApiKey;

    // Initialize HTTP client with Kite Connect base URL
    this.httpClient = axios.create({
      baseURL: 'https://api.kite.trade',
      timeout: this.REQUEST_TIMEOUT_MS,
      headers: {
        'X-Kite-Version': '3',
        ...(apiKey && { Authorization: `token ${apiKey}` }),
      },
    });

    // Initialize circuit breaker in closed state
    this.circuitBreaker = {
      failureCount: 0,
      lastFailureTime: null,
      state: 'CLOSED',
    };

    this.logger.log('KiteConnectProvider initialized');
  }

  /**
   * Fetch OHLCV data for a given NSE symbol with retry and circuit breaker
   */
  async fetchOHLCV(
    symbol: string,
    interval: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<OHLCVData[]> {
    this.logger.debug(`Fetching OHLCV data for ${symbol} (${interval})`);

    // Check circuit breaker state
    this.checkCircuitBreaker();

    try {
      const data = await this.executeWithRetry<OHLCVData[]>(async () => {
        // Kite Connect uses instrument tokens, for now we'll use a placeholder approach
        // In production, you'd need to maintain a symbol-to-token mapping
        const instrumentToken = this.getInstrumentToken(symbol);

        const params: any = {
          instrument_token: instrumentToken,
          interval,
        };

        if (fromDate) {
          params.from = fromDate.toISOString().split('T')[0];
        }
        if (toDate) {
          params.to = toDate.toISOString().split('T')[0];
        }

        // Kite Connect historical data endpoint
        const response = await this.httpClient.get('/instruments/historical', {
          params,
        });

        // Transform Kite Connect response to our OHLCV format
        return this.transformOHLCVResponse(response.data);
      });

      this.onSuccess();
      return data;
    } catch (error) {
      this.onFailure();
      this.handleError(error, `fetchOHLCV for ${symbol}`);
    }
  }

  /**
   * Fetch options chain for NIFTY or BANKNIFTY with retry and circuit breaker
   */
  async fetchOptionsChain(
    underlying: 'NIFTY' | 'BANKNIFTY',
    expiryDate?: string
  ): Promise<OptionsChainResponse> {
    this.logger.debug(`Fetching options chain for ${underlying}`);

    // Check circuit breaker state
    this.checkCircuitBreaker();

    try {
      const data = await this.executeWithRetry<OptionsChainResponse>(async () => {
        // Kite Connect options chain endpoint
        const response = await this.httpClient.get(`/quote/ohlc`, {
          params: {
            i: this.getOptionsInstrumentList(underlying, expiryDate),
          },
        });

        // Transform response to options chain format
        return this.transformOptionsChainResponse(response.data, underlying);
      });

      this.onSuccess();
      return data;
    } catch (error) {
      this.onFailure();
      this.handleError(error, `fetchOptionsChain for ${underlying}`);
    }
  }

  /**
   * Execute a function with exponential backoff retry logic
   */
  private async executeWithRetry<T>(operation: () => Promise<T>, attempt: number = 1): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.MAX_RETRIES) {
        this.logger.error(`Max retry attempts (${this.MAX_RETRIES}) reached, failing operation`);
        throw error;
      }

      // Calculate exponential backoff delay: 1s, 2s, 4s
      const delayMs = this.INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      this.logger.warn(
        `Attempt ${attempt} failed, retrying in ${delayMs}ms... (${this.MAX_RETRIES - attempt} retries remaining)`
      );

      await this.sleep(delayMs);
      return this.executeWithRetry(operation, attempt + 1);
    }
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
          `Circuit breaker is OPEN. Service unavailable for ${Math.ceil(remainingMs / 1000)}s`,
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
   * Handle errors and throw appropriate HTTP exceptions
   */
  private handleError(error: any, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = axiosError.response?.data || axiosError.message;

      this.logger.error(`${context} failed: ${message}`, axiosError.stack);

      if (status === 401 || status === 403) {
        throw new HttpException(
          'Kite Connect authentication failed. Check API credentials.',
          HttpStatus.UNAUTHORIZED
        );
      }

      if (status === 429) {
        throw new HttpException(
          'Kite Connect rate limit exceeded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      throw new HttpException(`Market data provider error: ${message}`, status);
    }

    this.logger.error(`${context} failed: ${error.message}`, error.stack);
    throw new HttpException('Market data provider unavailable', HttpStatus.SERVICE_UNAVAILABLE);
  }

  /**
   * Transform Kite Connect OHLCV response to our format
   */
  private transformOHLCVResponse(kiteData: any): OHLCVData[] {
    if (!kiteData || !kiteData.data || !kiteData.data.candles) {
      return [];
    }

    return kiteData.data.candles.map((candle: any[]) => ({
      timestamp: new Date(candle[0]),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
    }));
  }

  /**
   * Transform Kite Connect options response to our options chain format
   */
  private transformOptionsChainResponse(kiteData: any, underlying: string): OptionsChainResponse {
    // This is a placeholder implementation
    // In production, you'd parse the actual Kite Connect options data
    // which requires complex parsing of multiple instrument quotes

    return {
      underlying,
      spotPrice: 0, // Extract from underlying index quote
      expiryDates: [],
      chain: [],
    };
  }

  /**
   * Get instrument token for a given NSE symbol
   * In production, this would query a database or cache of instruments
   */
  private getInstrumentToken(symbol: string): string {
    // Placeholder implementation
    // In production, maintain a mapping of symbols to instrument tokens
    // This mapping can be fetched from Kite Connect instruments API
    this.logger.warn(
      `Using placeholder instrument token for ${symbol}. Implement proper symbol-to-token mapping.`
    );
    return `NSE:${symbol}`;
  }

  /**
   * Get list of option instruments for the given underlying
   * In production, this would build a list of all relevant option contracts
   */
  private getOptionsInstrumentList(underlying: string, expiryDate?: string): string {
    // Placeholder implementation
    // In production, build a list of option instrument tokens based on:
    // - Current spot price
    // - Relevant strikes (ATM ± 10 strikes)
    // - Expiry date
    this.logger.warn(
      `Using placeholder options instrument list for ${underlying}. Implement proper options chain construction.`
    );
    return `NFO:${underlying}`;
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
