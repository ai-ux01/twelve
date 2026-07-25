// Quantitative analysis types

// ============================================================================
// Swing Point Types
// ============================================================================

export type SwingType = 'HIGH' | 'LOW';

export interface SwingPoint {
  timestamp: string;
  price: number;
  type: SwingType;
  index: number;
}

// ============================================================================
// Trendline Types
// ============================================================================

export type TrendDirectionEnum = 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
export type TrendlineStatusEnum = 'ACTIVE' | 'BROKEN' | 'RETESTING';
export type BreakoutStatusEnum = 'NONE' | 'BREAKOUT' | 'BREAKDOWN' | 'CONFIRMED';

export interface TrendlineAnalysisResult {
  support_line: TrendlineResult | null;
  resistance_line: TrendlineResult | null;
  swing_points: SwingPoint[];
  breakout_status: BreakoutStatusEnum;
  direction: TrendDirectionEnum;
  support_status: TrendlineStatusEnum;
  resistance_status: TrendlineStatusEnum;
  confidence: number;
}

// ============================================================================
// Indicator Types
// ============================================================================

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
  ema_20: number;
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

export interface TrendlineResult {
  slope: number;
  intercept: number;
  rSquared: number;
  startPoint: [number, number];
  endPoint: [number, number];
}

export interface SupportResistanceLevel {
  level: number;
  strength: number;
  touches: number;
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
  trendlines: TrendlineResult[];
  trendline?: TrendlineAnalysisResult;
  optionsGreeks?: OptionsGreeks;
}
