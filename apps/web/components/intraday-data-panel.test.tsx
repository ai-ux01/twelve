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
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntradayDataPanel } from './intraday-data-panel';

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
});
