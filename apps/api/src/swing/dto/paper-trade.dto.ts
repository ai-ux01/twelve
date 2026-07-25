import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

/**
 * DTO for POST /swing/paper-trade request
 * Requirements: 5.7 (21.7) - Paper trading for swing opportunities
 */
export class ExecuteSwingPaperTradeDto {
  @IsString()
  userId!: string;

  @IsString()
  symbol!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  entryPrice!: number;

  @IsNumber()
  @Min(0)
  stopLoss!: number;

  @IsNumber()
  @Min(0)
  target!: number;

  @IsOptional()
  @IsString()
  signalId?: string;
}

/**
 * Response from POST /swing/paper-trade
 */
export interface ExecuteSwingPaperTradeResponseDto {
  success: boolean;
  tradeId: string;
  message: string;
  trade: {
    symbol: string;
    quantity: number;
    entryPrice: number;
    stopLoss: number;
    target: number;
    status: string;
    simulatedSlippage: number;
  };
}
