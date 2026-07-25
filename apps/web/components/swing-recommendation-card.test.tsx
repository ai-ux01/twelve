import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwingRecommendationCard, SwingRecommendation } from './swing-recommendation-card';

describe('SwingRecommendationCard', () => {
  const mockBuyRecommendation: SwingRecommendation = {
    stock: 'RELIANCE',
    signal: 'BUY',
    setup: 'EMA Breakout with Volume Confirmation',
    entry: 2460.0,
    stopLoss: 2430.0,
    target: 2520.0,
    riskReward: 2.0,
    probability: 0.75,
    trend: 'Strong Uptrend',
    volume: 'High Volume Confirmation',
    trendline: 'Support at ascending trendline',
    support: [2400, 2380, 2350],
    resistance: [2500, 2550, 2600],
    marketRegime: 'Bull Market',
    rationale:
      'Strong uptrend with EMA alignment (20 > 50 > 200). Price broke above resistance at 2450 with high volume. RSI at 58 indicates room for upside. ADX above 30 confirms strong trend.',
    invalidationCriteria:
      'Exit if price closes below 2430 (stop loss) or if price fails to hold above EMA-20 on daily timeframe.',
    technicalFactors: {
      rsi: 58.5,
      adx: 32.4,
      atr: 45.2,
      relativeVolume: 1.35,
    },
  };

  const mockSellRecommendation: SwingRecommendation = {
    stock: 'HDFC',
    signal: 'SELL',
    setup: 'Breakdown below support',
    entry: 1500.0,
    stopLoss: 1530.0,
    target: 1440.0,
    riskReward: 2.0,
    probability: 0.65,
    trend: 'Downtrend',
    volume: 'Weak Volume',
    trendline: 'Resistance at descending trendline',
    support: [1450, 1400],
    resistance: [1550, 1600],
    marketRegime: 'Bear Market',
    rationale: 'Price broke below key support with weak volume indicating sellers in control.',
    invalidationCriteria: 'Exit if price closes above 1530.',
  };

  const mockNoTradeRecommendation: SwingRecommendation = {
    stock: 'TCS',
    signal: 'NO_TRADE',
    setup: 'Sideways consolidation',
    entry: 3500.0,
    stopLoss: 3450.0,
    target: 3550.0,
    riskReward: 1.0,
    probability: 0.3,
    trend: 'Neutral',
    volume: 'Average Volume',
    trendline: 'No clear trendline',
    support: [],
    resistance: [],
    marketRegime: 'Sideways',
    rationale: 'No clear directional bias. Market is in consolidation phase.',
    invalidationCriteria: 'N/A - No trade recommended',
  };

  it('renders BUY recommendation with all required fields', () => {
    render(<SwingRecommendationCard recommendation={mockBuyRecommendation} />);

    // Check stock symbol and signal
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();

    // Check setup
    expect(screen.getByText('EMA Breakout with Volume Confirmation')).toBeInTheDocument();

    // Check confidence
    expect(screen.getByText('75%')).toBeInTheDocument();

    // Check trade levels
    expect(screen.getByText('₹2460.00')).toBeInTheDocument();
    expect(screen.getByText('₹2520.00')).toBeInTheDocument();
    expect(screen.getByText('₹2430.00')).toBeInTheDocument();

    // Check risk-reward ratio
    expect(screen.getByText('1:2.00')).toBeInTheDocument();

    // Check rationale
    expect(screen.getByText(/Strong uptrend with EMA alignment/)).toBeInTheDocument();

    // Check invalidation criteria
    expect(screen.getByText(/Exit if price closes below 2430/)).toBeInTheDocument();

    // Check paper trade button
    expect(screen.getByRole('button', { name: /BUY ON PAPER/i })).toBeInTheDocument();
  });

  it('renders SELL recommendation correctly', () => {
    render(<SwingRecommendationCard recommendation={mockSellRecommendation} />);

    expect(screen.getByText('HDFC')).toBeInTheDocument();
    expect(screen.getByText('SELL')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('renders NO_TRADE recommendation with warning', () => {
    render(<SwingRecommendationCard recommendation={mockNoTradeRecommendation} />);

    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.getByText('NO_TRADE')).toBeInTheDocument();

    // Check for warning message
    expect(screen.getByText('No Trade Recommended')).toBeInTheDocument();
    expect(
      screen.getByText(/Current market conditions do not meet minimum setup requirements/)
    ).toBeInTheDocument();

    // Paper trade button should NOT be visible for NO_TRADE
    expect(screen.queryByRole('button', { name: /BUY ON PAPER/i })).not.toBeInTheDocument();
  });

  it('displays technical indicators when provided', () => {
    render(<SwingRecommendationCard recommendation={mockBuyRecommendation} />);

    expect(screen.getByText('58.5')).toBeInTheDocument(); // RSI
    expect(screen.getByText('32.4')).toBeInTheDocument(); // ADX
    expect(screen.getByText('₹45.20')).toBeInTheDocument(); // ATR
    expect(screen.getByText('1.35x')).toBeInTheDocument(); // Relative Volume
  });

  it('displays support and resistance levels', () => {
    render(<SwingRecommendationCard recommendation={mockBuyRecommendation} />);

    // Support levels
    expect(screen.getByText('₹2400.00')).toBeInTheDocument();
    expect(screen.getByText('₹2380.00')).toBeInTheDocument();
    expect(screen.getByText('₹2350.00')).toBeInTheDocument();

    // Resistance levels
    expect(screen.getByText('₹2500.00')).toBeInTheDocument();
    expect(screen.getByText('₹2550.00')).toBeInTheDocument();
    expect(screen.getByText('₹2600.00')).toBeInTheDocument();
  });

  it('displays bullish factors correctly', () => {
    render(<SwingRecommendationCard recommendation={mockBuyRecommendation} />);

    expect(screen.getByText(/Trend: Strong Uptrend/)).toBeInTheDocument();
    expect(screen.getByText(/Volume: High Volume Confirmation/)).toBeInTheDocument();
    expect(screen.getByText(/Trendline: Support at ascending trendline/)).toBeInTheDocument();
    expect(screen.getByText(/Market: Bull Market/)).toBeInTheDocument();
  });

  it('displays bearish factors correctly', () => {
    render(<SwingRecommendationCard recommendation={mockSellRecommendation} />);

    expect(screen.getByText(/Trend: Downtrend/)).toBeInTheDocument();
    expect(screen.getByText(/Volume: Weak Volume/)).toBeInTheDocument();
  });

  it('calculates profit and loss percentages correctly for BUY', () => {
    render(<SwingRecommendationCard recommendation={mockBuyRecommendation} />);

    // Profit: (2520 - 2460) / 2460 * 100 = 2.44%
    expect(screen.getByText('+2.44%')).toBeInTheDocument();

    // Loss: (2460 - 2430) / 2460 * 100 = 1.22%
    expect(screen.getByText('-1.22%')).toBeInTheDocument();
  });

  it('calculates profit and loss percentages correctly for SELL', () => {
    render(<SwingRecommendationCard recommendation={mockSellRecommendation} />);

    // Profit: (1500 - 1440) / 1500 * 100 = 4.00%
    expect(screen.getByText('+4.00%')).toBeInTheDocument();

    // Loss: (1530 - 1500) / 1500 * 100 = 2.00%
    expect(screen.getByText('-2.00%')).toBeInTheDocument();
  });

  it('calls onExecutePaperTrade when button is clicked', () => {
    const mockOnExecute = vi.fn();
    render(
      <SwingRecommendationCard
        recommendation={mockBuyRecommendation}
        onExecutePaperTrade={mockOnExecute}
      />
    );

    const button = screen.getByRole('button', { name: /BUY ON PAPER/i });
    fireEvent.click(button);

    expect(mockOnExecute).toHaveBeenCalledTimes(1);
  });

  it('disables paper trade button when loading', () => {
    render(
      <SwingRecommendationCard
        recommendation={mockBuyRecommendation}
        isPaperTradeLoading={true}
      />
    );

    const button = screen.getByRole('button', { name: /Executing.../i });
    expect(button).toBeDisabled();
  });

  it('does not show paper trade button for HOLD signal', () => {
    const holdRecommendation: SwingRecommendation = {
      ...mockBuyRecommendation,
      signal: 'HOLD',
    };

    render(<SwingRecommendationCard recommendation={holdRecommendation} />);

    expect(screen.queryByRole('button', { name: /BUY ON PAPER/i })).not.toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <SwingRecommendationCard recommendation={mockBuyRecommendation} className="custom-class" />
    );

    const card = container.firstChild;
    expect(card).toHaveClass('custom-class');
  });

  it('displays confidence with appropriate color coding', () => {
    // High confidence (>= 75%) - green
    const { rerender } = render(
      <SwingRecommendationCard
        recommendation={{ ...mockBuyRecommendation, probability: 0.8 }}
      />
    );
    expect(screen.getByText('80%')).toHaveClass('text-green-600');

    // Medium confidence (>= 50%, < 75%) - yellow
    rerender(
      <SwingRecommendationCard
        recommendation={{ ...mockBuyRecommendation, probability: 0.6 }}
      />
    );
    expect(screen.getByText('60%')).toHaveClass('text-yellow-600');

    // Low confidence (< 50%) - orange
    rerender(
      <SwingRecommendationCard
        recommendation={{ ...mockBuyRecommendation, probability: 0.4 }}
      />
    );
    expect(screen.getByText('40%')).toHaveClass('text-orange-600');
  });

  it('displays disclaimer about paper trading', () => {
    render(<SwingRecommendationCard recommendation={mockBuyRecommendation} />);

    expect(
      screen.getByText(
        /Paper trading only. No automatic live execution. Review all details before proceeding to live trading./
      )
    ).toBeInTheDocument();
  });

  it('handles missing technical factors gracefully', () => {
    const recommendationWithoutTechnicals: SwingRecommendation = {
      ...mockBuyRecommendation,
      technicalFactors: undefined,
    };

    render(<SwingRecommendationCard recommendation={recommendationWithoutTechnicals} />);

    // Should not show Technical Indicators section
    expect(screen.queryByText('Technical Indicators')).not.toBeInTheDocument();
  });

  it('handles empty support and resistance arrays', () => {
    const recommendationWithoutLevels: SwingRecommendation = {
      ...mockBuyRecommendation,
      support: [],
      resistance: [],
    };

    render(<SwingRecommendationCard recommendation={recommendationWithoutLevels} />);

    // Should not show Support & Resistance section when both are empty
    expect(screen.queryByText('Support & Resistance')).not.toBeInTheDocument();
  });

  it('limits support and resistance levels to 3 each', () => {
    const recommendationWithManyLevels: SwingRecommendation = {
      ...mockBuyRecommendation,
      support: [2400, 2380, 2350, 2320, 2300], // 5 levels
      resistance: [2500, 2550, 2600, 2650, 2700], // 5 levels
    };

    render(<SwingRecommendationCard recommendation={recommendationWithManyLevels} />);

    // Should show only first 3 support levels
    expect(screen.getByText('₹2400.00')).toBeInTheDocument();
    expect(screen.getByText('₹2380.00')).toBeInTheDocument();
    expect(screen.getByText('₹2350.00')).toBeInTheDocument();
    expect(screen.queryByText('₹2320.00')).not.toBeInTheDocument();

    // Should show only first 3 resistance levels
    expect(screen.getByText('₹2500.00')).toBeInTheDocument();
    expect(screen.getByText('₹2550.00')).toBeInTheDocument();
    expect(screen.getByText('₹2600.00')).toBeInTheDocument();
    expect(screen.queryByText('₹2650.00')).not.toBeInTheDocument();
  });
});
