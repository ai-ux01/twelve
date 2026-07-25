import { Module } from '@nestjs/common';
import { OptionsController } from './options.controller';
import { OptionsService } from './options.service';
import { MarketDataModule } from '../market-data/market-data.module';
import { QuantModule } from '../quant/quant.module';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';

/**
 * OptionsModule - Options Chain Route Group
 *
 * Provides endpoints and services for options chain analysis.
 * Follows the architectural constraint: No AI access to market data or broker APIs.
 *
 * CORE FUNCTIONALITY ONLY:
 * - Options chain data retrieval and analysis
 * - PCR (Put-Call Ratio) calculation
 * - ATM strike identification
 * - OI buildup/unwinding detection
 * - Liquidity filtering and warnings
 * - Comprehensive audit logging for compliance
 *
 * NO multi-leg strategies, NO auto-trading
 * Only NIFTY and BANKNIFTY supported
 *
 * Data flow:
 * Market Data → Options Service → Analysis (PCR, ATM, OI, Liquidity)
 * All steps are logged for audit purposes
 *
 * Requirements covered: 7.1, 18.1, 18.2, 20.1
 * - 7.1: Options scalping analysis for NIFTY/BANKNIFTY
 * - 18.1: Data flow enforcement (market data → analysis → AI layer in future tasks)
 * - 18.2: Audit logging for data flow tracing
 * - 20.1: Error handling and logging
 */
@Module({
  imports: [DatabaseModule, MarketDataModule, QuantModule, AuditModule],
  controllers: [OptionsController],
  providers: [OptionsService],
  exports: [OptionsService],
})
export class OptionsModule {}
