import { Controller, Post, Body, Logger } from '@nestjs/common';
import { IsString, IsEnum, IsNumber, IsPositive, IsOptional, Min } from 'class-validator';
import { RiskService, TradeRequest } from './risk.service';

export class ValidateTradeDto {
  @IsString()
  userId!: string;

  @IsString()
  symbol!: string;

  @IsEnum(['BUY', 'SELL'])
  action!: 'BUY' | 'SELL';

  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  stopLoss?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  target?: number;
}

@Controller('risk')
export class RiskController {
  private readonly logger = new Logger(RiskController.name);

  constructor(private readonly riskService: RiskService) {}

  @Post('validate')
  async validateTrade(@Body() dto: ValidateTradeDto) {
    this.logger.log(`Risk validation request: ${dto.action} ${dto.quantity} ${dto.symbol}`);

    const tradeRequest: TradeRequest = {
      symbol: dto.symbol,
      action: dto.action,
      quantity: dto.quantity,
      price: dto.price,
      stopLoss: dto.stopLoss,
      target: dto.target,
    };

    return this.riskService.validateTrade(dto.userId, tradeRequest);
  }
}
