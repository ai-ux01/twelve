/**
 * Unit tests for IntradayDataPanel component
 * 
 * Tests:
 * - Component renders all sections correctly
 * - Displays technical indicators
 * - Shows stale data warning when isStale=true
 * - Displays support and resistance levels
 * - Shows RSI badges correctly
 * - Shows volume badges correctly
 * - Trendline section renders with correct data
 * - Badge colors for breakout statuses
 * - "No trendline data" fallback when trendline prop is undefined
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntradayDataPanel } from './intraday-data-panel';
import { TrendlineData } from '@/lib/api-client';

describe('IntradayDataPanel', () => {
  const mockData = {
    symbol: 'RELIANCE',
    interval: '5m',
    timestamp: '2024-01-01T10:00:00Z',
    dataFreshness: {
      timestamp: '2024-01-01T10:00:00Z',
      ageSeconds: 30,
      isStale: false,
    },
    technicalAnalysis: {
      rsi: 55,
      macd: {
        value: 10,
        signal: 8,
        histogram: 2,
      },
      ema_9: 2450,
      ema_21: 2440,
      ema_50: 2430,
      vwap: 2445,
      atr: 15,
      volume: 1000000,
      relativeVolume: 1.2,
      bollingerBands: {
        upper: 2500,
        middle: 2450,
        lower: 2400,
      },
      supportLevels: [2400, 2380, 2360],
      resistanceLevels: [2500, 2520, 2540],
    },
    currentPrice: 2450,
    priceChange: 10,
    priceChangePercent: 0.41,
  };

  it('should render with symbol and interval', () => {
    render(<IntradayDataPanel data={mockData} />);

    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText(/5m interval/i)).toBeInTheDocument();
  });

  it('should display all technical sections', () => {
    render(<IntradayDataPanel data={mockData} />);

    expect(screen.getByText('Price Action')).toBeInTheDocument();
    expect(screen.getByText('Momentum')).toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
    expect(screen.getByText('Bollinger Bands')).toBeInTheDocument();
    expect(screen.getByText('Support & Resistance Levels')).toBeInTheDocument();
  });

  it('should display RSI with overbought badge when > 70', () => {
    const overboughtData = {
      ...mockData,
      technicalAnalysis: {
        ...mockData.technicalAnalysis,
        rsi: 75,
      },
    };

    render(<IntradayDataPanel data={overboughtData} />);

    expect(screen.getByText('75.00')).toBeInTheDocument();
    expect(screen.getByText('Overbought')).toBeInTheDocument();
  });

  it('should display RSI with oversold badge when < 30', () => {
    const oversoldData = {
      ...mockData,
      technicalAnalysis: {
        ...mockData.technicalAnalysis,
        rsi: 25,
      },
    };

    render(<IntradayDataPanel data={oversoldData} />);

    expect(screen.getByText('25.00')).toBeInTheDocument();
    expect(screen.getByText('Oversold')).toBeInTheDocument();
  });

  it('should display relative volume with badge', () => {
    const highVolumeData = {
      ...mockData,
      technicalAnalysis: {
        ...mockData.technicalAnalysis,
        relativeVolume: 2.5,
      },
    };

    render(<IntradayDataPanel data={highVolumeData} />);

    expect(screen.getByText('2.50x')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('should display MACD histogram in green when positive', () => {
    render(<IntradayDataPanel data={mockData} />);

    const histogramValue = screen.getByText('2.00');
    expect(histogramValue).toHaveClass('text-green-600');
  });

  it('should display MACD histogram in red when negative', () => {
    const negativeData = {
      ...mockData,
      technicalAnalysis: {
        ...mockData.technicalAnalysis,
        macd: {
          value: 10,
          signal: 12,
          histogram: -2,
        },
      },
    };

    render(<IntradayDataPanel data={negativeData} />);

    const histogramValue = screen.getByText('-2.00');
    expect(histogramValue).toHaveClass('text-red-600');
  });

  it('should display "No levels detected" when support levels are empty', () => {
    const noSupportData = {
      ...mockData,
      technicalAnalysis: {
        ...mockData.technicalAnalysis,
        supportLevels: [],
      },
    };

    render(<IntradayDataPanel data={noSupportData} />);

    const noLevelsTexts = screen.getAllByText('No levels detected');
    expect(noLevelsTexts.length).toBeGreaterThan(0);
  });

  it('should show stale data warning when isStale=true', () => {
    const staleData = {
      ...mockData,
      dataFreshness: {
        ...mockData.dataFreshness,
        isStale: true,
        ageSeconds: 600, // 10 minutes
      },
    };

    render(<IntradayDataPanel data={staleData} />);

    expect(screen.getByText('Stale Data')).toBeInTheDocument();
    expect(screen.getByText(/Data is stale/)).toBeInTheDocument();
    expect(screen.getByText(/10 min/)).toBeInTheDocument();
  });

  it('should add warning border class when data is stale', () => {
    const staleData = {
      ...mockData,
      dataFreshness: {
        ...mockData.dataFreshness,
        isStale: true,
      },
    };

    const { container } = render(<IntradayDataPanel data={staleData} />);

    const card = container.querySelector('.border-yellow-500');
    expect(card).toBeInTheDocument();
  });

  it('should not show stale data warning when isStale=false', () => {
    render(<IntradayDataPanel data={mockData} />);

    expect(screen.queryByText('Stale Data')).not.toBeInTheDocument();
  });

  it('should display volume formatted with commas', () => {
    render(<IntradayDataPanel data={mockData} />);

    expect(screen.getByText('1,000,000')).toBeInTheDocument();
  });

  describe('Trendlines section', () => {
    const mockTrendline: TrendlineData = {
      support_line: { slope: 0.5, intercept: 100, r_squared: 0.95, start_point: 0, end_point: 10 },
      resistance_line: { slope: 0.3, intercept: 120, r_squared: 0.88, start_point: 0, end_point: 10 },
      swing_points: [{ index: 0, price: 100, type: 'LOW' }],
      breakout_status: 'NONE',
      direction: 'UPTREND',
      support_status: 'ACTIVE',
      resistance_status: 'ACTIVE',
      confidence: 0.856,
    };

    it('should render "Trendlines" section with correct data when trendline prop is provided', () => {
      render(<IntradayDataPanel data={mockData} trendline={mockTrendline} />);

      expect(screen.getByText('Trendlines')).toBeInTheDocument();
      expect(screen.getByText('UPTREND')).toBeInTheDocument();
      // Both support and resistance status are ACTIVE, so use getAllByText
      const activeElements = screen.getAllByText('ACTIVE');
      expect(activeElements.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('NONE')).toBeInTheDocument();
      expect(screen.getByText('85.6%')).toBeInTheDocument();
    });

    it('should display direction field correctly', () => {
      render(<IntradayDataPanel data={mockData} trendline={{ ...mockTrendline, direction: 'DOWNTREND' }} />);

      expect(screen.getByText('DOWNTREND')).toBeInTheDocument();
    });

    it('should display support and resistance statuses', () => {
      render(
        <IntradayDataPanel
          data={mockData}
          trendline={{ ...mockTrendline, support_status: 'BROKEN', resistance_status: 'RETESTING' }}
        />
      );

      expect(screen.getByText('BROKEN')).toBeInTheDocument();
      expect(screen.getByText('RETESTING')).toBeInTheDocument();
    });

    it('should show green badge for BREAKOUT status', () => {
      render(
        <IntradayDataPanel data={mockData} trendline={{ ...mockTrendline, breakout_status: 'BREAKOUT' }} />
      );

      const badges = screen.getAllByText('BREAKOUT');
      const badge = badges.find((el) => el.closest('.bg-green-600'));
      expect(badge).toBeInTheDocument();
    });

    it('should show green badge for CONFIRMED status', () => {
      render(
        <IntradayDataPanel data={mockData} trendline={{ ...mockTrendline, breakout_status: 'CONFIRMED' }} />
      );

      const badges = screen.getAllByText('CONFIRMED');
      const badge = badges.find((el) => el.closest('.bg-green-600'));
      expect(badge).toBeInTheDocument();
    });

    it('should show red badge for BREAKDOWN status', () => {
      render(
        <IntradayDataPanel data={mockData} trendline={{ ...mockTrendline, breakout_status: 'BREAKDOWN' }} />
      );

      const badges = screen.getAllByText('BREAKDOWN');
      const badge = badges.find((el) => el.closest('.bg-red-600'));
      expect(badge).toBeInTheDocument();
    });

    it('should display "No trendline data" when trendline prop is undefined', () => {
      render(<IntradayDataPanel data={mockData} />);

      expect(screen.getByText('No trendline data')).toBeInTheDocument();
    });

    it('should display confidence as percentage with one decimal place', () => {
      render(
        <IntradayDataPanel data={mockData} trendline={{ ...mockTrendline, confidence: 0.923 }} />
      );

      expect(screen.getByText('92.3%')).toBeInTheDocument();
    });
  });
});
