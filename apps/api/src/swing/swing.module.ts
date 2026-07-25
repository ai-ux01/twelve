import { Module } from '@nestjs/common';
import { SwingController } from './swing.controller';
import { SwingService } from './swing.service';
import { ScoringWeightsService } from './scoring-weights.service';
import { MarketDataModule } from '../market-data/market-data.module';
import { QuantModule } from '../quant/quant.module';
import { AiModule } from '../ai/ai.module';
import { RiskModule } from '../risk/risk.module';
import { DatabaseModule } from '../database/database.module';
import { TradingModule } from '../trading/trading.module';

/**
 * SwingModule - Swing Trading Route Group
 *
 * Provides endpoints and services for swing trading analysis and execution.
 * Follows the architectural constraint: No AI access to market data or broker APIs.
 *
 * Data flow:
 * Market Data → Quant Engine → AI Service → Risk Engine
 *
 * Requirements covered: 5.1, 5.3, 5.7, 18.1
 * - 5.1: Swing trading analysis for NSE stocks
 * - 5.3: Configurable weight system for scoring
 * - 5.7: Paper trading for swing opportunities
 * - 18.1: Data flow enforcement (AI receives only verified quant data)
 */
@Module({
  imports: [DatabaseModule, MarketDataModule, QuantModule, AiModule, RiskModule, TradingModule],
  controllers: [SwingController],
  providers: [SwingService, ScoringWeightsService],
  exports: [SwingService, ScoringWeightsService],
})
export class SwingModule {}
