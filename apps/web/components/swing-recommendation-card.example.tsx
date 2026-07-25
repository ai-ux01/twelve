/**
 * SwingRecommendationCard - Example Usage
 * 
 * This file demonstrates how to use the SwingRecommendationCard component
 * in different scenarios.
 */

import { SwingRecommendationCard } from './swing-recommendation-card';
import { SwingCandidate } from '@/lib/api-client';

// Example 1: Strong BUY recommendation
const strongBuyCandidate: SwingCandidate = {
  symbol: 'RELIANCE',
  score: 85.5,
  trend: 'STRONG_UPTREND',
  setupType: 'EMA Breakout with Volume Confirmation',
  entry: 2460.0,
  stopLoss: 2430.0,
  target: 2520.0,
  riskReward: 2.0,
  components: {
    trendScore: 90,
    technicalScore: 85,
    volumeScore: 88,
    relativeStrengthScore: 82,
    breakoutScore: 90,
    sectorScore: 75,
    riskRewardScore: 85,
  },
};

// Example 2: Moderate candidate
const moderateCandidate: SwingCandidate = {
  symbol: 'TCS',
  score: 68.5,
  trend: 'UPTREND',
  setupType: 'EMA50 Bounce',
  entry: 3800.0,
  stopLoss: 3750.0,
  target: 3900.0,
  riskReward: 2.0,
  components: {
    trendScore: 70,
    technicalScore: 68,
    volumeScore: 65,
    relativeStrengthScore: 70,
    breakoutScore: 60,
    sectorScore: 72,
    riskRewardScore: 75,
  },
};

export function SwingRecommendationCardExample() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Example 1: Strong BUY Candidate</h2>
        <SwingRecommendationCard candidate={strongBuyCandidate} userId="demo-user" />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Example 2: Moderate Candidate</h2>
        <SwingRecommendationCard candidate={moderateCandidate} userId="demo-user" />
      </div>
    </div>
  );
}
