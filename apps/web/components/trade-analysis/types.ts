/**
 * Trade Analysis Engine - TypeScript Types
 *
 * Shared type definitions for the Trade Analysis dashboard components.
 * Matches backend Pydantic models from apps/quant/trade_analysis/models.py
 *
 * Requirements: 8.1
 */

export type TradeDirection = 'LONG' | 'SHORT';

export type GroupingDimension =
  | 'strategy'
  | 'setup'
  | 'market_regime'
  | 'sector'
  | 'time_of_day'
  | 'holding_period'
  | 'probability';

export interface TradeRecord {
  id: string;
  symbol: string;
  direction: TradeDirection;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  realized_pnl: number;
  holding_period_days: number;
  strategy: string | null;
  setup: string | null;
  sector: string | null;
  stop_loss: number | null;
  mfe: number | null;
  mae: number | null;
  rsi_at_entry: number | null;
  adx_at_entry: number | null;
  volume_ratio: number | null;
  market_regime: string | null;
  risk_reward_ratio: number | null;
}

export interface PerformanceMetrics {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  profit_factor: number;
  total_pnl: number;
  expectancy: number;
  max_drawdown: number;
  average_r: number;
  mfe_mean: number | null;
  mfe_median: number | null;
  mfe_max: number | null;
  mae_mean: number | null;
  mae_median: number | null;
  mae_max: number | null;
}

export interface CSVRowError {
  row_number: number;
  field_name: string;
  message: string;
}

export interface UnmatchedEntry {
  row_number: number;
  symbol: string;
  action: string;
  date: string;
  price: number;
  quantity: number;
  reason: string;
}

export interface CSVImportResponse {
  success: boolean;
  trades_imported: number;
  trades: TradeRecord[];
  errors: CSVRowError[];
  unmatched: UnmatchedEntry[];
}

export interface MetricsResponse {
  success: boolean;
  metrics: PerformanceMetrics;
}

export interface GroupedMetricsItem {
  dimension_value: string;
  trade_count: number;
  win_rate: number;
  profit_factor: number;
  expectancy: number;
  total_pnl: number;
  average_r: number;
}

export interface GroupedMetricsResponse {
  success: boolean;
  dimension: string;
  groups: GroupedMetricsItem[];
}

export interface AIAnalysisResponse {
  success: boolean;
  analysis: string;
  metrics_used: PerformanceMetrics | null;
  data_source: string;
}

export interface ManualTradeRequest {
  symbol: string;
  entry_date: string;
  entry_price: number;
  exit_date: string;
  exit_price: number;
  quantity: number;
  direction: TradeDirection;
  strategy?: string;
  setup?: string;
  sector?: string;
  stop_loss?: number;
}
