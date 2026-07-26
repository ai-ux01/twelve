/**
 * Unit tests for SwingMiniChart trendline overlays
 *
 * Tests:
 * - Component renders without error when trendlines prop is not provided
 * - Component renders without error when trendlines prop has support and resistance data
 * - The chart container is present
 *
 * Task: 9.2
 * Validates: Requirements 5.1, 5.5, 5.6
 */

import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { OHLCVData, TrendlineLine } from '@/lib/api-client';

// Track addLineSeries calls to verify trendline series configuration
const mockSetData = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddLineSeries = vi.fn(() => ({
  setData: mockSetData,
  createPriceLine: vi.fn(),
}));
const mockAddCandlestickSeries = vi.fn(() => ({
  setData: vi.fn(),
}));
const mockTimeScale = vi.fn(() => ({
  fitContent: vi.fn(),
}));

// Mock the useChart hook to return a mock chart API with isReady = true
vi.mock('@/lib/hooks/useChart', () => ({
  useChart: vi.fn(() => ({
    chartContainerRef: { current: document.createElement('div') },
    chart: {
      addLineSeries: mockAddLineSeries,
      addCandlestickSeries: mockAddCandlestickSeries,
      removeSeries: mockRemoveSeries,
      timeScale: mockTimeScale,
      applyOptions: vi.fn(),
      remove: vi.fn(),
    },
    isReady: true,
  })),
}));

// Mock lightweight-charts types (not directly used but needed for imports)
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(),
  ColorType: { Solid: 'Solid' },
  LineStyle: { Dashed: 2, Solid: 0 },
}));

// Import component after mocks are set up
import SwingMiniChart from './SwingMiniChart';

// ============================================================================
// Mock Data
// ============================================================================

const mockOHLCVData: OHLCVData[] = [
  { timestamp: '2024-01-01T09:15:00Z', open: 100, high: 105, low: 98, close: 103, volume: 1000 },
  { timestamp: '2024-01-01T09:30:00Z', open: 103, high: 108, low: 101, close: 106, volume: 1200 },
  { timestamp: '2024-01-01T09:45:00Z', open: 106, high: 110, low: 104, close: 109, volume: 900 },
  { timestamp: '2024-01-01T10:00:00Z', open: 109, high: 112, low: 107, close: 111, volume: 1100 },
  { timestamp: '2024-01-01T10:15:00Z', open: 111, high: 115, low: 109, close: 113, volume: 800 },
];

const mockSupportLine: TrendlineLine = {
  slope: 2.5,
  intercept: 95,
  r_squared: 0.92,
  start_point: 0,
  end_point: 4,
};

const mockResistanceLine: TrendlineLine = {
  slope: 2.0,
  intercept: 110,
  r_squared: 0.88,
  start_point: 0,
  end_point: 4,
};

// ============================================================================
// Tests
// ============================================================================

describe('SwingMiniChart trendline overlays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without error when trendlines prop is not provided', () => {
    const { container } = render(
      <SwingMiniChart symbol="NIFTY" data={mockOHLCVData} />
    );

    // Chart container should be present
    expect(container.querySelector('[aria-label="Mini chart for NIFTY"]')).toBeInTheDocument();
  });

  it('renders without error when trendlines prop has support and resistance data', () => {
    const { container } = render(
      <SwingMiniChart
        symbol="NIFTY"
        data={mockOHLCVData}
        trendlines={{ support: mockSupportLine, resistance: mockResistanceLine }}
      />
    );

    // Chart container should be present
    expect(container.querySelector('[aria-label="Mini chart for NIFTY"]')).toBeInTheDocument();
  });

  it('has chart container element in the DOM', () => {
    const { container } = render(
      <SwingMiniChart symbol="RELIANCE" data={mockOHLCVData} />
    );

    // The chart wrapper div should be present with correct height
    const chartWrapper = container.querySelector('[style*="height: 120"]');
    expect(chartWrapper).toBeInTheDocument();
  });

  it('adds line series with correct colors and dashed style for trendlines', () => {
    render(
      <SwingMiniChart
        symbol="NIFTY"
        data={mockOHLCVData}
        trendlines={{ support: mockSupportLine, resistance: mockResistanceLine }}
      />
    );

    // addLineSeries should be called for support and resistance trendlines
    // (plus price levels if any, but here we only pass trendlines)
    const lineSeriesCalls = mockAddLineSeries.mock.calls;

    // Find the calls that match trendline configuration (color + lineStyle: 2)
    const supportCall = lineSeriesCalls.find(
      (call) => call[0]?.color === '#26a69a' && call[0]?.lineStyle === 2 && call[0]?.lineWidth === 2
    );
    const resistanceCall = lineSeriesCalls.find(
      (call) => call[0]?.color === '#ef5350' && call[0]?.lineStyle === 2 && call[0]?.lineWidth === 2
    );

    expect(supportCall).toBeDefined();
    expect(resistanceCall).toBeDefined();
  });

  it('removes previous trendline series on update', () => {
    const { rerender } = render(
      <SwingMiniChart
        symbol="NIFTY"
        data={mockOHLCVData}
        trendlines={{ support: mockSupportLine }}
      />
    );

    // Clear mocks to track the second render
    const removeCalls = mockRemoveSeries.mock.calls.length;

    // Rerender with new trendline data
    rerender(
      <SwingMiniChart
        symbol="NIFTY"
        data={mockOHLCVData}
        trendlines={{ resistance: mockResistanceLine }}
      />
    );

    // removeSeries should have been called to clean up previous trendline series
    expect(mockRemoveSeries.mock.calls.length).toBeGreaterThan(removeCalls);
  });

  it('does not add trendline line series when trendline data is not available', () => {
    render(
      <SwingMiniChart symbol="NIFTY" data={mockOHLCVData} />
    );

    // Filter for trendline-style addLineSeries calls (lineStyle: 2, lineWidth: 2)
    const trendlineStyleCalls = mockAddLineSeries.mock.calls.filter(
      (call) => call[0]?.lineStyle === 2 && call[0]?.lineWidth === 2
    );

    expect(trendlineStyleCalls).toHaveLength(0);
  });
});
