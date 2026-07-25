/**
 * Query Keys Factory
 *
 * Organized query keys by domain for consistent cache management.
 * Using factory pattern to ensure type-safe and maintainable query keys.
 *
 * Domains:
 * - market: Market data, prices, charts
 * - portfolio: Positions, PnL, portfolio metrics
 * - recommendations: AI recommendations and their outcomes
 *
 * Requirements: 13.6
 */

/**
 * Market data query keys
 *
 * Hierarchy:
 * - ['market'] - all market data
 * - ['market', symbol] - all data for a specific symbol
 * - ['market', symbol, timeframe] - specific timeframe data
 * - ['market', 'options', underlying] - options chain data
 */
const marketBase = ['market'] as const;

export const marketKeys = {
  // Base key for all market data
  all: marketBase,

  // All data for a specific symbol
  symbol: (symbol: string) => [...marketBase, symbol] as const,

  // Price data for a specific symbol and timeframe
  price: (symbol: string, timeframe: string) =>
    [...marketBase, symbol, 'price', timeframe] as const,

  // Current quote for a symbol
  quote: (symbol: string) => [...marketBase, symbol, 'quote'] as const,

  // Historical OHLCV data
  ohlcv: (symbol: string, timeframe: string, from?: string, to?: string) =>
    [...marketBase, symbol, 'ohlcv', timeframe, { from, to }] as const,

  // Options chain data
  options: {
    all: [...marketBase, 'options'] as const,
    chain: (underlying: 'NIFTY' | 'BANKNIFTY', expiry?: string) =>
      [...marketBase, 'options', underlying, 'chain', { expiry }] as const,
    greeks: (underlying: string, strike: number, optionType: 'CALL' | 'PUT', expiry: string) =>
      [...marketBase, 'options', underlying, 'greeks', strike, optionType, expiry] as const,
  },
} as const;

/**
 * Portfolio query keys
 *
 * Hierarchy:
 * - ['portfolio'] - all portfolio data
 * - ['portfolio', 'overview'] - portfolio summary
 * - ['portfolio', 'positions'] - all positions
 * - ['portfolio', 'positions', positionId] - specific position
 * - ['portfolio', 'metrics'] - performance metrics
 */
const portfolioBase = ['portfolio'] as const;

export const portfolioKeys = {
  // Base key for all portfolio data
  all: portfolioBase,

  // Portfolio overview with totals and summary
  overview: () => [...portfolioBase, 'overview'] as const,

  // All positions
  positions: {
    all: [...portfolioBase, 'positions'] as const,
    list: (filters?: { status?: string; isPaper?: boolean }) =>
      [...portfolioBase, 'positions', 'list', filters] as const,
    detail: (positionId: string) => [...portfolioBase, 'positions', 'detail', positionId] as const,
  },

  // Portfolio metrics and performance
  metrics: () => [...portfolioBase, 'metrics'] as const,

  // Trade history
  trades: {
    all: [...portfolioBase, 'trades'] as const,
    list: (filters?: { isPaper?: boolean; startDate?: string; endDate?: string }) =>
      [...portfolioBase, 'trades', 'list', filters] as const,
    detail: (tradeId: string) => [...portfolioBase, 'trades', 'detail', tradeId] as const,
  },
} as const;

/**
 * AI Recommendations query keys
 *
 * Hierarchy:
 * - ['recommendations'] - all recommendations
 * - ['recommendations', 'list'] - paginated list
 * - ['recommendations', recommendationId] - specific recommendation
 * - ['recommendations', 'performance'] - AI performance metrics
 */
const recommendationBase = ['recommendations'] as const;

export const recommendationKeys = {
  // Base key for all recommendations
  all: recommendationBase,

  // List of recommendations with filters
  list: (filters?: {
    symbol?: string;
    assetType?: string;
    tradeType?: string;
    startDate?: string;
    endDate?: string;
  }) => [...recommendationBase, 'list', filters] as const,

  // Specific recommendation by ID
  detail: (recommendationId: string) =>
    [...recommendationBase, 'detail', recommendationId] as const,

  // AI performance metrics
  performance: () => [...recommendationBase, 'performance'] as const,

  // Recent recommendations (last N)
  recent: (limit: number = 10) => [...recommendationBase, 'recent', limit] as const,
} as const;

/**
 * Prompt analysis query keys
 *
 * Used for caching user prompt analysis results
 */
export const promptKeys = {
  all: ['prompt'] as const,

  // Analysis result for a specific prompt
  analysis: (prompt: string) => [...promptKeys.all, 'analysis', prompt] as const,
} as const;

/**
 * Risk validation query keys
 *
 * Used for caching risk validation results
 */
export const riskKeys = {
  all: ['risk'] as const,

  // Validation result for a trade request
  validate: (tradeRequest: { symbol: string; action: string; quantity: number; price: number }) =>
    [...riskKeys.all, 'validate', tradeRequest] as const,

  // Current risk parameters
  parameters: () => [...riskKeys.all, 'parameters'] as const,
} as const;

/**
 * Strategy query keys
 *
 * For AI-generated trading strategies
 */
export const strategyKeys = {
  all: ['strategy'] as const,

  // List all strategies
  list: (filters?: { isActive?: boolean }) => [...strategyKeys.all, 'list', filters] as const,

  // Specific strategy
  detail: (strategyId: string) => [...strategyKeys.all, 'detail', strategyId] as const,

  // Backtest results for a strategy
  backtest: (strategyId: string) => [...strategyKeys.all, 'backtest', strategyId] as const,
} as const;

/**
 * Helper to invalidate all queries for a specific domain
 *
 * Usage:
 * queryClient.invalidateQueries({ queryKey: marketKeys.all })
 * queryClient.invalidateQueries({ queryKey: portfolioKeys.all })
 * queryClient.invalidateQueries({ queryKey: recommendationKeys.all })
 */
