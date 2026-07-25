import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { MarketDataController } from './market-data.controller';
import { KiteConnectProvider } from './providers/kite-connect.provider';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ConfigModule, DatabaseModule, AuditModule],
  controllers: [MarketDataController],
  providers: [MarketDataService, KiteConnectProvider],
  exports: [MarketDataService],
})
export class MarketDataModule {}
