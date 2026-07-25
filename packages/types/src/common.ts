// Common types

export enum AssetType {
  STOCK = 'STOCK',
  OPTION_CALL = 'OPTION_CALL',
  OPTION_PUT = 'OPTION_PUT',
}

export enum TradeType {
  SWING = 'SWING',
  INTRADAY = 'INTRADAY',
  SCALPING = 'SCALPING',
}

export enum TradeAction {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
}

export enum PositionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  STOPPED = 'STOPPED',
}

export enum TradeStatus {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum RecommendationOutcome {
  WIN = 'WIN',
  LOSS = 'LOSS',
  BREAK_EVEN = 'BREAK_EVEN',
  NOT_EXECUTED = 'NOT_EXECUTED',
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d';
