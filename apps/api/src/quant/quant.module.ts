import { Module } from '@nestjs/common';
import { QuantService } from './quant.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [QuantService],
  exports: [QuantService],
})
export class QuantModule {}
