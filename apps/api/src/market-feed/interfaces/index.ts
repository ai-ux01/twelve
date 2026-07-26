export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING';

export interface NormalizedTick {
  instrumentToken: string;
  exchange: string;
  symbol: string;
  lastPrice: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  oi: number;
  bid: number;
  ask: number;
  timestamp: string; // ISO-8601
}

export interface DepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

export interface NormalizedDepth {
  instrumentToken: string;
  bids: DepthLevel[];
  asks: DepthLevel[];
  bestBid: number;
  bestAsk: number;
  spread: number;
  timestamp: string;
}

export interface RawHsmTick {
  tk: string;
  lp: string;
  op?: string;
  hp?: string;
  lop?: string;
  pc?: string;
  v?: string;
  oi?: string;
  bp1?: string;
  sp1?: string;
  bq1?: string;
  sq1?: string;
  ts?: string;
  e?: string;
  n?: string;
}

export interface RawHsmDepth {
  tk: string;
  e: string;
  bp1?: string;
  bq1?: string;
  bo1?: string;
  bp2?: string;
  bq2?: string;
  bo2?: string;
  bp3?: string;
  bq3?: string;
  bo3?: string;
  bp4?: string;
  bq4?: string;
  bo4?: string;
  bp5?: string;
  bq5?: string;
  bo5?: string;
  sp1?: string;
  sq1?: string;
  so1?: string;
  sp2?: string;
  sq2?: string;
  so2?: string;
  sp3?: string;
  sq3?: string;
  so3?: string;
  sp4?: string;
  sq4?: string;
  so4?: string;
  sp5?: string;
  sq5?: string;
  so5?: string;
  ts?: string;
}

export interface IMarketDataProvider {
  connect(auth: string, sid: string, dataCenter: string): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(subscriptionStrings: string[]): void;
  unsubscribe(subscriptionStrings: string[]): void;
  getConnectionStatus(): ConnectionStatus;
  getActiveSubscriptions(): string[];
  onTick(handler: (rawTick: RawHsmTick) => void): void;
  onDepth(handler: (rawDepth: RawHsmDepth) => void): void;
  onStatusChange(handler: (status: ConnectionStatus) => void): void;
}

export const MARKET_DATA_PROVIDER = Symbol('IMarketDataProvider');
