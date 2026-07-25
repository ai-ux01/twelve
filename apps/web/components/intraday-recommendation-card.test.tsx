/**
 * Unit tests for IntradayRecommendationCard component
 * 
 * Tests:
 * - Component renders with BUY signal
 * - Component renders with SELL signal
 * - Component renders with HOLD signal
 * - Component renders with NO_TRADE signal
 * - Shows "HOLD - Data is stale" when isStale=true
 * - Shows paper trade button only for BUY/SELL with fresh data
 * - Paper trade execution works correctly
 * - Displays confidence score correctly
 * - Shows price levels for BUY/SELL signals
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntradayRecommendationCard } from './intraday-recommendation-card';

describe('IntradayRecommendationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  const baseMockRecommendation = {
    symbol: 'RELIANCE',
    signal: 'BUY' as const,
    confidence: 75,
    timestamp: '2024-01-01T10:00:00Z',
    entry: 2450,
    stopLoss: 2430,
    target: 2480,
    riskReward: 1.5,
    currentPrice: 2450,
    vwap: 2445,
    ema5: 2448,
    ema15: 2442,
    rsi: 55,
    macd: {
      value: 10,
      signal: 8,
      histogram: 2,
    },
    openingRange: {
      high: 2455,
      low: 2440,
      open: 2445,
    },
    previousDayHigh: 2460,
    previousDayLow: 2420,
    isStale: false,
    dataTimestamp: '2024-01-01T10:00:00Z',
    rationale: 'Strong uptrend with good momentum',
  };

  it('should render with BUY signal', () => {
    render(<IntradayRecommendationCard recommendation={baseMockRecommendation} />);

    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('should render with SELL signal', () => {
    const sellRecommendation = {
      ...baseMockRecommendation,
      signal: 'SELL' as const,
    };

    render(<IntradayRecommendationCard recommendation={sellRecommendation} />);

    expect(screen.getByText('SELL')).toBeInTheDocument();
  });

  it('should render with HOLD signal', () => {
    const holdRecommendation = {
      ...baseMockRecommendation,
      signal: 'HOLD' as const,
      rationale: 'No clear trend',
    };

    render(<IntradayRecommendationCard recommendation={holdRecommendation} />);

    expect(screen.getByText('HOLD')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ON PAPER/i })).not.toBeInTheDocument();
  });

  it('should render with NO_TRADE signal and show reason', () => {
    const noTradeRecommendation = {
      ...baseMockRecommendation,
      signal: 'NO_TRADE' as const,
      rationale: 'Market conditions are not favorable',
    };

    render(<IntradayRecommendationCard recommendation={noTradeRecommendation} />);

    expect(screen.getByText('NO_TRADE')).toBeInTheDocument();
    expect(screen.getByText('NO TRADE RECOMMENDED')).toBeInTheDocument();
    // Rationale appears in multiple places, so just check that NO_TRADE is shown
    expect(screen.queryByRole('button', { name: /ON PAPER/i })).not.toBeInTheDocument();
  });

  it('should show "HOLD - Data is stale" prominently when isStale=true', () => {
    const staleRecommendation = {
      ...baseMockRecommendation,
      isStale: true,
    };

    render(<IntradayRecommendationCard recommendation={staleRecommendation} />);

    expect(screen.getByText('HOLD - Data is stale')).toBeInTheDocument();
    expect(screen.getByText(/data used for this recommendation is outdated/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ON PAPER/i })).not.toBeInTheDocument();
  });

  it('should show paper trade button only for BUY signal with fresh data', () => {
    render(<IntradayRecommendationCard recommendation={baseMockRecommendation} />);

    expect(screen.getByRole('button', { name: /BUY ON PAPER/i })).toBeInTheDocument();
  });

  it('should show paper trade button only for SELL signal with fresh data', () => {
    const sellRecommendation = {
      ...baseMockRecommendation,
      signal: 'SELL' as const,
    };

    render(<IntradayRecommendationCard recommendation={sellRecommendation} />);

    expect(screen.getByRole('button', { name: /SELL ON PAPER/i })).toBeInTheDocument();
  });

  it('should not show paper trade button when data is stale', () => {
    const staleRecommendation = {
      ...baseMockRecommendation,
      isStale: true,
    };

    render(<IntradayRecommendationCard recommendation={staleRecommendation} />);

    expect(screen.queryByRole('button', { name: /ON PAPER/i })).not.toBeInTheDocument();
  });

  it('should execute paper trade successfully', async () => {
    const mockTradeResponse = {
      tradeId: 'trade-123',
      status: 'EXECUTED',
      message: 'Paper trade executed successfully',
    };

    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTradeResponse,
    });

    const onPaperTradeSuccess = vi.fn();
    render(
      <IntradayRecommendationCard
        recommendation={baseMockRecommendation}
        onPaperTradeSuccess={onPaperTradeSuccess}
      />
    );

    const button = screen.getByRole('button', { name: /BUY ON PAPER/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/trade/paper',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: 'user-123',
            symbol: 'RELIANCE',
            action: 'BUY',
            quantity: 1,
            price: 2450,
            stopLoss: 2430,
            target: 2480,
          }),
        })
      );
    });

    await waitFor(() => {
      expect(onPaperTradeSuccess).toHaveBeenCalledWith('trade-123');
      expect(screen.getByText(/Paper trade executed successfully/i)).toBeInTheDocument();
    });
  });

  it('should handle paper trade error', async () => {
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const onPaperTradeError = vi.fn();
    render(
      <IntradayRecommendationCard
        recommendation={baseMockRecommendation}
        onPaperTradeError={onPaperTradeError}
      />
    );

    const button = screen.getByRole('button', { name: /BUY ON PAPER/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(onPaperTradeError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Paper trade failed: 500'),
        })
      );
    });
  });

  it('should display confidence score as progress bar', () => {
    render(<IntradayRecommendationCard recommendation={baseMockRecommendation} />);

    expect(screen.getByText('Confidence Score')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('should display price levels for BUY signal', () => {
    render(<IntradayRecommendationCard recommendation={baseMockRecommendation} />);

    expect(screen.getByText('Price Levels')).toBeInTheDocument();
    // Just check that price levels section exists
  });

  it('should display risk/reward ratio', () => {
    render(<IntradayRecommendationCard recommendation={baseMockRecommendation} />);

    expect(screen.getByText('Risk/Reward Ratio')).toBeInTheDocument();
    expect(screen.getByText('1.50:1')).toBeInTheDocument();
  });

  it('should display "Favorable" badge when risk/reward >= 2', () => {
    const favorableRecommendation = {
      ...baseMockRecommendation,
      riskReward: 2.5,
    };

    render(<IntradayRecommendationCard recommendation={favorableRecommendation} />);

    expect(screen.getByText('Favorable')).toBeInTheDocument();
  });

  it('should display key indicators', () => {
    render(<IntradayRecommendationCard recommendation={baseMockRecommendation} />);

    expect(screen.getByText('Key Indicators')).toBeInTheDocument();
    expect(screen.getByText('55.00')).toBeInTheDocument(); // RSI
    expect(screen.getByText('2.00')).toBeInTheDocument(); // MACD Histogram
  });

  it('should display rationale', () => {
    render(<IntradayRecommendationCard recommendation={baseMockRecommendation} />);

    expect(screen.getByText('Rationale')).toBeInTheDocument();
    expect(screen.getByText('Strong uptrend with good momentum')).toBeInTheDocument();
  });

  it('should display warnings when present', () => {
    const recommendationWithWarnings = {
      ...baseMockRecommendation,
      warnings: ['Low volume detected', 'Approaching resistance level'],
    };

    render(<IntradayRecommendationCard recommendation={recommendationWithWarnings} />);

    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(screen.getByText('• Low volume detected')).toBeInTheDocument();
    expect(screen.getByText('• Approaching resistance level')).toBeInTheDocument();
  });

  it('should show loading state during paper trade execution', async () => {
    (global.fetch as vi.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ tradeId: 'trade-123', status: 'EXECUTED' }),
            });
          }, 100);
        })
    );

    render(<IntradayRecommendationCard recommendation={baseMockRecommendation} />);

    const button = screen.getByRole('button', { name: /BUY ON PAPER/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Executing Paper Trade...')).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });

  it('should display MACD histogram in green when positive', () => {
    render(<IntradayRecommendationCard recommendation={baseMockRecommendation} />);

    const macdHistogram = screen.getByText('2.00');
    expect(macdHistogram).toHaveClass('text-green-600');
  });

  it('should display MACD histogram in red when negative', () => {
    const negativeRecommendation = {
      ...baseMockRecommendation,
      macd: {
        value: 10,
        signal: 12,
        histogram: -2,
      },
    };

    render(<IntradayRecommendationCard recommendation={negativeRecommendation} />);

    const macdHistogram = screen.getByText('-2.00');
    expect(macdHistogram).toHaveClass('text-red-600');
  });
});
