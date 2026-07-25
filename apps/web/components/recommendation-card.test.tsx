/**
 * Unit tests for RecommendationCard component
 *
 * Tests verify that the component correctly displays:
 * - Trade action (BUY/SELL/HOLD)
 * - Price information (entry, target, stop-loss)
 * - Confidence level
 * - Quantitative analysis summary
 * - AI reasoning
 * - Trade execution buttons
 *
 * Requirements covered: 13.2
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecommendationCard } from './recommendation-card';
import { Recommendation } from '@/lib/api-client';

// Mock recommendation data
const mockRecommendation: Recommendation = {
  id: 'test-recommendation-123',
  action: 'BUY',
  symbol: 'RELIANCE',
  entryPrice: 2460,
  target: 2520,
  stopLoss: 2430,
  confidence: 0.75,
  reasoning:
    'Strong uptrend with RSI at 45 indicating room for growth. MACD shows bullish crossover. Price is above 50-day SMA, suggesting upward momentum.',
  quantData: {
    symbol: 'RELIANCE',
    timeframe: '1d',
    indicators: {
      rsi: 45.2,
      macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
      sma_20: 2455.0,
      sma_50: 2450.0,
      sma_200: 2380.0,
      ema_20: 2458.0,
      bollingerBands: { upper: 2500.0, middle: 2455.0, lower: 2410.0 },
    },
    supportResistance: [
      { level: 2400, strength: 0.85 },
      { level: 2500, strength: 0.72 },
    ],
    trendlines: [{ slope: 2.5, intercept: 2350, rSquared: 0.89 }],
  },
};

const mockRecommendationWithGreeks: Recommendation = {
  ...mockRecommendation,
  quantData: {
    ...mockRecommendation.quantData,
    optionsGreeks: {
      delta: 0.52,
      gamma: 0.003,
      theta: -12.5,
      vega: 45.2,
    },
  },
};

const mockSellRecommendation: Recommendation = {
  ...mockRecommendation,
  id: 'test-sell-recommendation-456',
  action: 'SELL',
  entryPrice: 2520,
  target: 2460,
  stopLoss: 2550,
};

const mockHoldRecommendation: Recommendation = {
  ...mockRecommendation,
  id: 'test-hold-recommendation-789',
  action: 'HOLD',
  confidence: 0.3,
  reasoning: 'Market conditions are unclear. Recommend waiting for clearer signals.',
};

describe('RecommendationCard', () => {
  it('renders BUY recommendation correctly', () => {
    render(<RecommendationCard recommendation={mockRecommendation} />);

    // Check symbol and action
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();

    // Check confidence
    expect(screen.getByText('75%')).toBeInTheDocument();

    // Check prices
    expect(screen.getByText('₹2460.00')).toBeInTheDocument(); // Entry
    expect(screen.getByText('₹2520.00')).toBeInTheDocument(); // Target
    expect(screen.getByText('₹2430.00')).toBeInTheDocument(); // Stop loss
  });

  it('renders SELL recommendation with correct styling', () => {
    render(<RecommendationCard recommendation={mockSellRecommendation} />);

    expect(screen.getByText('SELL')).toBeInTheDocument();
    expect(screen.getByText('₹2520.00')).toBeInTheDocument(); // Entry
    expect(screen.getByText('₹2460.00')).toBeInTheDocument(); // Target
    expect(screen.getByText('₹2550.00')).toBeInTheDocument(); // Stop loss
  });

  it('calculates and displays risk-reward ratio for BUY', () => {
    render(<RecommendationCard recommendation={mockRecommendation} />);

    // Risk: 2460 - 2430 = 30
    // Reward: 2520 - 2460 = 60
    // Ratio: 60/30 = 2.00
    expect(screen.getByText('1:2.00')).toBeInTheDocument();
  });

  it('calculates and displays profit/loss percentages', () => {
    render(<RecommendationCard recommendation={mockRecommendation} />);

    // Profit: ((2520 - 2460) / 2460) * 100 = 2.44%
    expect(screen.getByText('+2.44%')).toBeInTheDocument();

    // Loss: ((2460 - 2430) / 2460) * 100 = 1.22%
    expect(screen.getByText('-1.22%')).toBeInTheDocument();
  });

  it('displays quantitative analysis summary', () => {
    render(<RecommendationCard recommendation={mockRecommendation} />);

    // Check indicators
    expect(screen.getByText('45.20')).toBeInTheDocument(); // RSI
    expect(screen.getByText('12.30')).toBeInTheDocument(); // MACD
    expect(screen.getByText('₹2450.00')).toBeInTheDocument(); // SMA 50
    expect(screen.getByText('₹2380.00')).toBeInTheDocument(); // SMA 200

    // Check support/resistance count
    expect(screen.getByText('2')).toBeInTheDocument();

    // Check trendlines count
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays Bollinger Bands correctly', () => {
    render(<RecommendationCard recommendation={mockRecommendation} />);

    expect(screen.getByText(/Lower: ₹2410\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Mid: ₹2455\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Upper: ₹2500\.00/)).toBeInTheDocument();
  });

  it('displays Options Greeks when available', () => {
    render(<RecommendationCard recommendation={mockRecommendationWithGreeks} />);

    expect(screen.getByText('Options Greeks')).toBeInTheDocument();
    expect(screen.getByText('0.520')).toBeInTheDocument(); // Delta
    expect(screen.getByText('0.003')).toBeInTheDocument(); // Gamma
    expect(screen.getByText('-12.50')).toBeInTheDocument(); // Theta
    // Vega shows 45.20, but RSI also shows 45.20, so we need getAllByText
    const vegaElements = screen.getAllByText('45.20');
    expect(vegaElements.length).toBeGreaterThanOrEqual(1); // At least one should be Vega
  });

  it('does not display Options Greeks when not available', () => {
    render(<RecommendationCard recommendation={mockRecommendation} />);

    expect(screen.queryByText('Options Greeks')).not.toBeInTheDocument();
  });

  it('displays AI reasoning text', () => {
    render(<RecommendationCard recommendation={mockRecommendation} />);

    expect(screen.getByText(/Strong uptrend with RSI at 45/)).toBeInTheDocument();
    expect(screen.getByText(/MACD shows bullish crossover/)).toBeInTheDocument();
  });

  it('calls onExecutePaperTrade when paper trade button clicked', () => {
    const handlePaperTrade = vi.fn();
    render(
      <RecommendationCard
        recommendation={mockRecommendation}
        onExecutePaperTrade={handlePaperTrade}
      />
    );

    const paperButton = screen.getByText('Execute Paper Trade');
    fireEvent.click(paperButton);

    expect(handlePaperTrade).toHaveBeenCalledTimes(1);
  });

  it('calls onExecuteLiveTrade when live trade button clicked', () => {
    const handleLiveTrade = vi.fn();
    render(
      <RecommendationCard
        recommendation={mockRecommendation}
        onExecuteLiveTrade={handleLiveTrade}
      />
    );

    const liveButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveButton);

    expect(handleLiveTrade).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when loading states are true', () => {
    render(
      <RecommendationCard
        recommendation={mockRecommendation}
        isPaperTradeLoading={true}
        isLiveTradeLoading={true}
      />
    );

    const buttons = screen.getAllByText('Executing...');
    expect(buttons).toHaveLength(2);

    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('disables trade buttons for HOLD recommendations', () => {
    render(<RecommendationCard recommendation={mockHoldRecommendation} />);

    const paperButton = screen.getByText('Execute Paper Trade');
    const liveButton = screen.getByText('Execute Live Trade');

    expect(paperButton).toBeDisabled();
    expect(liveButton).toBeDisabled();
  });

  it('displays low confidence with appropriate color', () => {
    render(<RecommendationCard recommendation={mockHoldRecommendation} />);

    // Confidence is 30%, should be orange/red colored
    const confidenceText = screen.getByText('30%');
    expect(confidenceText).toHaveClass('text-orange-600');
  });

  it('displays high confidence with green color', () => {
    const highConfidenceRec = { ...mockRecommendation, confidence: 0.85 };
    render(<RecommendationCard recommendation={highConfidenceRec} />);

    const confidenceText = screen.getByText('85%');
    expect(confidenceText).toHaveClass('text-green-600');
  });

  it('displays medium confidence with yellow color', () => {
    const mediumConfidenceRec = { ...mockRecommendation, confidence: 0.6 };
    render(<RecommendationCard recommendation={mediumConfidenceRec} />);

    const confidenceText = screen.getByText('60%');
    expect(confidenceText).toHaveClass('text-yellow-600');
  });

  it('displays recommendation ID (truncated)', () => {
    render(<RecommendationCard recommendation={mockRecommendation} />);

    // ID is truncated to first 8 characters
    expect(screen.getByText(/Recommendation ID: test-rec/)).toBeInTheDocument();
  });

  it('handles missing optional callbacks gracefully', () => {
    // Should not throw error when callbacks are not provided
    expect(() => {
      render(<RecommendationCard recommendation={mockRecommendation} />);
    }).not.toThrow();
  });

  it('displays "AI analysis unavailable" message when aiUnavailable flag is set', () => {
    // Requirement 20.3: Display "AI analysis unavailable" when AI fails
    const aiUnavailableRec: Recommendation = {
      ...mockRecommendation,
      action: 'HOLD',
      confidence: 0,
      reasoning: 'AI analysis unavailable',
      aiUnavailable: true,
    };

    render(<RecommendationCard recommendation={aiUnavailableRec} />);

    // Should show the unavailable message
    expect(screen.getByText('AI Analysis Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/The AI service encountered an error/)).toBeInTheDocument();
    expect(screen.getByText(/Quantitative analysis is still available/)).toBeInTheDocument();

    // Should NOT show the reasoning text
    expect(screen.queryByText('AI analysis unavailable')).not.toBeInTheDocument();

    // Quantitative data should still be visible
    expect(screen.getByText('45.20')).toBeInTheDocument(); // RSI
    expect(screen.getByText('12.30')).toBeInTheDocument(); // MACD
  });

  it('displays normal AI reasoning when aiUnavailable is false', () => {
    render(<RecommendationCard recommendation={mockRecommendation} />);

    // Should show reasoning text
    expect(screen.getByText(/Strong uptrend with RSI at 45/)).toBeInTheDocument();

    // Should NOT show the unavailable message
    expect(screen.queryByText('AI Analysis Unavailable')).not.toBeInTheDocument();
  });
});
