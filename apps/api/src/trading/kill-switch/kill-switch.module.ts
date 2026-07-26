import { Module } from '@nestjs/common';
import { KillSwitchService } from './kill-switch.service';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [KillSwitchService],
  exports: [KillSwitchService],
})
export class KillSwitchModule {}
