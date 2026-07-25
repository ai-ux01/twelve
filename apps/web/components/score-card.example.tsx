/**
 * ScoreCard Component Usage Example
 * 
 * This file demonstrates how to use the ScoreCard component with sample data.
 */

import { ScoreCard } from './score-card';
import { ScoreResult } from '@/lib/api-client';

// Example 1: Bullish market score
const bullishScore: ScoreResult = {
  trend: 'BULLISH',
  score: 78.5,
  rsi: 65.4,
  adx: 28.5,
  vwap: 2465.50,
  volumeRatio: 1.25,
  signals: [
    'Strong upward trend detected (ADX: 28.5)',
    'RSI in bullish range (65.4)',
    'Price above VWAP',
    'Above average volume (1.25x average)',
  ],
};

// Example 2: Bearish market score
const bearishScore: ScoreResult = {
  trend: 'BEARISH',
  score: 25.8,
  rsi: 32.1,
  adx: 31.2,
  vwap: 2450.00,
  volumeRatio: 1.45,
  signals: [
    'Strong downward trend detected',
    'RSI in bearish range',
  ],
};

// Example 3: Neutral market score
const neutralScore: ScoreResult = {
  trend: 'NEUTRAL',
  score: 50.2,
  rsi: 48.3,
  adx: 18.7,
  vwap: 2460.00,
  volumeRatio: 0.85,
  signals: [
    'Weak trend detected',
    'RSI neutral',
  ],
};

export function ScoreCardExamples() {
  return (
    <div className="space-y-6 p-8">
      <div>
        <h2 className="mb-4 text-2xl font-bold">Bullish Market</h2>
        <ScoreCard score={bullishScore} />
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-bold">Bearish Market</h2>
        <ScoreCard score={bearishScore} />
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-bold">Neutral Market</h2>
        <ScoreCard score={neutralScore} />
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-bold">With Custom Styling</h2>
        <ScoreCard score={bullishScore} className="max-w-md border-2 border-primary" />
      </div>
    </div>
  );
}
