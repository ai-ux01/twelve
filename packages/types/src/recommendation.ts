// AI recommendation types

import { TradeAction, AssetType, TradeType, RecommendationOutcome } from './common';
import { QuantAnalysisResult } from './quant';

export interface Recommendation {
  id: string;
  action: TradeAction;
  symbol: string;
  assetType: AssetType;
  tradeType: TradeType;
  entryPrice: number;
  target: number;
  stopLoss: number;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  quantData: QuantAnalysisResult;
  createdAt: Date | string;
  outcome?: RecommendationOutcome;
  actualReturn?: number;
}

export interface ParsedPrompt {
  intent: 'FIND_TRADE' | 'ANALYZE_PORTFOLIO' | 'GENERATE_STRATEGY';
  symbols: string[];
  timeframe: TradeType;
  assetType: AssetType;
}
