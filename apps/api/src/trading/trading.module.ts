import { Module } from '@nestjs/common';
import { TradingService } from './trading.service';
import { TradingController } from './trading.controller';
import { PaperTradingService } from './paper-trading.service';
import { ExecutionFlowService } from './execution-flow.service';
import { RiskModule } from '../risk/risk.module';
import { KotakNeoProvider } from './brokers/kotak-neo.provider';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [RiskModule, ConfigModule, AuditModule],
  controllers: [TradingController],
  providers: [TradingService, PaperTradingService, ExecutionFlowService, KotakNeoProvider],
  exports: [TradingService, PaperTradingService, ExecutionFlowService, KotakNeoProvider],
})
export class TradingModule {}
