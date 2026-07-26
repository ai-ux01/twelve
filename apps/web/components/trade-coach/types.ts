/**
 * Trade Coach - TypeScript Types
 *
 * Shared type definitions for the AI Trade Coach dashboard components.
 * Matches backend Pydantic models from apps/quant/trade_coach/models.py
 *
 * Phase 15 - AI Trade Coach
 */

export type BehaviorPattern =
  | 'overtrading'
  | 'revenge_trading'
  | 'oversizing'
  | 'chasing'
  | 'weak_setups'
  | 'counter_trend'
  | 'poor_risk_reward'
  | 'moving_stops'
  | 'early_exits'
  | 'late_exits';

export type BehaviorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface BehaviorDetection {
  pattern: BehaviorPattern;
  severity: BehaviorSeverity;
  count: number;
  description: string;
  trade_ids: string[];
  details: string | null;
}

export interface CoachReportData {
  strengths: string[];
  weaknesses: string[];
  best_setups: string[];
  worst_setups: string[];
  best_conditions: string[];
  common_mistakes: string[];
  recommendations: string[];
}

export interface CoachResponse {
  success: boolean;
  report: CoachReportData | null;
  behaviors: BehaviorDetection[];
  total_trades_analyzed: number;
  data_source: string;
  generated_at: string | null;
}

export interface BehaviorsResponse {
  success: boolean;
  total_patterns_detected: number;
  behaviors: BehaviorDetection[];
}

export interface SourceMetrics {
  source: string;
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  expectancy: number;
  average_r: number;
  total_pnl: number;
  max_drawdown: number;
}

export interface SourceComparisonResponse {
  success: boolean;
  paper: SourceMetrics | null;
  live: SourceMetrics | null;
  backtest: SourceMetrics | null;
  insights: string[];
}

export interface CoachRequest {
  user_id?: string;
  time_range_days?: number | null;
  source_filter?: string | null;
}
