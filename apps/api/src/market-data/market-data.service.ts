import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { KiteConnectProvider, OptionsChainResponse } from './providers/kite-connect.provider';
import { AuditLogService } from '../audit/audit.service';

export interface OHLCVData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataResponse {
  symbol: string;
  timeframe: string;
  data: OHLCVData[];
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kiteConnectProvider: KiteConnectProvider,
    private readonly auditLogService: AuditLogService
  ) {}

  /**
   * Fetch market data for a symbol with Kite Connect provider integration
   * Implements retry with exponential backoff and circuit breaker pattern
   * Implements caching with 60-second TTL
   *
   * Requirements covered: 2.1, 2.2, 2.6
   */
  async getMarketData(
    symbol: string,
    timeframe: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<MarketDataResponse> {
    this.logger.debug(`Fetching market data for ${symbol} (${timeframe})`);

    // Check cache first - only if no date range is specified
    if (!fromDate && !toDate) {
      const cached = await this.getCachedData(symbol, timeframe);
      if (cached) {
        this.logger.debug(`Cache hit for ${symbol} (${timeframe})`);
        return cached;
      }
      this.logger.debug(`Cache miss for ${symbol} (${timeframe})`);
    }

    // Fetch from Kite Connect provider with retry and circuit breaker
    try {
      const data = await this.kiteConnectProvider.fetchOHLCV(symbol, timeframe, fromDate, toDate);

      // Log successful Market Data API call (Requirement 18.6)
      await this.auditLogService.logMarketDataCall('fetch_ohlcv', symbol, true, undefined, {
        timeframe,
        dataPoints: data.length,
      });

      // Store in cache with 60-second TTL (only if no date range specified)
      if (!fromDate && !toDate) {
        await this.cacheData(symbol, timeframe, data);
      }

      return {
        symbol,
        timeframe,
        data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed Market Data API call (Requirement 18.6)
      await this.auditLogService.logMarketDataCall('fetch_ohlcv', symbol, false, errorMessage);

      throw error;
    }
  }

  /**
   * Fetch NIFTY or BANKNIFTY options chain data
   * Implements caching with 60-second TTL
   *
   * Requirements covered: 2.3, 2.4, 2.6
   */
  async getOptionsChain(
    underlying: 'NIFTY' | 'BANKNIFTY',
    expiryDate?: string
  ): Promise<OptionsChainResponse> {
    this.logger.debug(`Fetching options chain for ${underlying}`);

    // Check cache first
    const cached = await this.getCachedOptionsChain(underlying, expiryDate);
    if (cached) {
      this.logger.debug(
        `Cache hit for options chain ${underlying}${expiryDate ? ` (${expiryDate})` : ''}`
      );
      return cached;
    }
    this.logger.debug(
      `Cache miss for options chain ${underlying}${expiryDate ? ` (${expiryDate})` : ''}`
    );

    // Fetch from Kite Connect provider with retry and circuit breaker
    try {
      const chain = await this.kiteConnectProvider.fetchOptionsChain(underlying, expiryDate);

      // Log successful Market Data API call (Requirement 18.6)
      await this.auditLogService.logMarketDataCall(
        'fetch_options_chain',
        underlying,
        true,
        undefined,
        { expiryDate, contractsCount: chain.chain.length }
      );

      // Store in cache with 60-second TTL
      await this.cacheOptionsChain(underlying, expiryDate, chain);

      return chain;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed Market Data API call (Requirement 18.6)
      await this.auditLogService.logMarketDataCall(
        'fetch_options_chain',
        underlying,
        false,
        errorMessage
      );

      throw error;
    }
  }

  /**
   * Get cached market data if available and not expired
   * Requirements covered: 2.6
   */
  private async getCachedData(
    symbol: string,
    timeframe: string
  ): Promise<MarketDataResponse | null> {
    try {
      const cached = await this.prisma.marketDataCache.findUnique({
        where: {
          symbol_timeframe_dataType: {
            symbol,
            timeframe,
            dataType: 'OHLCV',
          },
        },
      });

      if (!cached) {
        return null;
      }

      // Check if cache has expired
      const now = new Date();
      if (now > cached.expiresAt) {
        // Cache expired - delete it
        await this.prisma.marketDataCache.delete({
          where: { id: cached.id },
        });
        return null;
      }

      // Cache is valid - return the data
      return {
        symbol: cached.symbol,
        timeframe: cached.timeframe,
        data: cached.data as unknown as OHLCVData[],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error reading cache for ${symbol} (${timeframe}): ${errorMessage}`);
      return null;
    }
  }

  /**
   * Cache market data with 60-second expiration
   * Requirements covered: 2.6
   */
  private async cacheData(symbol: string, timeframe: string, data: OHLCVData[]): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 1000); // 60 seconds TTL

      await this.prisma.marketDataCache.upsert({
        where: {
          symbol_timeframe_dataType: {
            symbol,
            timeframe,
            dataType: 'OHLCV',
          },
        },
        update: {
          data: data as any,
          cachedAt: now,
          expiresAt,
        },
        create: {
          symbol,
          timeframe,
          dataType: 'OHLCV',
          data: data as any,
          cachedAt: now,
          expiresAt,
        },
      });

      this.logger.debug(
        `Cached market data for ${symbol} (${timeframe}) until ${expiresAt.toISOString()}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Log error but don't fail the request if caching fails
      this.logger.error(`Error caching data for ${symbol} (${timeframe}): ${errorMessage}`);
    }
  }

  /**
   * Get cached options chain if available and not expired
   * Requirements covered: 2.6
   */
  private async getCachedOptionsChain(
    underlying: string,
    expiryDate?: string
  ): Promise<OptionsChainResponse | null> {
    try {
      const timeframe = expiryDate || 'ALL_EXPIRIES';
      const cached = await this.prisma.marketDataCache.findUnique({
        where: {
          symbol_timeframe_dataType: {
            symbol: underlying,
            timeframe,
            dataType: 'OPTIONS_CHAIN',
          },
        },
      });

      if (!cached) {
        return null;
      }

      // Check if cache has expired
      const now = new Date();
      if (now > cached.expiresAt) {
        // Cache expired - delete it
        await this.prisma.marketDataCache.delete({
          where: { id: cached.id },
        });
        return null;
      }

      // Cache is valid - return the data
      return cached.data as unknown as OptionsChainResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error reading options chain cache for ${underlying}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Cache options chain with 60-second expiration
   * Requirements covered: 2.6
   */
  private async cacheOptionsChain(
    underlying: string,
    expiryDate: string | undefined,
    chain: OptionsChainResponse
  ): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 1000); // 60 seconds TTL
      const timeframe = expiryDate || 'ALL_EXPIRIES';

      await this.prisma.marketDataCache.upsert({
        where: {
          symbol_timeframe_dataType: {
            symbol: underlying,
            timeframe,
            dataType: 'OPTIONS_CHAIN',
          },
        },
        update: {
          data: chain as any,
          cachedAt: now,
          expiresAt,
        },
        create: {
          symbol: underlying,
          timeframe,
          dataType: 'OPTIONS_CHAIN',
          data: chain as any,
          cachedAt: now,
          expiresAt,
        },
      });

      this.logger.debug(
        `Cached options chain for ${underlying}${expiryDate ? ` (${expiryDate})` : ''} until ${expiresAt.toISOString()}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Log error but don't fail the request if caching fails
      this.logger.error(`Error caching options chain for ${underlying}: ${errorMessage}`);
    }
  }
}
