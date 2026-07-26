/**
 * Prompt Library Types
 *
 * TypeScript interfaces matching the backend Pydantic models.
 */

export type PromptCategory =
  | 'MASTER_AGENT'
  | 'MARKET_REGIME'
  | 'SWING_HUNTER'
  | 'INTRADAY'
  | 'OPTIONS_SCALPING'
  | 'TRADE_DETECTIVE'
  | 'STRATEGY_RESEARCH'
  | 'STRATEGY_BUILDER'
  | 'BACKTEST_ANALYST'
  | 'PROBABILITY_CALIBRATION'
  | 'AGENT_SELF_EVALUATION'
  | 'RISK_REVIEW'
  | 'AGENT_SUPERVISOR';

export const PROMPT_CATEGORIES: PromptCategory[] = [
  'MASTER_AGENT',
  'MARKET_REGIME',
  'SWING_HUNTER',
  'INTRADAY',
  'OPTIONS_SCALPING',
  'TRADE_DETECTIVE',
  'STRATEGY_RESEARCH',
  'STRATEGY_BUILDER',
  'BACKTEST_ANALYST',
  'PROBABILITY_CALIBRATION',
  'AGENT_SELF_EVALUATION',
  'RISK_REVIEW',
  'AGENT_SUPERVISOR',
];

export const CATEGORY_LABELS: Record<PromptCategory, string> = {
  MASTER_AGENT: 'Master Agent',
  MARKET_REGIME: 'Market Regime',
  SWING_HUNTER: 'Swing Hunter',
  INTRADAY: 'Intraday',
  OPTIONS_SCALPING: 'Options Scalping',
  TRADE_DETECTIVE: 'Trade Detective',
  STRATEGY_RESEARCH: 'Strategy Research',
  STRATEGY_BUILDER: 'Strategy Builder',
  BACKTEST_ANALYST: 'Backtest Analyst',
  PROBABILITY_CALIBRATION: 'Probability Calibration',
  AGENT_SELF_EVALUATION: 'Agent Self-Evaluation',
  RISK_REVIEW: 'Risk Review',
  AGENT_SUPERVISOR: 'Agent Supervisor',
};

export interface PromptVersion {
  version: number;
  content: string;
  created_at: string;
  name: string;
  category: PromptCategory;
}

export interface PromptResponse {
  id: string;
  name: string;
  category: PromptCategory;
  latest_version: number;
  latest_content: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface PerformanceMetrics {
  prompt_id: string;
  version: number;
  trades_count: number;
  win_rate: number;
  profit_factor: number;
  expectancy: number;
  average_r: number;
  max_drawdown: number;
  updated_at: string;
}

export interface PromptDetailResponse {
  id: string;
  name: string;
  category: PromptCategory;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  versions: PromptVersion[];
  performance: Record<number, PerformanceMetrics> | null;
}

export interface CompareVersionsResponse {
  versions: PromptVersion[];
  metrics: (PerformanceMetrics | null)[];
  content_diffs: string[];
}

export interface TestResult {
  prompt_id: string;
  version: number;
  input_text: string;
  output_text: string;
  executed_at: string;
}
