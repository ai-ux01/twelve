/**
 * Standardized Broker Interfaces for Kotak Neo Integration
 *
 * These interfaces define the canonical data models used across the trading system.
 * The KotakNeoProvider transforms raw API responses into these standardized formats.
 */

// ============ Response Interfaces ============

/**
 * Standardized order representation from broker
 */
export interface BrokerOrder {
  brokerOrderId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  filledQuantity: number;
  price: number;
  averagePrice?: number;
  status: 'PENDING' | 'OPEN' | 'COMPLETE' | 'REJECTED' | 'CANCELLED';
  orderType: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
  productType: 'DELIVERY' | 'INTRADAY' | 'MIS' | 'CNC';
  timestamp: Date;
  statusMessage?: string;
}

/**
 * Standardized position representation from broker
 */
export interface BrokerPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  productType: 'DELIVERY' | 'INTRADAY' | 'MIS' | 'CNC';
  exchange: string;
}

/**
 * Standardized holding representation from broker
 */
export interface BrokerHolding {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentValue: number;
  pnl: number;
  isin: string;
}

/**
 * Standardized trade representation from broker
 */
export interface BrokerTrade {
  tradeId: string;
  brokerOrderId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: Date;
  exchange: string;
}

/**
 * Kill switch state - controls live trading availability
 * enabled=true means live trading is OFF (safe default)
 */
export interface KillSwitchState {
  enabled: boolean;
  updatedBy: string;
  updatedAt: Date;
}

// ============ Request Interfaces ============

/**
 * Request to place a new order with the broker
 */
export interface PlaceOrderRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
  productType: 'DELIVERY' | 'INTRADAY' | 'MIS' | 'CNC';
  exchange?: string;
  triggerPrice?: number;
  userConfirmed: boolean;
}

/**
 * Request to modify an existing order
 */
export interface ModifyOrderRequest {
  brokerOrderId: string;
  price?: number;
  quantity?: number;
  orderType?: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
  triggerPrice?: number;
}

/**
 * Request to cancel an existing order
 */
export interface CancelOrderRequest {
  brokerOrderId: string;
}

// ============ Kotak Neo Raw Response Types ============

/**
 * Raw Kotak Neo order response from API
 */
export interface KotakNeoRawOrderResponse {
  stat?: string;
  nOrdNo?: string;
  stCode?: number;
  message?: string;
  orderId?: string;
  tradingSymbol?: string;
  transactionType?: string;
  quantity?: string;
  filledQuantity?: string;
  orderPrice?: string;
  averagePrice?: string;
  orderStatus?: string;
  orderType?: string;
  productType?: string;
  orderTimestamp?: string;
  statusMessage?: string;
  // Short-form field names used in some Kotak Neo responses
  ts?: string;
  tt?: string;
  qt?: string;
  fq?: string;
  pr?: string;
  pt?: string;
  pc?: string;
  status?: string;
}

/**
 * Raw Kotak Neo position response from API
 */
export interface KotakNeoRawPositionResponse {
  tradingSymbol?: string;
  ts?: string;
  netQuantity?: string;
  nq?: string;
  averagePrice?: string;
  ap?: string;
  lastTradedPrice?: string;
  ltp?: string;
  pnl?: string;
  productType?: string;
  pc?: string;
  exchange?: string;
  es?: string;
}

/**
 * Raw Kotak Neo holding response from API
 */
export interface KotakNeoRawHoldingResponse {
  tradingSymbol?: string;
  ts?: string;
  quantity?: string;
  qt?: string;
  averagePrice?: string;
  ap?: string;
  lastTradedPrice?: string;
  ltp?: string;
  pnl?: string;
  isin?: string;
}

/**
 * Raw Kotak Neo trade response from API
 */
export interface KotakNeoRawTradeResponse {
  tradeId?: string;
  tid?: string;
  orderId?: string;
  nOrdNo?: string;
  tradingSymbol?: string;
  ts?: string;
  transactionType?: string;
  tt?: string;
  quantity?: string;
  qt?: string;
  tradePrice?: string;
  tp?: string;
  tradeTimestamp?: string;
  exchange?: string;
  es?: string;
}
