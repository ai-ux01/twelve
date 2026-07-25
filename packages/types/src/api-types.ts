// API Request and Response Types for ProfitTerminal

// ============================================================================
// Prompt Parsing Types
// ============================================================================

export type Intent = 'FIND_TRADE' | 'ANALYZE_PORTFOLIO' | 'GENERATE_STRATEGY';
export type Timeframe = 'SWING' | 'INTRADAY' | 'SCALPING';
export type AssetType = 'STOCK' | 'OPTION_CALL' | 'OPTION_PUT';

export interface ParsedPrompt {
  intent: Intent;
  symbols: string[];
  timeframe: Timeframe;
  assetType: AssetType;
}

// ============================================================================
// Quantitative Analysis Types
// ============================================================================

// Swing Point Types
export type SwingType = 'HIGH' | 'LOW';

export interface SwingPoint {
  timestamp: string;
  price: number;
  type: SwingType;
  index: number;
}

// Trendline Status Enums
export type TrendDirectionEnum = 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
export type TrendlineStatusEnum = 'ACTIVE' | 'BROKEN' | 'RETESTING';
export type BreakoutStatusEnum = 'NONE' | 'BREAKOUT' | 'BREAKDOWN' | 'CONFIRMED';

export interface TrendlineAnalysisResult {
  support_line: Trendline | null;
  resistance_line: Trendline | null;
  swing_points: SwingPoint[];
  breakout_status: BreakoutStatusEnum;
  direction: TrendDirectionEnum;
  support_status: TrendlineStatusEnum;
  resistance_status: TrendlineStatusEnum;
  confidence: number;
}

export interface IndicatorResult {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  sma_20: number;
  sma_50: number;
  sma_200: number;
  ema_5: number;
  ema_15: number;
  ema_20: number;
  ema_50: number;
  ema_200: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  adx: number;
  atr: number;
  vwap: number;
  volume_ma: number;
  relative_volume: number;
  week_52_high: number;
  week_52_low: number;
  momentum: number;
}

export interface SupportResistanceLevel {
  level: number;
  strength: number;
  touches: number;
}

export interface Trendline {
  slope: number;
  intercept: number;
  rSquared: number;
  startPoint: [number, number];
  endPoint: [number, number];
}

export interface OptionsGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho?: number;
}

export interface QuantAnalysisResult {
  symbol: string;
  timeframe: string;
  indicators: IndicatorResult;
  supportResistance: SupportResistanceLevel[];
  trendlines: Trendline[];
  trendline?: TrendlineAnalysisResult;
  optionsGreeks?: OptionsGreeks;
}

// ============================================================================
// AI Recommendation Types
// ============================================================================

export type TradeAction = 'BUY' | 'SELL' | 'HOLD';

export interface Recommendation {
  id: string;
  action: TradeAction;
  symbol: string;
  entryPrice: number;
  target: number;
  stopLoss: number;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  quantData: QuantAnalysisResult;
  createdAt: Date;
}

// ============================================================================
// Risk Validation Types
// ============================================================================

export type RiskViolationSeverity = 'ERROR' | 'WARNING';

export interface RiskViolation {
  rule: string;
  message: string;
  severity: RiskViolationSeverity;
}

export interface RiskValidationResult {
  passed: boolean;
  violations: RiskViolation[];
}

// ============================================================================
// Trading Types
// ============================================================================

export interface TradeRequest {
  recommendationId?: string;
  symbol: string;
  action: Exclude<TradeAction, 'HOLD'>; // BUY or SELL only
  quantity: number;
  price: number;
  stopLoss?: number;
  target?: number;
  isPaper: boolean;
  userConfirmed?: boolean; // Required for live trades
}

export type TradeStatus = 'EXECUTED' | 'FAILED' | 'PENDING';

export interface TradeResult {
  tradeId: string;
  status: TradeStatus;
  executedPrice?: number;
  slippage?: number;
  brokerOrderId?: string;
  error?: string;
}

// ============================================================================
// Portfolio Types
// ============================================================================

export interface Position {
  id: string;
  symbol: string;
  assetType: AssetType;
  tradeType: Timeframe;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  stopLoss?: number;
  target?: number;
  isPaper: boolean;
  status: 'OPEN' | 'CLOSED' | 'STOPPED';
  openedAt: Date;
  closedAt?: Date;
}

export interface PortfolioMetrics {
  totalExposure: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  sharpeRatio?: number;
  maxDrawdown: number;
}

export interface Portfolio {
  totalValue: number;
  cashBalance: number;
  positions: Position[];
  totalPnL: number;
  dailyPnL: number;
  metrics: PortfolioMetrics;
}

// ============================================================================
// Market Data Types
// ============================================================================

export interface OHLCVData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  symbol: string;
  timeframe: string;
  data: OHLCVData[];
  lastUpdated: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId?: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
  version?: string;
}

// ============================================================================
// Strategy Types
// ============================================================================

export interface StrategyCondition {
  indicator: string;
  operator: 'GT' | 'LT' | 'EQ' | 'GTE' | 'LTE' | 'CROSSES_ABOVE' | 'CROSSES_BELOW';
  value: number | string;
}

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  entryConditions: StrategyCondition[];
  exitConditions: StrategyCondition[];
  riskParameters: {
    maxPositionSize: number;
    stopLoss: number;
    target: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

export type WebSocketEvent =
  | { event: 'subscribe'; symbol: string }
  | { event: 'unsubscribe'; symbol: string }
  | {
      event: 'priceUpdate';
      symbol: string;
      price: number;
      change: number;
      changePercent: number;
      timestamp: string;
    }
  | { event: 'portfolioUpdate'; totalPnL: number; dailyPnL: number; timestamp: string };

// ============================================================================
// Configuration Types
// ============================================================================

export interface UserConfig {
  id: string;
  userId: string;
  aiProvider: 'openai' | 'ollama';
  maxPositionSize: number;
  maxDrawdown: number;
  maxPortfolioExposure: number;
  defaultStopLoss: number;
}

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorCode {
  MARKET_DATA_UNAVAILABLE = 'MARKET_DATA_UNAVAILABLE',
  QUANT_ENGINE_FAILED = 'QUANT_ENGINE_FAILED',
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  RISK_VALIDATION_FAILED = 'RISK_VALIDATION_FAILED',
  BROKER_API_ERROR = 'BROKER_API_ERROR',
  INVALID_PROMPT = 'INVALID_PROMPT',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  POSITION_NOT_FOUND = 'POSITION_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}
