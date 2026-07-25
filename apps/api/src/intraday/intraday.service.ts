import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';
import { QuantService } from '../quant/quant.service';
import { RiskService } from '../risk/risk.service';
import { AuditLogService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { IntradayRecommendationService } from './intraday-recommendation.service';

/**
 * IntradayService - Business logic orchestration for intraday trading
 *
 * Orchestrates the flow of data for intraday trading analysis:
 * 1. Market data retrieval (via MarketDataService) - MANUAL REFRESH ONLY
 * 2. Data freshness validation
 * 3. Quantitative analysis (via QuantService → Quant Engine)
 * 4. Recommendation generation (via IntradayRecommendationService)
 * 5. Risk validation (via RiskService)
 *
 * CRITICAL FEATURES:
 * - Manual refresh only (NO auto-refresh)
 * - Data freshness validation (stale data warnings)
 * - Confidence threshold validation (minimum 65)
 * - Risk/reward threshold validation (minimum 1.5)
 * - Multi-timeframe technical analysis
 * - Comprehensive support/resistance levels
 * - Volume and momentum indicators
 *
 * Requirements covered: 6.1, 6.5, 6.6, 6.7, 18.1
 * - 6.1: Intraday trading analysis orchestration
 * - 6.5: Data freshness validation
 * - 6.6: Confidence and risk/reward thresholds
 * - 6.7: Recommendation signal generation
 * - 18.1: Enforces data flow: Market Data → Quant → Recommendation (NO direct AI access)
 */
@Injectable()
export class IntradayService {
  private readonly logger = new Logger(IntradayService.name);

  // Data freshness threshold for intraday trading (5 minutes)
  private readonly FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000;

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly quantService: QuantService,
    private readonly riskService: RiskService,
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
    private readonly recommendationService: IntradayRecommendationService
  ) {
    this.logger.log('IntradayService initialized with IntradayRecommendationService');
  }

  /**
   * Complete intraday analysis with full orchestration
   *
   * This is the main method that implements the complete intraday analysis flow:
   * 1. Accept symbol and optional interval parameter
   * 2. Fetch intraday market data from MarketDataService
   * 3. Call Quant Engine POST /quant/intraday/analyze
   * 4. Call IntradayRecommendationService to generate signal
   * 5. Validate with RiskService if BUY/SELL signal generated
   * 6. Return complete IntradayAnalysisResult with recommendation
   *
   * CRITICAL: NO automatic refresh - manual trigger only
   *
   * Requirements covered: 6.1, 6.7, 18.1
   * Task: 61.1
   */
  async analyzeIntradayComplete(symbol: string, interval?: string, userId?: string): Promise<any> {
    this.logger.log(`Starting complete intraday analysis for ${symbol}`);

    try {
      // Step 1: Validate interval
      const analysisInterval = interval || '5m'; // Default to 5-minute candles
      const validIntervals = ['1m', '5m', '15m', '30m', '1h'];
      if (!validIntervals.includes(analysisInterval)) {
        throw new BadRequestException(
          `Invalid interval: ${analysisInterval}. Valid: ${validIntervals.join(', ')}`
        );
      }

      // Step 2: Fetch latest intraday market data from MarketDataService
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setHours(fromDate.getHours() - 24); // 24 hours of intraday data

      this.logger.debug(`Fetching ${analysisInterval} market data for ${symbol}`);

      const marketDataResult = await this.marketDataService.getMarketData(
        symbol,
        analysisInterval,
        fromDate,
        toDate
      );

      // Log market data retrieval
      await this.auditLogService.logMarketDataCall('fetch_intraday_data', symbol, true, undefined, {
        interval: analysisInterval,
        candleCount: marketDataResult.data.length,
      });

      // Check if we have enough data
      if (marketDataResult.data.length < 30) {
        throw new Error(
          `Insufficient data for intraday analysis: ${marketDataResult.data.length} candles, need at least 30`
        );
      }

      // Step 3: Call Quant Engine POST /quant/intraday/analyze
      this.logger.debug(`Calling Quant Engine for intraday analysis of ${symbol}`);

      const quantAnalysis = await this.quantService.analyzeIntraday(
        symbol,
        analysisInterval,
        marketDataResult.data,
        true, // include support/resistance
        true, // include opening range
        true // include previous day levels
      );

      // Step 4: Call IntradayRecommendationService to generate signal
      this.logger.debug(`Generating recommendation for ${symbol}`);

      const recommendation = await this.recommendationService.generateRecommendation(
        quantAnalysis,
        userId
      );

      // Step 5: Validate with RiskService if BUY/SELL signal generated
      let riskValidation = null;
      if (recommendation.signal === 'BUY' || recommendation.signal === 'SELL') {
        this.logger.debug(`Validating ${recommendation.signal} signal with RiskService`);

        try {
          // Build trade request for risk validation
          const tradeRequest = {
            symbol,
            action: recommendation.signal,
            quantity: 1, // Default quantity for validation
            price: recommendation.entry || quantAnalysis.current_price,
            stopLoss: recommendation.stopLoss ?? undefined,
            target: recommendation.target ?? undefined,
          };

          // Only validate if userId is provided
          if (userId) {
            riskValidation = await this.riskService.validateTrade(userId, tradeRequest);

            if (!riskValidation.passed) {
              this.logger.warn(
                `Risk validation failed for ${symbol} ${recommendation.signal}: ${riskValidation.violations.map((v) => v.message).join(', ')}`
              );
              // Add risk warnings to recommendation
              recommendation.warnings.push(
                ...riskValidation.violations.map((v) => `Risk: ${v.message} (${v.severity})`)
              );
            } else {
              this.logger.log(`Risk validation passed for ${symbol} ${recommendation.signal}`);
            }
          } else {
            this.logger.debug('Skipping risk validation (no userId provided)');
            riskValidation = {
              passed: true,
              violations: [],
              note: 'Risk validation skipped (no userId provided)',
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Risk validation error: ${errorMessage}`);
          riskValidation = {
            passed: false,
            violations: [
              {
                rule: 'RISK_VALIDATION_ERROR',
                message: errorMessage,
                severity: 'WARNING',
              },
            ],
          };
        }
      }

      // Step 6: Return complete IntradayAnalysisResult with recommendation
      const result = {
        symbol,
        interval: analysisInterval,
        timestamp: new Date().toISOString(),
        lastRefreshTime: new Date().toISOString(), // Task 61.2: Server time when analysis ran
        dataFreshness: {
          isFresh: !recommendation.isStale,
          latestTimestamp: recommendation.dataTimestamp,
          ageMs: quantAnalysis.data_freshness?.age_seconds * 1000 || 0,
          ageMinutes: quantAnalysis.data_freshness?.age_seconds / 60 || 0,
          thresholdMs: this.FRESHNESS_THRESHOLD_MS,
          warning: recommendation.isStale
            ? `Data is ${(quantAnalysis.data_freshness?.age_seconds / 60).toFixed(1)} minutes old`
            : undefined,
        },
        analysis: {
          score: quantAnalysis.score?.total_score || 0,
          scoreComponents: quantAnalysis.score?.components || {},
          signals: quantAnalysis.score?.signals || [],
          technical: quantAnalysis.technical_analysis,
          openingRange: quantAnalysis.opening_range,
          prevDayLevels: quantAnalysis.prev_day_levels,
          currentPrice: quantAnalysis.current_price,
          priceChange: quantAnalysis.price_change,
          priceChangePercent: quantAnalysis.price_change_percent,
        },
        recommendation: {
          signal: recommendation.signal,
          confidence: recommendation.confidence,
          entry: recommendation.entry,
          stopLoss: recommendation.stopLoss,
          target: recommendation.target,
          riskReward: recommendation.riskReward,
          rationale: recommendation.rationale,
          warnings: recommendation.warnings,
          isStale: recommendation.isStale, // Task 61.2
          dataTimestamp: recommendation.dataTimestamp, // Task 61.2
          dataAge: recommendation.dataAge, // Task 61.2: Seconds since latest candle
        },
        riskValidation: riskValidation || {
          passed: true,
          violations: [],
          note: 'Risk validation not performed (signal is HOLD or NO_TRADE)',
        },
      };

      this.logger.log(
        `Intraday analysis complete for ${symbol}: ` +
          `Signal: ${recommendation.signal}, ` +
          `Confidence: ${recommendation.confidence}%, ` +
          `Risk: ${riskValidation?.passed ? 'PASSED' : 'FAILED/SKIPPED'}, ` +
          `Score: ${quantAnalysis.score?.total_score || 0}`
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error in complete intraday analysis for ${symbol}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Manually analyze a specific symbol for intraday trading
   *
   * Flow:
   * 1. Validate request parameters
   * 2. Fetch latest intraday market data (manual refresh)
   * 3. Call Quant Engine's intraday analysis endpoint
   * 4. Generate recommendation using IntradayRecommendationService
   * 5. Validate data freshness and thresholds
   * 6. Return comprehensive analysis result with recommendation
   *
   * Error Handling:
   * - Stale data warnings if data is older than threshold
   * - Insufficient data errors if not enough candles
   * - Market data API failures logged and reported
   *
   * Requirements covered: 6.1, 6.2, 6.3, 6.5, 6.6, 6.7, 18.1, 20.1
   */
  async analyzeSymbol(
    symbol: string,
    analysisRequest?: { userId?: string; interval?: string }
  ): Promise<any> {
    this.logger.log(`Starting manual intraday analysis for ${symbol}`);

    try {
      // Extract parameters with defaults
      const userId = analysisRequest?.userId;
      const interval = analysisRequest?.interval || '5m'; // Default to 5-minute candles

      // Validate interval
      const validIntervals = ['1m', '5m', '15m', '30m', '1h'];
      if (!validIntervals.includes(interval)) {
        throw new BadRequestException(
          `Invalid interval: ${interval}. Valid: ${validIntervals.join(', ')}`
        );
      }

      // Step 1: Fetch latest market data
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setHours(fromDate.getHours() - 24); // 24 hours of intraday data

      this.logger.debug(`Fetching ${interval} market data for ${symbol}`);

      const marketDataResult = await this.marketDataService.getMarketData(
        symbol,
        interval,
        fromDate,
        toDate
      );

      // Log market data retrieval
      await this.auditLogService.logMarketDataCall('fetch_intraday_data', symbol, true, undefined, {
        interval,
        candleCount: marketDataResult.data.length,
      });

      // Check if we have enough data
      if (marketDataResult.data.length < 30) {
        throw new Error(
          `Insufficient data for intraday analysis: ${marketDataResult.data.length} candles, need at least 30`
        );
      }

      // Step 2: Call Quant Engine for comprehensive intraday analysis
      this.logger.debug(`Sending ${symbol} to Quant Engine for intraday analysis`);

      const quantAnalysis = await this.quantService.analyzeIntraday(
        symbol,
        interval,
        marketDataResult.data,
        true, // include support/resistance
        true, // include opening range
        true // include previous day levels
      );

      // Step 3: Generate recommendation using IntradayRecommendationService
      this.logger.debug(`Generating recommendation for ${symbol}`);

      const recommendation = await this.recommendationService.generateRecommendation(
        quantAnalysis,
        userId
      );

      // Step 4: Build comprehensive result
      const result = {
        symbol,
        interval,
        timestamp: new Date().toISOString(),
        lastRefreshTime: new Date().toISOString(), // Task 61.2: Server time when analysis ran
        dataFreshness: {
          isFresh: !recommendation.isStale,
          latestTimestamp: recommendation.dataTimestamp,
          ageMs: quantAnalysis.data_freshness?.age_seconds * 1000 || 0,
          ageMinutes: quantAnalysis.data_freshness?.age_seconds / 60 || 0,
          thresholdMs: this.FRESHNESS_THRESHOLD_MS,
          warning: recommendation.isStale
            ? `Data is ${(quantAnalysis.data_freshness?.age_seconds / 60).toFixed(1)} minutes old`
            : undefined,
        },
        analysis: {
          score: quantAnalysis.score?.total_score || 0,
          scoreComponents: quantAnalysis.score?.components || {},
          signals: quantAnalysis.score?.signals || [],
          technical: quantAnalysis.technical_analysis,
          openingRange: quantAnalysis.opening_range,
          prevDayLevels: quantAnalysis.prev_day_levels,
          currentPrice: quantAnalysis.current_price,
          priceChange: quantAnalysis.price_change,
          priceChangePercent: quantAnalysis.price_change_percent,
        },
        recommendation: {
          signal: recommendation.signal,
          confidence: recommendation.confidence,
          entry: recommendation.entry,
          stopLoss: recommendation.stopLoss,
          target: recommendation.target,
          riskReward: recommendation.riskReward,
          rationale: recommendation.rationale,
          warnings: recommendation.warnings,
          isStale: recommendation.isStale,
          dataTimestamp: recommendation.dataTimestamp,
          dataAge: recommendation.dataAge, // Task 61.2: Seconds since latest candle
        },
      };

      this.logger.log(
        `Intraday analysis complete for ${symbol}: ` +
          `Signal: ${recommendation.signal}, ` +
          `Confidence: ${recommendation.confidence}%, ` +
          `Score: ${quantAnalysis.score?.total_score || 0}, ` +
          `Data age: ${(quantAnalysis.data_freshness?.age_seconds / 60).toFixed(1)} minutes`
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error analyzing ${symbol}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Validate data freshness for intraday trading
   *
   * Intraday trading requires very fresh data. This method checks if the latest
   * data point is within the acceptable freshness threshold.
   *
   * @param symbol - Stock symbol
   * @param data - Market data array
   * @returns Freshness validation result
   */
  private async validateDataFreshness(
    symbol: string,
    data: any[]
  ): Promise<{
    isFresh: boolean;
    latestTimestamp: string;
    ageMs: number;
    ageMinutes: number;
    thresholdMs: number;
    warning?: string;
  }> {
    if (data.length === 0) {
      return {
        isFresh: false,
        latestTimestamp: new Date().toISOString(),
        ageMs: Infinity,
        ageMinutes: Infinity,
        thresholdMs: this.FRESHNESS_THRESHOLD_MS,
        warning: 'No data available',
      };
    }

    // Get the latest data point
    const latestCandle = data[data.length - 1];
    const latestTimestamp = new Date(latestCandle.timestamp);
    const now = new Date();
    const ageMs = now.getTime() - latestTimestamp.getTime();
    const ageMinutes = ageMs / 60000;

    const isFresh = ageMs <= this.FRESHNESS_THRESHOLD_MS;

    const result = {
      isFresh,
      latestTimestamp: latestTimestamp.toISOString(),
      ageMs,
      ageMinutes,
      thresholdMs: this.FRESHNESS_THRESHOLD_MS,
      warning: isFresh
        ? undefined
        : `Data is ${ageMinutes.toFixed(1)} minutes old (threshold: ${this.FRESHNESS_THRESHOLD_MS / 60000} minutes)`,
    };

    if (!isFresh) {
      this.logger.warn(`Stale data detected for ${symbol}: ${result.warning}`);
    }

    return result;
  }

  /**
   * Check data freshness for a symbol without performing full analysis
   *
   * @param symbol - Stock symbol to check
   * @returns Freshness check result
   */
  async checkDataFreshness(symbol: string): Promise<any> {
    try {
      // Fetch latest 5-minute data (primary timeframe for intraday)
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setHours(fromDate.getHours() - 1); // Last 1 hour

      const marketData = await this.marketDataService.getMarketData(symbol, '5m', fromDate, toDate);

      const freshnessCheck = await this.validateDataFreshness(symbol, marketData.data);

      return {
        symbol,
        ...freshnessCheck,
        recommendation: freshnessCheck.isFresh
          ? 'Data is fresh - safe to trade'
          : 'Data is stale - manual refresh recommended',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error checking freshness for ${symbol}: ${errorMessage}`);

      return {
        symbol,
        isFresh: false,
        error: errorMessage,
        recommendation: 'Unable to check freshness - manual refresh required',
      };
    }
  }
}
