import { Controller, Get, Query, Logger, BadRequestException } from '@nestjs/common';
import { MarketDataService } from './market-data.service';

@Controller('market-data')
export class MarketDataController {
  private readonly logger = new Logger(MarketDataController.name);

  constructor(private readonly marketDataService: MarketDataService) {}

  @Get()
  async getMarketData(
    @Query('symbol') symbol: string,
    @Query('timeframe') timeframe: string = '1d'
  ) {
    this.logger.log(`Market data request: ${symbol} (${timeframe})`);
    return this.marketDataService.getMarketData(symbol, timeframe);
  }

  @Get('options-chain')
  async getOptionsChain(
    @Query('underlying') underlying: string,
    @Query('expiryDate') expiryDate?: string
  ) {
    if (!underlying || (underlying !== 'NIFTY' && underlying !== 'BANKNIFTY')) {
      throw new BadRequestException('Invalid underlying. Must be NIFTY or BANKNIFTY');
    }

    this.logger.log(
      `Options chain request: ${underlying}${expiryDate ? ` (expiry: ${expiryDate})` : ''}`
    );
    return this.marketDataService.getOptionsChain(underlying as 'NIFTY' | 'BANKNIFTY', expiryDate);
  }
}
