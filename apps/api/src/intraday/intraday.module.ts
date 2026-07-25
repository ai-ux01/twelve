import { Module } from '@nestjs/common';
import { IntradayController } from './intraday.controller';
import { IntradayService } from './intraday.service';
import { IntradayRecommendationService } from './intraday-recommendation.service';
import { MarketDataModule } from '../market-data/market-data.module';
import { QuantModule } from '../quant/quant.module';
import { RiskModule } from '../risk/risk.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';

/**
 * IntradayModule - Intraday Stock Analysis Route Group
 *
 * Provides endpoints and services for intraday trading analysis and execution.
 * Follows the architectural constraint: No AI access to market data or broker APIs.
 *
 * Data flow:
 * Market Data → Quant Engine → Recommendation Service → Risk Engine
 *
 * Requirements covered: 6.1, 6.5, 6.6, 6.7, 18.1
 * - 6.1: Intraday trading analysis for NSE stocks
 * - 6.5: Data freshness validation
 * - 6.6: Confidence and risk/reward thresholds
 * - 6.7: Recommendation signal generation
 * - 18.1: Data flow enforcement (manual refresh only, NO auto-refresh)
 *
 * Key Features:
 * - Manual refresh only (NO automatic refresh)
 * - Comprehensive technical analysis (multi-timeframe)
 * - Data freshness validation (5-minute threshold)
 * - Confidence threshold (minimum 65 for intraday)
 * - Risk/reward threshold (minimum 1.5 for intraday)
 * - Support/resistance levels
 * - Volume analysis
 * - Momentum indicators
 */
@Module({
  imports: [DatabaseModule, MarketDataModule, QuantModule, RiskModule, AuditModule],
  controllers: [IntradayController],
  providers: [IntradayService, IntradayRecommendationService],
  exports: [IntradayService, IntradayRecommendationService],
})
export class IntradayModule {}
