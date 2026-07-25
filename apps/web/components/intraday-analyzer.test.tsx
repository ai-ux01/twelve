/**
 * Unit tests for IntradayAnalyzer component
 * 
 * Tests:
 * - Component renders with all required fields
 * - Symbol input works correctly
 * - Interval selection works correctly
 * - REFRESH & ANALYZE button triggers analysis
 * - Loading state displays correctly
 * - Last refresh timestamp displays correctly
 * - Error handling works correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntradayAnalyzer } from './intraday-analyzer';

describe('IntradayAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should render with all required fields', () => {
    render(<IntradayAnalyzer />);

    expect(screen.getByText('Intraday Analysis')).toBeInTheDocument();
    expect(screen.getByLabelText('Stock Symbol')).toBeInTheDocument();
    expect(screen.getByLabelText('Interval')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /REFRESH & ANALYZE/i })).toBeInTheDocument();
  });

  it('should update symbol input correctly', () => {
    render(<IntradayAnalyzer />);

    const symbolInput = screen.getByLabelText('Stock Symbol') as HTMLInputElement;
    fireEvent.change(symbolInput, { target: { value: 'reliance' } });

    expect(symbolInput.value).toBe('RELIANCE'); // Should be uppercase
  });

  it('should update interval selection correctly', () => {
    render(<IntradayAnalyzer />);

    const intervalSelect = screen.getByLabelText('Interval') as HTMLSelectElement;
    
    // Check default value
    expect(intervalSelect.value).toBe('5m');

    // Change to 15m
    fireEvent.change(intervalSelect, { target: { value: '15m' } });
    expect(intervalSelect.value).toBe('15m');
  });

  it('should call onAnalyzeError when symbol is empty', async () => {
    const onAnalyzeError = vi.fn();
    render(<IntradayAnalyzer onAnalyzeError={onAnalyzeError} />);

    const button = screen.getByRole('button', { name: /REFRESH & ANALYZE/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(onAnalyzeError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Please enter a stock symbol',
        })
      );
    });
  });

  it('should trigger analysis with correct payload', async () => {
    const mockResponse = {
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
        macd: { value: 10, signal: 8, histogram: 2 },
        ema_9: 2450,
        ema_21: 2440,
        ema_50: 2430,
        vwap: 2445,
        atr: 15,
        volume: 1000000,
        relativeVolume: 1.2,
        bollingerBands: { upper: 2500, middle: 2450, lower: 2400 },
        supportLevels: [2400],
        resistanceLevels: [2500],
      },
      currentPrice: 2450,
      priceChange: 10,
      priceChangePercent: 0.41,
      recommendation: {
        symbol: 'RELIANCE',
        signal: 'BUY',
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
        macd: { value: 10, signal: 8, histogram: 2 },
        openingRange: { high: 2455, low: 2440, open: 2445 },
        previousDayHigh: 2460,
        previousDayLow: 2420,
        isStale: false,
        dataTimestamp: '2024-01-01T10:00:00Z',
        rationale: 'Strong uptrend with good momentum',
      },
    };

    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const onAnalyzeComplete = vi.fn();
    render(<IntradayAnalyzer onAnalyzeComplete={onAnalyzeComplete} />);

    const symbolInput = screen.getByLabelText('Stock Symbol');
    fireEvent.change(symbolInput, { target: { value: 'RELIANCE' } });

    const button = screen.getByRole('button', { name: /REFRESH & ANALYZE/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/intraday/analyze',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol: 'RELIANCE',
            interval: '5m',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(onAnalyzeComplete).toHaveBeenCalledWith(mockResponse);
    });
  });

  it('should display loading state during analysis', async () => {
    (global.fetch as vi.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({}),
            });
          }, 100);
        })
    );

    render(<IntradayAnalyzer />);

    const symbolInput = screen.getByLabelText('Stock Symbol');
    fireEvent.change(symbolInput, { target: { value: 'TCS' } });

    const button = screen.getByRole('button', { name: /REFRESH & ANALYZE/i });
    fireEvent.click(button);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });

  it('should display last refresh timestamp after successful analysis', async () => {
    const mockResponse = {
      symbol: 'TCS',
      interval: '5m',
      timestamp: '2024-01-01T10:00:00Z',
      dataFreshness: {
        timestamp: '2024-01-01T10:00:00Z',
        ageSeconds: 10,
        isStale: false,
      },
      technicalAnalysis: {
        rsi: 60,
        macd: { value: 5, signal: 4, histogram: 1 },
        ema_9: 3500,
        ema_21: 3490,
        ema_50: 3480,
        vwap: 3495,
        atr: 20,
        volume: 500000,
        relativeVolume: 1.0,
        bollingerBands: { upper: 3550, middle: 3500, lower: 3450 },
        supportLevels: [3450],
        resistanceLevels: [3550],
      },
      currentPrice: 3500,
      priceChange: 5,
      priceChangePercent: 0.14,
      recommendation: {
        symbol: 'TCS',
        signal: 'HOLD',
        confidence: 50,
        timestamp: '2024-01-01T10:00:00Z',
        entry: 3500,
        stopLoss: 3480,
        target: 3530,
        riskReward: 1.5,
        currentPrice: 3500,
        vwap: 3495,
        ema5: 3498,
        ema15: 3492,
        rsi: 60,
        macd: { value: 5, signal: 4, histogram: 1 },
        openingRange: { high: 3505, low: 3490, open: 3495 },
        previousDayHigh: 3510,
        previousDayLow: 3470,
        isStale: false,
        dataTimestamp: '2024-01-01T10:00:00Z',
        rationale: 'Neutral trend',
      },
    };

    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(<IntradayAnalyzer />);

    const symbolInput = screen.getByLabelText('Stock Symbol');
    fireEvent.change(symbolInput, { target: { value: 'TCS' } });

    const button = screen.getByRole('button', { name: /REFRESH & ANALYZE/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Last refreshed:/i)).toBeInTheDocument();
    });
  });

  it('should handle API errors correctly', async () => {
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const onAnalyzeError = vi.fn();
    render(<IntradayAnalyzer onAnalyzeError={onAnalyzeError} />);

    const symbolInput = screen.getByLabelText('Stock Symbol');
    fireEvent.change(symbolInput, { target: { value: 'INVALID' } });

    const button = screen.getByRole('button', { name: /REFRESH & ANALYZE/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(onAnalyzeError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Analysis failed: 500'),
        })
      );
    });
  });

  it('should trigger analysis on Enter key press', async () => {
    const mockResponse = {
      symbol: 'INFY',
      interval: '5m',
      timestamp: '2024-01-01T10:00:00Z',
      dataFreshness: {
        timestamp: '2024-01-01T10:00:00Z',
        ageSeconds: 15,
        isStale: false,
      },
      technicalAnalysis: {
        rsi: 65,
        macd: { value: 8, signal: 7, histogram: 1 },
        ema_9: 1500,
        ema_21: 1495,
        ema_50: 1490,
        vwap: 1498,
        atr: 10,
        volume: 800000,
        relativeVolume: 1.3,
        bollingerBands: { upper: 1520, middle: 1500, lower: 1480 },
        supportLevels: [1480],
        resistanceLevels: [1520],
      },
      currentPrice: 1500,
      priceChange: 8,
      priceChangePercent: 0.54,
      recommendation: {
        symbol: 'INFY',
        signal: 'BUY',
        confidence: 70,
        timestamp: '2024-01-01T10:00:00Z',
        entry: 1500,
        stopLoss: 1485,
        target: 1525,
        riskReward: 1.67,
        currentPrice: 1500,
        vwap: 1498,
        ema5: 1499,
        ema15: 1496,
        rsi: 65,
        macd: { value: 8, signal: 7, histogram: 1 },
        openingRange: { high: 1505, low: 1495, open: 1498 },
        previousDayHigh: 1510,
        previousDayLow: 1480,
        isStale: false,
        dataTimestamp: '2024-01-01T10:00:00Z',
        rationale: 'Good buying opportunity',
      },
    };

    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const onAnalyzeComplete = vi.fn();
    render(<IntradayAnalyzer onAnalyzeComplete={onAnalyzeComplete} />);

    const symbolInput = screen.getByLabelText('Stock Symbol');
    fireEvent.change(symbolInput, { target: { value: 'INFY' } });
    fireEvent.keyPress(symbolInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      expect(onAnalyzeComplete).toHaveBeenCalledWith(mockResponse);
    });
  });
});
