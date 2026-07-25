// Portfolio types

import { AssetType, TradeType, PositionStatus } from './common';

export interface Position {
  id: string;
  symbol: string;
  assetType: AssetType;
  tradeType: TradeType;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  stopLoss?: number;
  target?: number;
  isPaper: boolean;
  status: PositionStatus;
  openedAt: Date | string;
}

export interface PortfolioMetrics {
  totalExposure: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

export interface Portfolio {
  totalValue: number;
  cashBalance: number;
  positions: Position[];
  totalPnL: number;
  dailyPnL: number;
  metrics: PortfolioMetrics;
}
