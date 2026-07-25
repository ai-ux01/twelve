// Trading types

import { TradeAction, TradeStatus } from './common';

export interface TradeRequest {
  recommendationId?: string;
  symbol: string;
  action: TradeAction;
  quantity: number;
  price: number;
  stopLoss?: number;
  target?: number;
  isPaper: boolean;
  userConfirmed?: boolean;
}

export interface TradeResult {
  tradeId: string;
  status: TradeStatus;
  executedPrice?: number;
  slippage?: number;
  brokerOrderId?: string;
  error?: string;
  message?: string;
}
