import { Module } from '@nestjs/common';
import { TradingService } from './trading.service';
import { TradingController } from './trading.controller';
import { PaperTradingController } from './paper-trading.controller';
import { PaperTradingService } from './paper-trading.service';
import { ExecutionFlowService } from './execution-flow.service';
import { LiveTradingController } from './live-trading.controller';
import { KotakNeoAuthController } from './kotak-neo-auth.controller';
import { KotakSessionStore } from './kotak-neo-session.store';
import { RiskModule } from '../risk/risk.module';
import { KotakNeoProvider } from './brokers/kotak-neo.provider';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../audit/audit.module';
import { KillSwitchModule } from './kill-switch/kill-switch.module';

@Module({
  imports: [RiskModule, ConfigModule, AuditModule, KillSwitchModule],
  controllers: [TradingController, PaperTradingController, LiveTradingController, KotakNeoAuthController],
  providers: [TradingService, PaperTradingService, ExecutionFlowService, KotakNeoProvider, KotakSessionStore],
  exports: [TradingService, PaperTradingService, ExecutionFlowService, KotakNeoProvider, KotakSessionStore],
})
export class TradingModule {}
