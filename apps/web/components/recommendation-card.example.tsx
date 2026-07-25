/**
 * Example usage of RecommendationCard component
 *
 * This file demonstrates how to use the RecommendationCard component
 * with mock data. Can be used for development and testing.
 */

'use client';

import { useState } from 'react';
import { RecommendationCard } from './recommendation-card';
import { Recommendation } from '@/lib/api-client';

// Mock recommendation data for BUY
const mockBuyRecommendation: Recommendation = {
  id: 'rec-buy-123456',
  action: 'BUY',
  symbol: 'RELIANCE',
  entryPrice: 2460,
  target: 2520,
  stopLoss: 2430,
  confidence: 0.78,
  reasoning:
    'Strong uptrend identified with RSI at 45, indicating room for upward movement without being overbought. MACD histogram shows bullish crossover with positive momentum. Price trading above both 50-day and 200-day SMAs, confirming uptrend. Support level at ₹2430 provides good risk-reward setup.',
  quantData: {
    symbol: 'RELIANCE',
    timeframe: '1d',
    indicators: {
      rsi: 45.2,
      macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
      sma_20: 2455.0,
      sma_50: 2450.0,
      sma_200: 2380.0,
      ema_5: 2462.0,
      ema_15: 2460.0,
      ema_20: 2458.0,
      ema_50: 2452.0,
      ema_200: 2385.0,
      bollingerBands: { upper: 2500.0, middle: 2455.0, lower: 2410.0 },
      adx: 25.0,
      atr: 45.0,
      vwap: 2456.0,
      volume_ma: 1000000,
      relative_volume: 1.2,
      week_52_high: 2800.0,
      week_52_low: 2100.0,
      momentum: 15.5,
    },
    supportResistance: [
      { level: 2400, strength: 0.85 },
      { level: 2430, strength: 0.92 },
      { level: 2500, strength: 0.78 },
      { level: 2550, strength: 0.65 },
    ],
    trendlines: [
      { slope: 2.5, intercept: 2350, rSquared: 0.89 },
      { slope: -1.2, intercept: 2580, rSquared: 0.72 },
    ],
  },
};

// Mock recommendation for SELL
const mockSellRecommendation: Recommendation = {
  id: 'rec-sell-789012',
  action: 'SELL',
  symbol: 'INFY',
  entryPrice: 1580,
  target: 1540,
  stopLoss: 1605,
  confidence: 0.68,
  reasoning:
    'Bearish divergence on MACD with price forming lower highs. RSI shows overbought condition at 72. Price has failed to break resistance at ₹1600 multiple times. Recommend short position with tight stop-loss.',
  quantData: {
    symbol: 'INFY',
    timeframe: '1d',
    indicators: {
      rsi: 72.5,
      macd: { value: -5.2, signal: -3.1, histogram: -2.1 },
      sma_20: 1570.0,
      sma_50: 1560.0,
      sma_200: 1540.0,
      ema_5: 1575.0,
      ema_15: 1573.0,
      ema_20: 1572.0,
      ema_50: 1565.0,
      ema_200: 1545.0,
      bollingerBands: { upper: 1600.0, middle: 1570.0, lower: 1540.0 },
      adx: 30.0,
      atr: 25.0,
      vwap: 1571.0,
      volume_ma: 500000,
      relative_volume: 1.1,
      week_52_high: 1620.0,
      week_52_low: 1450.0,
      momentum: -8.2,
    },
    supportResistance: [
      { level: 1540, strength: 0.88 },
      { level: 1600, strength: 0.94 },
    ],
    trendlines: [{ slope: -2.8, intercept: 1650, rSquared: 0.85 }],
  },
};

// Mock recommendation with Options Greeks
const mockOptionsRecommendation: Recommendation = {
  id: 'rec-options-345678',
  action: 'BUY',
  symbol: 'NIFTY 21600 CE',
  entryPrice: 125.5,
  target: 165.0,
  stopLoss: 105.0,
  confidence: 0.72,
  reasoning:
    'NIFTY showing bullish momentum with spot at 21450. The 21600 CE option has good delta exposure at 0.52 and manageable theta decay. Implied volatility at reasonable levels. Recommend buying for short-term upside play.',
  quantData: {
    symbol: 'NIFTY',
    timeframe: '15m',
    indicators: {
      rsi: 58.3,
      macd: { value: 8.5, signal: 6.2, histogram: 2.3 },
      sma_20: 21420.0,
      sma_50: 21380.0,
      sma_200: 21200.0,
      ema_5: 21430.0,
      ema_15: 21428.0,
      ema_20: 21425.0,
      ema_50: 21385.0,
      ema_200: 21205.0,
      bollingerBands: { upper: 21520.0, middle: 21420.0, lower: 21320.0 },
      adx: 28.0,
      atr: 85.0,
      vwap: 21422.0,
      volume_ma: 2000000,
      relative_volume: 1.3,
      week_52_high: 21850.0,
      week_52_low: 19800.0,
      momentum: 12.5,
    },
    supportResistance: [
      { level: 21350, strength: 0.82 },
      { level: 21600, strength: 0.75 },
    ],
    trendlines: [{ slope: 5.2, intercept: 21000, rSquared: 0.91 }],
    optionsGreeks: {
      delta: 0.52,
      gamma: 0.003,
      theta: -12.5,
      vega: 45.2,
    },
  },
};

export function RecommendationCardExample() {
  const [isPaperLoading, setIsPaperLoading] = useState(false);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  const handlePaperTrade = () => {
    setIsPaperLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsPaperLoading(false);
      alert('Paper trade executed successfully!');
    }, 1500);
  };

  const handleLiveTrade = () => {
    setIsLiveLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLiveLoading(false);
      alert('Live trade confirmation dialog would open here');
    }, 1500);
  };

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">RecommendationCard Component</h1>
        <p className="text-muted-foreground">
          Examples of the RecommendationCard component displaying AI trade recommendations
        </p>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">BUY Recommendation (Stock)</h2>
          <RecommendationCard
            recommendation={mockBuyRecommendation}
            onExecutePaperTrade={handlePaperTrade}
            onExecuteLiveTrade={handleLiveTrade}
            isPaperTradeLoading={isPaperLoading}
            isLiveTradeLoading={isLiveLoading}
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">SELL Recommendation (Stock)</h2>
          <RecommendationCard
            recommendation={mockSellRecommendation}
            onExecutePaperTrade={handlePaperTrade}
            onExecuteLiveTrade={handleLiveTrade}
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Options Recommendation (with Greeks)</h2>
          <RecommendationCard
            recommendation={mockOptionsRecommendation}
            onExecutePaperTrade={handlePaperTrade}
            onExecuteLiveTrade={handleLiveTrade}
          />
        </div>
      </div>
    </div>
  );
}
