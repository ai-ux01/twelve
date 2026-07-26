/**
 * Paper Trading Dashboard - TypeScript Types
 *
 * Shared type definitions for the Paper Trading dashboard components.
 * Requirements: 7.1, 8.1, 9.1, 9.3
 */

export type TradeType = 'SWING' | 'INTRADAY' | 'OPTIONS_SCALPING';
export type TradeStatus = 'OPEN' | 'TARGET_HIT' | 'STOP_HIT' | 'MANUAL_EXIT' | 'EXPIRED' | 'CANCELLED';
export type TradeDirection = 'LONG' | 'SHORT';

export type TradeTypeFilter = 'ALL' | TradeType;

export interface PaperTrade {
  id: string;
  userId: string;
  symbol: string;
  direction: TradeDirection;
  tradeType: TradeType;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  target: number;
  status: TradeStatus;
  currentPrice: number | null;
  unrealizedPnL: number | null;
  exitPrice: number | null;
  realizedPnL: number | null;
  exitedAt: string | null;
  enteredAt: string;
  updatedAt: string;
  probability: number | null;
  riskRewardRatio: number | null;
  // AI context
  decisionId: string | null;
  agentId: string | null;
  aiContext: {
    prompt?: string;
    response?: string;
    indicators?: Record<string, unknown>;
    trendlineAnalysis?: Record<string, unknown>;
    marketDataSnapshot?: Record<string, unknown>;
    promptVersion?: string;
  } | null;
  // Options-specific
  strikePrice: number | null;
  optionType: 'CE' | 'PE' | null;
  expiryDate: string | null;
  underlying: string | null;
}

export interface PerformanceMetrics {
  winRate: number;
  profitFactor: number;
  totalPnL: number;
  expectancy: number;
  averageR: number;
  maxDrawdown: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

export interface PaginatedTradesResponse {
  data: PaperTrade[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
