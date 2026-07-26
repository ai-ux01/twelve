/**
 * Data model interfaces for the Options Scalper feature.
 *
 * These types define the shape of the quant engine API response,
 * request payload, polling state, and the custom hook contract.
 *
 * Requirements: 1.1, 3.1, 3.2
 */

/**
 * The full analysis response returned by the quant engine
 * POST /api/options-scalper/analyze endpoint.
 */
export interface AnalysisResult {
  timestamp: string;
  underlying: string;
  signal_type: 'BUY CE' | 'BUY PE' | 'HOLD';
  probability: number; // 0-100
  risk_reward_ratio: number; // positive float
  strike_price: number | null;
  expiry_date: string | null;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  lot_size: number | null;
  spot_price: number;
  trend: string;
  oi_interpretation: string;
  pcr: number;
  trendline_status: string;
  support_level: number | null;
  resistance_level: number | null;
  rsi: number;
  macd: number;
  macd_signal: number;
  vwap: number;
  ema_5: number;
  ema_15: number;
  atr: number;
  volume_ratio: number;
  call_oi: number;
  put_oi: number;
  call_oi_change: number;
  put_oi_change: number;
  atm_iv: number | null;
  rationale: string;
  hold_reason: string | null;
}

/**
 * Request payload sent to the quant engine analyze endpoint.
 */
export interface AnalyzeRequest {
  underlying: 'NIFTY' | 'BANKNIFTY';
}

/**
 * Internal polling state managed by the useOptionsScalperPolling hook.
 */
export interface PollingState {
  isPaused: boolean;
  isInFlight: boolean;
  consecutiveFailures: number; // 0-3, trips circuit at 3
  lastSuccessfulData: AnalysisResult | null;
  secondsRemaining: number; // countdown 60 → 0
  status: 'active' | 'paused' | 'error' | 'initializing' | 'market-closed';
}

/**
 * Configuration options for the useOptionsScalperPolling hook.
 */
export interface UseOptionsScalperPollingOptions {
  underlying: string;
  refreshIntervalSeconds: number;
  apiUrl: string;
  requestTimeoutMs: number;
}

/**
 * The public return value of the useOptionsScalperPolling hook.
 */
export interface UseOptionsScalperPollingResult {
  data: AnalysisResult | null;
  status: 'active' | 'paused' | 'error' | 'initializing' | 'market-closed';
  secondsUntilRefresh: number;
  isRefreshing: boolean;
  errorMessage: string | undefined;
  consecutiveFailures: number;
  refreshNow: () => void;
  togglePause: (paused: boolean) => void;
}
