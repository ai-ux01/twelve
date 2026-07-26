import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsPositive,
  IsObject,
  IsDateString,
  ValidateIf,
  IsDefined,
} from 'class-validator';

export class CreatePaperTradeDto {
  @IsString()
  userId!: string;

  @IsString()
  symbol!: string;

  @IsEnum(['LONG', 'SHORT'])
  direction!: 'LONG' | 'SHORT';

  @IsEnum(['SWING', 'INTRADAY', 'OPTIONS_SCALPING'])
  tradeType!: 'SWING' | 'INTRADAY' | 'OPTIONS_SCALPING';

  @IsNumber()
  @IsPositive()
  entryPrice!: number;

  @IsNumber()
  @IsPositive()
  stopLoss!: number;

  @IsNumber()
  @IsPositive()
  target!: number;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  // AI context fields
  @IsOptional()
  @IsString()
  decisionId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  originalPrompt?: string;

  @IsOptional()
  @IsString()
  aiResponse?: string;

  @IsOptional()
  @IsNumber()
  probability?: number;

  @IsOptional()
  @IsNumber()
  riskRewardRatio?: number;

  @IsOptional()
  @IsObject()
  marketDataSnapshot?: Record<string, any>;

  @IsOptional()
  @IsObject()
  indicators?: Record<string, any>;

  @IsOptional()
  @IsObject()
  trendlineAnalysis?: Record<string, any>;

  @IsOptional()
  @IsString()
  promptVersion?: string;

  // Options-specific fields (required for OPTIONS_SCALPING)
  @ValidateIf((o) => o.tradeType === 'OPTIONS_SCALPING')
  @IsDefined({ message: 'strikePrice is required for OPTIONS_SCALPING trades' })
  @IsNumber()
  @IsPositive()
  strikePrice?: number;

  @ValidateIf((o) => o.tradeType === 'OPTIONS_SCALPING')
  @IsDefined({ message: 'optionType is required for OPTIONS_SCALPING trades' })
  @IsEnum(['CE', 'PE'])
  optionType?: 'CE' | 'PE';

  @ValidateIf((o) => o.tradeType === 'OPTIONS_SCALPING')
  @IsDefined({ message: 'expiryDate is required for OPTIONS_SCALPING trades' })
  @IsDateString()
  expiryDate?: string;

  @ValidateIf((o) => o.tradeType === 'OPTIONS_SCALPING')
  @IsDefined({ message: 'underlying is required for OPTIONS_SCALPING trades' })
  @IsString()
  underlying?: string;

  @IsOptional()
  @IsString()
  signalId?: string;
}
