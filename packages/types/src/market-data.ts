// Market data types

export interface OHLCVData {
  timestamp: Date | string;
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
}
