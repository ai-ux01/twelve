/**
 * Agent Readiness Dashboard - TypeScript Types
 *
 * Shared type definitions for the Agent Readiness dashboard components.
 * Requirements: 8.1-8.4, 9.1-9.5, 10.1-10.4
 */

export enum ReadinessStage {
  DRAFT = 'DRAFT',
  KNOWLEDGE_READY = 'KNOWLEDGE_READY',
  BACKTEST_VALIDATED = 'BACKTEST_VALIDATED',
  OUT_OF_SAMPLE_VALIDATED = 'OUT_OF_SAMPLE_VALIDATED',
  WALK_FORWARD_VALIDATED = 'WALK_FORWARD_VALIDATED',
  PAPER_TRADING = 'PAPER_TRADING',
  SHADOW_MODE = 'SHADOW_MODE',
  CONTROLLED_LIVE = 'CONTROLLED_LIVE',
  AUTONOMOUS = 'AUTONOMOUS',
}

export const STAGE_ORDER: ReadinessStage[] = [
  ReadinessStage.DRAFT,
  ReadinessStage.KNOWLEDGE_READY,
  ReadinessStage.BACKTEST_VALIDATED,
  ReadinessStage.OUT_OF_SAMPLE_VALIDATED,
  ReadinessStage.WALK_FORWARD_VALIDATED,
  ReadinessStage.PAPER_TRADING,
  ReadinessStage.SHADOW_MODE,
  ReadinessStage.CONTROLLED_LIVE,
  ReadinessStage.AUTONOMOUS,
];

export const STAGE_LABELS: Record<ReadinessStage, string> = {
  [ReadinessStage.DRAFT]: 'Draft',
  [ReadinessStage.KNOWLEDGE_READY]: 'Knowledge Ready',
  [ReadinessStage.BACKTEST_VALIDATED]: 'Backtest Validated',
  [ReadinessStage.OUT_OF_SAMPLE_VALIDATED]: 'OOS Validated',
  [ReadinessStage.WALK_FORWARD_VALIDATED]: 'Walk-Forward',
  [ReadinessStage.PAPER_TRADING]: 'Paper Trading',
  [ReadinessStage.SHADOW_MODE]: 'Shadow Mode',
  [ReadinessStage.CONTROLLED_LIVE]: 'Controlled Live',
  [ReadinessStage.AUTONOMOUS]: 'Autonomous',
};

export type DataHealthStatus = 'connected' | 'disconnected' | 'degraded';
export type QuantEngineHealthStatus = 'running' | 'stopped' | 'error';
export type AIHealthStatus = 'connected' | 'disconnected' | 'error';
export type RiskEngineHealthStatus = 'active' | 'inactive' | 'error';
export type ValidationStatus = 'passed' | 'failed' | 'pending';
export type PaperTradingStatus = 'running' | 'stopped' | 'not_started';
export type ShadowModeStatus = 'passed' | 'failed' | 'running' | 'not_started';

export interface HealthIndicators {
  data_health: DataHealthStatus;
  quant_engine_health: QuantEngineHealthStatus;
  ai_health: AIHealthStatus;
  risk_engine_health: RiskEngineHealthStatus;
  last_updated: string;
}

export interface PerformanceMetrics {
  trade_count: number;
  win_rate: number;
  profit_factor: number;
  expectancy: number;
  max_drawdown: number;
}

export interface ProbabilityCalibration {
  expected_probability: number;
  actual_probability: number;
}

export interface ValidationStatuses {
  backtest_status: ValidationStatus;
  out_of_sample_status: ValidationStatus;
  walk_forward_status: ValidationStatus;
  paper_trading_status: PaperTradingStatus;
  shadow_mode_status: ShadowModeStatus;
}

export interface StageAdvancement {
  stage: ReadinessStage;
  timestamp: string;
  gate_results: Record<string, boolean>;
}

export interface AgentReadiness {
  agent_id: string;
  current_stage: ReadinessStage;
  health: HealthIndicators;
  metrics: PerformanceMetrics;
  calibration: ProbabilityCalibration;
  validations: ValidationStatuses;
  stage_history: StageAdvancement[];
  is_validated: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdvanceRequest {
  reason: string;
}

export interface AdvanceErrorResponse {
  detail: string | { detail: string; unmet_criteria: string[]; gate_results: Record<string, boolean> };
}
