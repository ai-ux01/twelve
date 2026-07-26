import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketDataService } from './market-data.service';
import { MarketDataController } from './market-data.controller';
import { KiteConnectProvider } from './providers/kite-connect.provider';
import { KiteAuthController } from './kite-auth.controller';
import { HistoricalDataController } from './historical-data.controller';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { HistoricalDataService } from './historical-data.service';
import { RetentionScheduler } from './retention-scheduler.service';
import { SyncService } from './sync.service';
import { RateLimiter } from './rate-limiter.service';
import { TickBuffer } from './tick-buffer.service';
import { RETENTION_SCHEDULER_TOKEN } from './sync.service';

@Module({
  imports: [ConfigModule, DatabaseModule, AuditModule, ScheduleModule.forRoot()],
  controllers: [MarketDataController, KiteAuthController, HistoricalDataController],
  providers: [
    MarketDataService,
    KiteConnectProvider,
    HistoricalDataService,
    RetentionScheduler,
    SyncService,
    RateLimiter,
    TickBuffer,
    {
      provide: RETENTION_SCHEDULER_TOKEN,
      useExisting: RetentionScheduler,
    },
  ],
  exports: [MarketDataService, HistoricalDataService],
})
export class MarketDataModule {}
