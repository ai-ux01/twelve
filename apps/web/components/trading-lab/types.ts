/**
 * AI Trading Lab - TypeScript Types
 *
 * Shared type definitions for the AI Trading Lab chat interface.
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

export type ResponseMode = 'QUICK' | 'DETAILED' | 'TRADER' | 'QUANT' | 'COACH';
export type SignalDirection = 'BUY' | 'SELL' | 'HOLD';
export type ActionType = 'ANALYZE_MARKET' | 'BUY_ON_PAPER' | 'IGNORE' | 'STOP';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  recommendation?: RecommendationData;
  isStreaming?: boolean;
  error?: ErrorInfo;
}

export interface RecommendationData {
  decisionId: string;
  signal: SignalDirection;
  probability: number;
  riskRewardRatio: number;
  entryPrice?: number;
  stopLoss?: number;
  targetPrice?: number;
  positionSize?: number;
  rationale?: string;
  isLowConfidence: boolean;
  isHighRisk: boolean;
  warnings: string[];
  marketDataTimestamp: string;
}

export interface ErrorInfo {
  message: string;
  detail?: string;
  retryable?: boolean;
}

export interface PromptRequestBody {
  prompt: string;
  response_mode: ResponseMode;
  session_id: string;
}

export interface ActionRequestBody {
  action: ActionType;
  decision_id: string;
  session_id: string;
}

export interface ActionResponseBody {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface HistoryResponseBody {
  success: boolean;
  data: DecisionRecord[];
  page: number;
  page_size: number;
  total_records: number;
}

export interface DecisionRecord {
  decision_id: string;
  agent_id: string;
  session_id: string;
  prompt: string;
  response: string;
  prompt_version: string;
  market_data_timestamp: string | null;
  signal: SignalDirection | null;
  probability: number | null;
  risk_reward_ratio: number | null;
  created_at: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  responseMode: ResponseMode;
  sessionId: string;
  abortController: AbortController | null;
}

export interface SSEStatusEvent {
  step: string;
  message: string;
}

export interface SSEChunkEvent {
  text: string;
}

export interface SSERecommendationEvent {
  decision_id: string;
  signal: SignalDirection;
  probability: number;
  risk_reward_ratio: number;
  entry_price?: number;
  stop_loss?: number;
  target_price?: number;
  position_size?: number;
  rationale?: string;
  is_low_confidence: boolean;
  is_high_risk: boolean;
  warnings: string[];
  market_data_timestamp: string;
  formatted_response?: string;
}

export interface SSEErrorEvent {
  message: string;
  detail?: string;
}

export interface SSEDoneEvent {
  message: string;
}
