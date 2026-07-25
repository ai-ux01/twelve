import { Controller, Get, Query, Logger } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
export class PortfolioController {
  private readonly logger = new Logger(PortfolioController.name);

  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  async getPortfolio(@Query('userId') userId: string) {
    this.logger.log(`Portfolio request for user ${userId}`);

    if (!userId) {
      throw new Error('userId is required');
    }

    return this.portfolioService.getPortfolio(userId);
  }

  @Get('options')
  async getOptionsPositions(@Query('userId') userId: string) {
    this.logger.log(`Options positions request for user ${userId}`);

    if (!userId) {
      throw new Error('userId is required');
    }

    return this.portfolioService.getOptionsPositions(userId);
  }
}
