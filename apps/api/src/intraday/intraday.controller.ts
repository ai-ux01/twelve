import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common';
import { IntradayService } from './intraday.service';

/**
 * IntradayController - HTTP endpoints for intraday trading operations
 *
 * Provides REST API endpoints for:
 * - Manual refresh of intraday analysis for NSE stocks
 * - Retrieving comprehensive technical analysis
 * - Multi-timeframe analysis (1m, 5m, 15m)
 * - Support/resistance level detection
 * - Volume and momentum analysis
 *
 * CRITICAL: All data refresh is manual only (NO auto-refresh)
 *
 * Requirements covered: 6.1, 18.1
 */
@Controller('intraday')
export class IntradayController {
  private readonly logger = new Logger(IntradayController.name);

  constructor(private readonly intradayService: IntradayService) {}

  /**
   * Health check endpoint for intraday trading module
   */
  @Get('health')
  async health() {
    this.logger.log('Intraday module health check');
    return {
      status: 'ok',
      module: 'intraday-trading',
      timestamp: new Date().toISOString(),
      features: {
        manualRefresh: true,
        autoRefresh: false,
        multiTimeframe: true,
        technicalAnalysis: true,
        freshnessValidation: true,
      },
    };
  }

  /**
   * Manually refresh and analyze a specific symbol for intraday trading
   * POST /intraday/analyze/:symbol
   *
   * This endpoint performs a fresh analysis by:
   * 1. Fetching latest intraday market data
   * 2. Validating data freshness
   * 3. Performing comprehensive technical analysis via Quant Engine
   * 4. Generating recommendation with confidence and risk/reward validation
   * 5. Applying data freshness, confidence, and risk/reward thresholds
   *
   * Body params:
   * - userId: User ID (optional, for risk validation)
   * - interval: Intraday interval (optional, default: '5m', valid: 1m, 5m, 15m, 30m, 1h)
   *
   * Requirements covered: 6.1, 6.2, 6.3, 6.5, 6.6, 6.7
   */
  @Post('analyze/:symbol')
  async analyzeSymbol(@Param('symbol') symbol: string, @Body() analysisRequest: any) {
    this.logger.log(`Manually analyzing ${symbol} for intraday trading`);
    return this.intradayService.analyzeSymbol(symbol, analysisRequest);
  }

  /**
   * Complete intraday analysis endpoint with orchestration
   * POST /intraday/analyze
   *
   * This is the main endpoint for intraday trading analysis that orchestrates:
   * 1. Accept symbol and optional interval parameter
   * 2. Fetch intraday market data from MarketDataService
   * 3. Call Quant Engine POST /quant/intraday/analyze
   * 4. Call IntradayRecommendationService to generate signal
   * 5. Validate with RiskService if BUY/SELL signal generated
   * 6. Return complete IntradayAnalysisResult with recommendation
   *
   * CRITICAL: NO automatic refresh - manual trigger only
   *
   * Body params:
   * - symbol: Stock symbol (required)
   * - interval: Intraday interval (optional, default: '5m', valid: 1m, 5m, 15m, 30m, 1h)
   * - userId: User ID (optional, for risk validation)
   *
   * Requirements covered: 6.1, 6.7, 18.1
   * Task: 61.1
   */
  @Post('analyze')
  async analyzeIntraday(
    @Body() analysisRequest: { symbol: string; interval?: string; userId?: string }
  ) {
    const { symbol, interval, userId } = analysisRequest;
    this.logger.log(
      `POST /api/intraday/analyze - symbol: ${symbol}, interval: ${interval || '5m'}`
    );
    return this.intradayService.analyzeIntradayComplete(symbol, interval, userId);
  }

  /**
   * Get available timeframes for intraday analysis
   * GET /intraday/timeframes
   *
   * Returns the supported timeframes for intraday analysis
   */
  @Get('timeframes')
  async getTimeframes() {
    this.logger.log('Fetching available intraday timeframes');
    return {
      timeframes: [
        { value: '1m', label: '1 Minute', description: 'Very short-term scalping' },
        { value: '5m', label: '5 Minutes', description: 'Short-term intraday' },
        { value: '15m', label: '15 Minutes', description: 'Standard intraday' },
        { value: '30m', label: '30 Minutes', description: 'Longer intraday' },
        { value: '1h', label: '1 Hour', description: 'Extended intraday' },
      ],
      default: ['5m', '15m'],
      recommended: ['5m', '15m'], // Multi-timeframe confirmation
    };
  }

  /**
   * Check data freshness for a symbol
   * GET /intraday/freshness/:symbol
   *
   * Validates if cached data is fresh enough for intraday trading
   * Returns age of cached data and freshness status
   *
   * Requirements covered: 6.1
   */
  @Get('freshness/:symbol')
  async checkDataFreshness(@Param('symbol') symbol: string) {
    this.logger.log(`Checking data freshness for ${symbol}`);
    return this.intradayService.checkDataFreshness(symbol);
  }
}
