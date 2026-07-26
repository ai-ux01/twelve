import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Feature modules
import { PromptModule } from './prompt/prompt.module';
import { MarketDataModule } from './market-data/market-data.module';
import { QuantModule } from './quant/quant.module';
import { AiModule } from './ai/ai.module';
import { RiskModule } from './risk/risk.module';
import { TradingModule } from './trading/trading.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { WebSocketModule } from './websocket';
import { SwingModule } from './swing/swing.module';
import { IntradayModule } from './intraday/intraday.module';
import { OptionsModule } from './options/options.module';
import { MarketFeedModule } from './market-feed/market-feed.module';

/**
 * Main Application Module
 *
 * Module organization follows NestJS best practices and enforces architectural constraints:
 * - AiModule does NOT import MarketDataModule (AI cannot access raw market data)
 * - AiModule does NOT import TradingModule (AI cannot execute trades)
 * - All trades flow through RiskModule validation
 * - Data flow: MarketData → Quant → AI → Risk → Trading
 */
@Module({
  imports: [
    // Core modules (global)
    ConfigModule,
    DatabaseModule,
    
    // Rate limiting configuration
    // Default: 10 requests per 60 seconds (1 minute) per user
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds in milliseconds
        limit: 10, // 10 requests per TTL window
      },
    ]),

    // Feature modules
    PromptModule,
    MarketDataModule,
    QuantModule,
    AiModule,
    RiskModule,
    TradingModule,
    PortfolioModule,
    WebSocketModule,
    SwingModule,
    IntradayModule,
    OptionsModule,
    MarketFeedModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply ThrottlerGuard globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
