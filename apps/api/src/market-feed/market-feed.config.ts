import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MarketFeedConfig {
  constructor(private readonly config: ConfigService) {}

  get hsmWsUrl(): string { return this.config.get<string>('HSM_WS_URL', 'wss://mlhsm.kotaksecurities.com'); }
  get isMockMode(): boolean { return this.config.get<string>('MOCK_MARKET_DATA', 'true') === 'true'; }
  get atmStrikeRange(): number { return Number(this.config.get<string>('ATM_STRIKE_RANGE', '5')); }
  get mockTickInterval(): number { return Number(this.config.get<string>('MOCK_TICK_INTERVAL', '1000')); }
}
