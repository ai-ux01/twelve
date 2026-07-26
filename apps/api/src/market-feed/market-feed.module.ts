import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '../database';
import { TradingModule } from '../trading/trading.module';

// Services
import { MarketFeedConfig } from './market-feed.config';
import { TickCache } from './tick-cache.service';
import { DepthCache } from './depth-cache.service';
import { SubscriptionBuilder } from './subscription-builder.service';
import { HsmWebSocketClient } from './hsm-websocket-client.service';
import { MockDataProvider } from './mock-data-provider.service';
import { MarketDataManager } from './market-data-manager.service';
import { InstrumentMasterSync } from './instrument-master-sync.service';
import { ATMEngine } from './atm-engine.service';
import { WatchlistService } from './watchlist.service';
import { MarketFeedGateway } from './market-feed.gateway';
import { CandleAggregatorService } from './candle-aggregator.service';
import { MARKET_DATA_PROVIDER } from './interfaces';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EventEmitterModule.forRoot(),
    forwardRef(() => TradingModule),
  ],
  providers: [
    MarketFeedConfig,
    TickCache,
    DepthCache,
    SubscriptionBuilder,
    HsmWebSocketClient,
    MockDataProvider,
    {
      provide: MARKET_DATA_PROVIDER,
      useFactory: (
        config: MarketFeedConfig,
        hsm: HsmWebSocketClient,
        mock: MockDataProvider,
      ) => {
        return config.isMockMode ? mock : hsm;
      },
      inject: [MarketFeedConfig, HsmWebSocketClient, MockDataProvider],
    },
    MarketDataManager,
    InstrumentMasterSync,
    ATMEngine,
    WatchlistService,
    MarketFeedGateway,
    CandleAggregatorService,
  ],
  exports: [MarketDataManager, InstrumentMasterSync, WatchlistService, CandleAggregatorService],
})
export class MarketFeedModule {}
