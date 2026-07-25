/**
 * API Client for ProfitTerminal Backend
 *
 * Provides typed methods for all Backend API endpoints.
 * Base URL: http://localhost:4000
 *
 * Requirements covered: 13.1
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface ParsedPrompt {
  intent:
    | 'FIND_TRADE'
    | 'ANALYZE_MARKET'
    | 'GENERATE_STRATEGY'
    | 'REVIEW_POSITION'
    | 'BACKTEST'
    | 'EXPLAIN'
    | 'QUERY';
  symbols: string[];
  timeframe?: 'SWING' | 'INTRADAY' | 'SCALPING' | 'POSITIONAL';
  assetType?: 'STOCK' | 'OPTION_CALL' | 'OPTION_PUT' | 'INDEX' | 'FUTURES';
}

export interface IndicatorResult {
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  sma_20: number;
  sma_50: number;
  sma_200: number;
  ema_5: number;
  ema_15: number;
  ema_20: number;
  ema_50: number;
  ema_200: number;
  bollingerBands: { upper: number; middle: number; lower: number };
  adx: number;
  atr: number;
  vwap: number;
  volume_ma: number;
  relative_volume: number;
  week_52_high: number;
  week_52_low: number;
  momentum: number;
}

export interface QuantAnalysisResult {
  symbol: string;
  timeframe: string;
  indicators: IndicatorResult;
  supportResistance: { level: number; strength: number }[];
  trendlines: { slope: number; intercept: number; rSquared: number }[];
  optionsGreeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
}

export interface ScoreResult {
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi: number;
  adx: number;
  vwap: number;
  volumeRatio: number;
  score: number;
  signals: string[];
}

export interface Recommendation {
  id: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  entryPrice: number;
  target: number;
  stopLoss: number;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  quantData: QuantAnalysisResult;
  score?: ScoreResult; // Optional market scoring from Quant Engine
  aiUnavailable?: boolean; // Flag to indicate AI failure (Requirement 20.3)
}

export interface PromptResponse {
  rawPrompt: string;
  parsed: ParsedPrompt;
  recommendation: Recommendation;
}

export interface PositionInfo {
  id: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  isPaper: boolean;
}

export interface Portfolio {
  totalValue: number;
  cashBalance: number;
  investedValue: number;
  positions: PositionInfo[];
  totalPnL: number;
  dailyPnL: number;
  metrics: {
    totalExposure: number;
    openPositions: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
  };
  optionsPositions?: OptionsPositionInfo[];
  optionsExposurePercent?: number;
}

export interface OptionsPositionInfo {
  id: string;
  symbol: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiry: Date;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  isPaper: boolean;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  daysToExpiry: number;
  isExpiringSoon: boolean;
  expiryAlert?: string;
}

export interface TradeRequest {
  userId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  stopLoss?: number;
  target?: number;
  signalId?: string;
}

export interface PaperOptionTradeRequest {
  userId: string;
  symbol: string; // NIFTY or BANKNIFTY
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiry: string; // ISO date string
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number; // Premium price
  stopLoss?: number;
  target?: number;
  bidAskSpread?: number;
  openInterest?: number;
  impliedVolatility?: number;
  delta?: number;
  signalId?: string;
}

export interface TradeResult {
  tradeId: string;
  status: 'EXECUTED' | 'FAILED' | 'PENDING';
  executedPrice?: number;
  slippage?: number;
  brokerOrderId?: string;
  message?: string;
  error?: string;
}

export interface RiskValidationResult {
  passed: boolean;
  violations: {
    rule: string;
    message: string;
    severity: 'ERROR' | 'WARNING';
  }[];
}

export interface OHLCVData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataResponse {
  symbol: string;
  timeframe: string;
  data: OHLCVData[];
}

export interface OptionsChainResponse {
  underlying: 'NIFTY' | 'BANKNIFTY';
  expiryDate: string;
  spotPrice: number;
  strikes: {
    strikePrice: number;
    call: {
      ltp: number;
      volume: number;
      oi: number;
      iv: number;
      bid?: number;
      ask?: number;
      changeOI?: number;
    };
    put: {
      ltp: number;
      volume: number;
      oi: number;
      iv: number;
      bid?: number;
      ask?: number;
      changeOI?: number;
    };
  }[];
}

// ============================================================================
// Options Chain Types (Task 70.4)
// ============================================================================

export interface OptionsChainRequest {
  symbol: string;
  expiry?: string;
}

export interface OptionsAnalysisRequest {
  symbol: string;
  expiry?: string;
}

export interface OptionsChainData {
  symbol: string;
  expiryDate: string;
  spotPrice: number;
  timestamp: Date;
  contracts: OptionContract[];
  pcrAnalysis: PCRAnalysis;
  atmAnalysis: ATMAnalysis;
  oiAnalysis: OIAnalysis;
  liquidityMetrics: LiquidityMetrics;
}

export interface OptionContract {
  symbol: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiryDate: string;
  ltp: number;
  bid: number;
  ask: number;
  openInterest: number;
  changeInOI: number;
  volume: number;
  impliedVolatility: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  bidAskSpread?: number;
  bidAskSpreadPercent?: number;
  liquidityWarning?: {
    wideBidAskSpread: boolean;
    lowVolume: boolean;
    lowOI: boolean;
    deepOTM: boolean;
  };
}

export interface PCRAnalysis {
  pcrByOI: number;
  pcrByVolume: number;
  sentiment: string;
  totalCallOI: number;
  totalPutOI: number;
  totalCallVolume: number;
  totalPutVolume: number;
}

export interface ATMAnalysis {
  spotPrice: number;
  atmStrike: number;
  strikeInterval: number;
  nearATMStrikes: {
    strike: number;
    distanceFromSpot: number;
    callOI: number;
    putOI: number;
    callVolume: number;
    putVolume: number;
  }[];
}

export interface OIAnalysis {
  buildupType: 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'SHORT_UNWINDING' | 'NEUTRAL';
  explanation: string;
  supportLevels: {
    strike: number;
    strength: number;
    reason: string;
  }[];
  resistanceLevels: {
    strike: number;
    strength: number;
    reason: string;
  }[];
  maxCallOIStrike: number;
  maxPutOIStrike: number;
  oiChangeAnalysis: {
    strike: number;
    callOIChange: number;
    putOIChange: number;
    interpretation: string;
  }[];
}

export interface LiquidityMetrics {
  totalContracts: number;
  liquidContracts: number;
  illiquidContracts: number;
  averageVolume: number;
  averageOI: number;
  averageBidAskSpread: number;
}

export interface OptionsAnalysisResult {
  symbol: string;
  expiryDate: string;
  spotPrice: number;
  timestamp: Date;
  pcrAnalysis: PCRAnalysis;
  atmAnalysis: ATMAnalysis;
  oiAnalysis: OIAnalysis;
}

// ============================================================================
// Options Risk Types (Task 71.2)
// ============================================================================

export interface OptionsRiskMetrics {
  totalOptionsExposure: number; // Absolute value in currency
  totalOptionsExposurePercent: number; // Percentage of portfolio (0-100)
  maxOptionsExposurePercent: number; // Maximum allowed (default 20%)
  optionsPositionCount: number; // Number of open options positions
  maxOpenPositions?: number; // Maximum allowed positions
  liquidityWarnings: OptionsLiquidityWarning[];
  riskViolations: OptionsRiskViolation[];
  recommendations: string[];
}

export interface OptionsLiquidityWarning {
  symbol: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  reason: string; // e.g., "Wide Bid-Ask Spread", "Low Volume", "Low OI"
  severity: 'WARNING' | 'CRITICAL';
}

export interface OptionsRiskViolation {
  rule: string; // e.g., "MAX_OPTIONS_EXPOSURE", "ILLIQUID_POSITION"
  message: string;
  severity: 'ERROR' | 'WARNING';
  currentValue?: number;
  limit?: number;
}

// ============================================================================
// API Client Class
// ============================================================================

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:4000/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Internal fetch wrapper with error handling
   */
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  // ==========================================================================
  // Prompt and Analysis Endpoints
  // ==========================================================================

  /**
   * Submit a natural language prompt for analysis
   * POST /prompt
   *
   * Orchestrates: Prompt parsing → Market data → Quant analysis → AI recommendation
   */
  async submitPrompt(prompt: string): Promise<PromptResponse> {
    return this.fetch<PromptResponse>('/prompt', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  // ==========================================================================
  // Portfolio Endpoints
  // ==========================================================================

  /**
   * Get complete portfolio for a user
   * GET /portfolio?userId={userId}
   *
   * Returns all open positions with real-time PnL and portfolio metrics
   */
  async getPortfolio(userId: string): Promise<Portfolio> {
    return this.fetch<Portfolio>(`/portfolio?userId=${encodeURIComponent(userId)}`);
  }

  /**
   * Get options positions for a user
   * GET /portfolio/options?userId={userId}
   *
   * Returns all open options positions with Greeks, expiry alerts, and P&L
   */
  async getOptionsPositions(userId: string): Promise<OptionsPositionInfo[]> {
    return this.fetch<OptionsPositionInfo[]>(`/portfolio/options?userId=${encodeURIComponent(userId)}`);
  }

  // ==========================================================================
  // Trading Endpoints
  // ==========================================================================

  /**
   * Execute a paper trade (simulation only)
   * POST /trade/paper
   *
   * Paper trades do NOT call broker API
   */
  async executePaperTrade(request: TradeRequest): Promise<TradeResult> {
    return this.fetch<TradeResult>('/trade/paper', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Execute a live trade (requires user confirmation)
   * POST /trade/live
   *
   * Live trades require userConfirmed=true and call broker API
   */
  async executeLiveTrade(request: TradeRequest & { userConfirmed: boolean }): Promise<TradeResult> {
    return this.fetch<TradeResult>('/trade/live', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Execute a paper trade for options contracts (Task 73.3)
   * POST /api/trade/paper/option
   *
   * Paper trades do NOT call broker API
   * Options trading is paper trading ONLY - NO live trading for options
   */
  async executePaperOptionTrade(request: PaperOptionTradeRequest): Promise<TradeResult> {
    return this.fetch<TradeResult>('/trade/paper/option', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ==========================================================================
  // Risk Validation Endpoints
  // ==========================================================================

  /**
   * Validate a trade request against risk rules
   * POST /risk/validate
   *
   * Checks position size, stop loss, portfolio exposure, etc.
   */
  async validateTrade(request: TradeRequest): Promise<RiskValidationResult> {
    return this.fetch<RiskValidationResult>('/risk/validate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ==========================================================================
  // Market Data Endpoints
  // ==========================================================================

  /**
   * Get market data for a symbol
   * GET /market-data?symbol={symbol}&timeframe={timeframe}
   *
   * Returns OHLCV data for the requested symbol and timeframe
   */
  async getMarketData(
    symbol: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d' = '1d'
  ): Promise<MarketDataResponse> {
    return this.fetch<MarketDataResponse>(
      `/market-data?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
    );
  }

  /**
   * Get options chain for NIFTY or BANKNIFTY
   * GET /market-data/options-chain?underlying={underlying}&expiryDate={expiryDate}
   *
   * Returns complete options chain with Greeks
   * @deprecated Use fetchOptionsChain instead
   */
  async getOptionsChain(
    underlying: 'NIFTY' | 'BANKNIFTY',
    expiryDate?: string
  ): Promise<OptionsChainResponse> {
    let url = `/market-data/options-chain?underlying=${underlying}`;
    if (expiryDate) {
      url += `&expiryDate=${encodeURIComponent(expiryDate)}`;
    }
    return this.fetch<OptionsChainResponse>(url);
  }

  // ==========================================================================
  // Options Chain Endpoints (Task 70.4)
  // ==========================================================================

  /**
   * Fetch complete options chain with analysis
   * POST /options/chain
   *
   * Returns:
   * - All option contracts (calls and puts) with Greeks, IV, liquidity warnings
   * - PCR analysis (OI and volume based)
   * - ATM strike identification and near ATM strikes (±3)
   * - OI buildup/unwinding analysis
   * - Support/resistance levels from OI concentrations
   * - Liquidity metrics and illiquid contract warnings
   *
   * Requirements: 7.1, 13.1
   */
  async fetchOptionsChain(request: OptionsChainRequest): Promise<OptionsChainData> {
    return this.fetch<OptionsChainData>('/options/chain', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Analyze options chain for PCR, ATM strikes, OI analysis, and support/resistance
   * POST /options/analyze
   *
   * Returns:
   * - PCR (Put-Call Ratio) analysis from OI and volume
   * - ATM strike identification and near ATM strikes (±3)
   * - OI buildup/unwinding analysis (long buildup, short buildup, long unwinding, short unwinding)
   * - Support zones identified from high put OI
   * - Resistance zones identified from high call OI
   * - Max Call/Put OI strikes
   * - OI change analysis with interpretations
   *
   * Requirements: 7.1, 13.1
   */
  async analyzeOptionsChain(request: OptionsAnalysisRequest): Promise<OptionsAnalysisResult> {
    return this.fetch<OptionsAnalysisResult>('/options/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ==========================================================================
  // Intraday Trading Endpoints
  // ==========================================================================

  /**
   * Analyze a symbol for intraday trading opportunities
   * POST /intraday/analyze
   *
   * Performs fresh analysis by:
   * 1. Fetching latest intraday market data
   * 2. Validating data freshness
   * 3. Performing comprehensive technical analysis via Quant Engine
   * 4. Generating recommendation with confidence and risk/reward validation
   * 
   * CRITICAL: NO automatic refresh - manual trigger only
   */
  async analyzeIntraday(request: IntradayAnalysisRequest): Promise<IntradayAnalysisResponse> {
    return this.fetch<IntradayAnalysisResponse>('/intraday/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Check data freshness for a symbol
   * GET /intraday/freshness/:symbol
   *
   * Validates if cached data is fresh enough for intraday trading
   * Returns age of cached data and freshness status
   */
  async checkIntradayFreshness(symbol: string): Promise<IntradayFreshnessResponse> {
    return this.fetch<IntradayFreshnessResponse>(`/intraday/freshness/${symbol}`);
  }

  /**
   * Get available timeframes for intraday analysis
   * GET /intraday/timeframes
   *
   * Returns the supported timeframes for intraday analysis
   */
  async getIntradayTimeframes(): Promise<IntradayTimeframesResponse> {
    return this.fetch<IntradayTimeframesResponse>('/intraday/timeframes');
  }

  // ==========================================================================
  // Swing Trading Endpoints
  // ==========================================================================

  /**
   * Scan stock universe for swing trading opportunities
   * POST /swing/scan
   *
   * Scans configured stock universe and returns top-ranked candidates
   * based on technical analysis and deterministic scoring.
   */
  async scanSwingUniverse(request: SwingScanRequest): Promise<SwingScanResponse> {
    return this.fetch<SwingScanResponse>('/swing/scan', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Analyze a specific symbol for swing trading
   * POST /swing/analyze/:symbol
   *
   * Performs deep analysis on a specific stock for swing trading opportunities
   */
  async analyzeSwingSymbol(symbol: string, userId?: string): Promise<SwingAnalysisResponse> {
    return this.fetch<SwingAnalysisResponse>(`/swing/analyze/${symbol}`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  /**
   * Execute paper trade for swing opportunity
   * POST /swing/paper-trade
   *
   * Executes a paper trade (simulated) for a swing trading setup
   */
  async executeSwingPaperTrade(request: SwingPaperTradeRequest): Promise<SwingPaperTradeResponse> {
    return this.fetch<SwingPaperTradeResponse>('/swing/paper-trade', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

// ============================================================================
// Swing Trading Types
// ============================================================================

export interface SwingScanRequest {
  minScore?: number;
  maxResults?: number;
  sectorFilter?: string;
  userId?: string;
}

export interface SwingCandidate {
  symbol: string;
  score: number;
  trend: string;
  setupType: string;
  entry: number;
  stopLoss: number;
  target: number;
  riskReward: number;
  components: {
    trendScore: number;
    technicalScore: number;
    volumeScore: number;
    relativeStrengthScore: number;
    breakoutScore: number;
    sectorScore: number;
    riskRewardScore: number;
  };
}

export interface SwingScanResponse {
  scannedCount: number;
  candidatesFound: number;
  candidates: SwingCandidate[];
}

export interface SwingAnalysisResponse {
  message: string;
  status: string;
  // TODO: Add detailed analysis fields when implemented
}

export interface SwingPaperTradeRequest {
  userId: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  target: number;
  signalId?: string;
}

export interface SwingPaperTradeResponse {
  success: boolean;
  tradeId: string;
  message: string;
  trade: {
    symbol: string;
    quantity: number;
    entryPrice: number;
    stopLoss: number;
    target: number;
    status: string;
    simulatedSlippage: number;
  };
}

// ============================================================================
// Intraday Trading Types
// ============================================================================

export interface IntradayAnalysisRequest {
  symbol: string;
  interval?: '1m' | '5m' | '15m' | '30m' | '1h';
  userId?: string;
}

export interface DataFreshness {
  timestamp: string; // ISO 8601 format
  ageSeconds: number;
  isStale: boolean;
}

export interface IntradayTechnicalAnalysis {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  ema_9: number;
  ema_21: number;
  ema_50: number;
  vwap: number;
  atr: number;
  volume: number;
  relativeVolume: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  supportLevels: number[];
  resistanceLevels: number[];
}

export interface IntradayRecommendation {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE';
  confidence: number;
  timestamp: string;
  entry: number;
  stopLoss: number;
  target: number;
  riskReward: number;
  currentPrice: number;
  vwap: number;
  ema5: number;
  ema15: number;
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  openingRange: {
    high: number;
    low: number;
    open: number;
  };
  previousDayHigh: number;
  previousDayLow: number;
  isStale: boolean;
  dataTimestamp: string;
  rationale: string;
  validUntil?: string;
  warnings?: string[];
}

export interface IntradayAnalysisResponse {
  symbol: string;
  interval: string;
  timestamp: string;
  dataFreshness: DataFreshness;
  technicalAnalysis: IntradayTechnicalAnalysis;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  recommendation: IntradayRecommendation;
}

export interface IntradayFreshnessResponse {
  symbol: string;
  dataFreshness: DataFreshness;
}

export interface IntradayTimeframesResponse {
  timeframes: Array<{
    value: string;
    label: string;
    description: string;
  }>;
  default: string[];
  recommended: string[];
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const apiClient = new ApiClient();

// Also export the class for testing/custom instances
export { ApiClient };
