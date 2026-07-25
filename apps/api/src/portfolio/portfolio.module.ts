import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { MarketDataModule } from '../market-data/market-data.module';
import { QuantModule } from '../quant/quant.module';

@Module({
  imports: [MarketDataModule, QuantModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
