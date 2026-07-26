/**
 * Agent Architecture - TypeScript Types
 *
 * Shared type definitions for the Agent Management Dashboard components.
 * Matches backend Pydantic models from apps/quant/agents/models.py
 *
 * Requirements: 11.1, 11.2
 */

// === Enums ===

export type AgentType =
  | 'SWING'
  | 'INTRADAY_STOCK'
  | 'OPTIONS_SCALPING'
  | 'RISK'
  | 'TRADE_COACH'
  | 'RESEARCH'
  | 'PORTFOLIO'
  | 'SUPERVISOR';

export type AgentStatus =
  | 'DRAFT'
  | 'TESTING'
  | 'PAPER'
  | 'SHADOW'
  | 'CONTROLLED_LIVE'
  | 'PAUSED'
  | 'DISABLED';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type PolicyType =
  | 'RISK_LIMIT'
  | 'POSITION_LIMIT'
  | 'TRADING_HOURS'
  | 'INSTRUMENT_RESTRICTION'
  | 'APPROVAL_REQUIRED';

export type ObservationType =
  | 'MARKET_DATA'
  | 'PORTFOLIO_STATE'
  | 'SIGNAL'
  | 'NEWS'
  | 'USER_INPUT';

export type DecisionType =
  | 'TRADE_RECOMMENDATION'
  | 'RISK_ALERT'
  | 'PORTFOLIO_ADJUSTMENT'
  | 'COACHING_INSIGHT'
  | 'RESEARCH_FINDING';

export type ActionType =
  | 'PAPER_TRADE'
  | 'RECOMMEND'
  | 'ALERT'
  | 'REBALANCE'
  | 'COACH'
  | 'RESEARCH_REPORT';

export type ExecutionStatus = 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'REJECTED';

export type OutcomeStatus = 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE';

// === Entity Models ===

export interface Agent {
  id: string;
  name: string;
  agent_type: AgentType;
  status: AgentStatus;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  description: string;
  priority: number;
  status: TaskStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

export interface AgentPolicy {
  id: string;
  agent_id: string;
  name: string;
  policy_type: PolicyType;
  rules: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
}

export interface AgentObservation {
  id: string;
  agent_id: string;
  observation_type: ObservationType;
  data: Record<string, unknown>;
  source: string;
  data_version: string;
  timestamp: string;
}

export interface AgentDecision {
  id: string;
  agent_id: string;
  observation_ids: string[];
  decision_type: DecisionType;
  reasoning: string;
  confidence: number;
  timestamp: string;
}

export interface AgentAction {
  id: string;
  decision_id: string;
  agent_id: string;
  action_type: ActionType;
  parameters: Record<string, unknown>;
  timestamp: string;
}

export interface AgentExecution {
  id: string;
  action_id: string;
  agent_id: string;
  status: ExecutionStatus;
  context: Record<string, unknown>;
  requires_approval: boolean;
  approved_by: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface AgentOutcome {
  id: string;
  execution_id: string;
  agent_id: string;
  outcome_status: OutcomeStatus;
  result_data: Record<string, unknown>;
  timestamp: string;
}

export interface AuditTrail {
  decision: AgentDecision;
  observations: AgentObservation[];
  actions: AgentAction[];
  executions: AgentExecution[];
  outcomes: AgentOutcome[];
}

// === Request Models ===

export interface CreateAgentRequest {
  name: string;
  agent_type: AgentType;
  config: Record<string, unknown>;
}

export interface UpdateAgentRequest {
  name?: string;
  config?: Record<string, unknown>;
  status?: AgentStatus;
  status_reason?: string;
}

// === Constants ===

export const AGENT_TYPES: AgentType[] = [
  'SWING',
  'INTRADAY_STOCK',
  'OPTIONS_SCALPING',
  'RISK',
  'TRADE_COACH',
  'RESEARCH',
  'PORTFOLIO',
  'SUPERVISOR',
];

export const AGENT_STATUSES: AgentStatus[] = [
  'DRAFT',
  'TESTING',
  'PAPER',
  'SHADOW',
  'CONTROLLED_LIVE',
  'PAUSED',
  'DISABLED',
];

export const VALID_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  DRAFT: ['TESTING', 'DISABLED'],
  TESTING: ['PAPER', 'DISABLED'],
  PAPER: ['SHADOW', 'DISABLED'],
  SHADOW: ['CONTROLLED_LIVE', 'DISABLED'],
  CONTROLLED_LIVE: ['PAUSED', 'DISABLED'],
  PAUSED: ['CONTROLLED_LIVE', 'DISABLED'],
  DISABLED: [],
};

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  SWING: 'Swing',
  INTRADAY_STOCK: 'Intraday Stock',
  OPTIONS_SCALPING: 'Options Scalping',
  RISK: 'Risk',
  TRADE_COACH: 'Trade Coach',
  RESEARCH: 'Research',
  PORTFOLIO: 'Portfolio',
  SUPERVISOR: 'Supervisor',
};

export const STATUS_COLORS: Record<AgentStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  TESTING: 'bg-green-100 text-green-800',
  PAPER: 'bg-green-100 text-green-800',
  SHADOW: 'bg-green-100 text-green-800',
  CONTROLLED_LIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
  DISABLED: 'bg-red-100 text-red-800',
};
