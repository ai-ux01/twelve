import { IsNumber, IsEnum, IsPositive } from 'class-validator';

export class ClosePaperTradeDto {
  @IsNumber()
  @IsPositive()
  exitPrice!: number;

  @IsEnum(['TARGET_HIT', 'STOP_HIT', 'MANUAL_EXIT', 'EXPIRED'])
  exitReason!: 'TARGET_HIT' | 'STOP_HIT' | 'MANUAL_EXIT' | 'EXPIRED';
}
