/**
 * Unit tests for IntradayChart trendline overlays
 *
 * Tests:
 * - Legend entries appear for "Support TL" and "Resistance TL" when trendline props provided
 * - Chart renders without overlays when trendline data is not provided
 * - Line series are added with correct colors and dashed style
 * - Trendline series are removed on update before new ones are added
 *
 * Requirements: 4.1, 4.5, 4.6, 4.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { OHLCVData, TrendlineLine } from '@/lib/api-client';

// Mock the useChart hook
const mockAddLineSeries = vi.fn(() => ({
  setData: vi.fn(),
  createPriceLine: vi.fn(),
}));
const mockRemoveSeries = vi.fn();
const mockAddCandlestickSeries = vi.fn(() => ({
  setData: vi.fn(),
}));
const mockTimeScale = vi.fn(() => ({
  fitContent: vi.fn(),
}));

vi.mock('@/lib/hooks/useChart', () => ({
  useChart: () => ({
    chartContainerRef: { current: document.createElement('div') },
    chart: {
      addLineSeries: mockAddLineSeries,
      addCandlestickSeries: mockAddCandlestickSeries,
      removeSeries: mockRemoveSeries,
      timeScale: mockTimeScale,
    },
    isReady: true,
  }),
}));

// Mock lightweight-charts types
vi.mock('lightweight-charts', () => ({
  ColorType: { Solid: 'Solid' },
  LineStyle: { Dashed: 2 },
}));

import IntradayChart from './IntradayChart';

// ============================================================================
// Test Data
// ============================================================================

const mockOHLCVData: OHLCVData[] = [
  { timestamp: '2024-01-01T09:15:00Z', open: 100, high: 105, low: 98, close: 103, volume: 1000 },
  { timestamp: '2024-01-01T09:20:00Z', open: 103, high: 108, low: 101, close: 106, volume: 1200 },
  { timestamp: '2024-01-01T09:25:00Z', open: 106, high: 110, low: 104, close: 109, volume: 1100 },
  { timestamp: '2024-01-01T09:30:00Z', open: 109, high: 112, low: 107, close: 111, volume: 900 },
  { timestamp: '2024-01-01T09:35:00Z', open: 111, high: 115, low: 109, close: 113, volume: 1300 },
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

describe('IntradayChart trendline overlays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Legend entries', () => {
    it('should display "Support TL" legend entry when support trendline is provided', () => {
      render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={{ support: mockSupportLine }}
        />
      );

      expect(screen.getByText('Support TL')).toBeInTheDocument();
    });

    it('should display "Resistance TL" legend entry when resistance trendline is provided', () => {
      render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={{ resistance: mockResistanceLine }}
        />
      );

      expect(screen.getByText('Resistance TL')).toBeInTheDocument();
    });

    it('should display both "Support TL" and "Resistance TL" legend entries when both trendlines are provided', () => {
      render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={{ support: mockSupportLine, resistance: mockResistanceLine }}
        />
      );

      expect(screen.getByText('Support TL')).toBeInTheDocument();
      expect(screen.getByText('Resistance TL')).toBeInTheDocument();
    });

    it('should show dashed style indicators for trendline legend entries', () => {
      const { container } = render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={{ support: mockSupportLine, resistance: mockResistanceLine }}
        />
      );

      // Trendline legend indicators use border-dashed class
      const dashedIndicators = container.querySelectorAll('.border-dashed');
      expect(dashedIndicators.length).toBe(2);
    });
  });

  describe('Rendering without trendline data', () => {
    it('should not display trendline legend entries when trendlines prop is not provided', () => {
      render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
        />
      );

      expect(screen.queryByText('Support TL')).not.toBeInTheDocument();
      expect(screen.queryByText('Resistance TL')).not.toBeInTheDocument();
    });

    it('should not display trendline legend entries when trendlines prop is undefined', () => {
      render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={undefined}
        />
      );

      expect(screen.queryByText('Support TL')).not.toBeInTheDocument();
      expect(screen.queryByText('Resistance TL')).not.toBeInTheDocument();
    });

    it('should not display trendline legend entries when trendlines has neither support nor resistance', () => {
      render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={{}}
        />
      );

      expect(screen.queryByText('Support TL')).not.toBeInTheDocument();
      expect(screen.queryByText('Resistance TL')).not.toBeInTheDocument();
    });
  });

  describe('Line series rendering with correct styles', () => {
    it('should add support line series with green color and dashed style', () => {
      render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={{ support: mockSupportLine }}
        />
      );

      expect(mockAddLineSeries).toHaveBeenCalledWith(
        expect.objectContaining({
          color: '#26a69a',
          lineWidth: 2,
          lineStyle: 2,
          title: 'Support TL',
        })
      );
    });

    it('should add resistance line series with red color and dashed style', () => {
      render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={{ resistance: mockResistanceLine }}
        />
      );

      expect(mockAddLineSeries).toHaveBeenCalledWith(
        expect.objectContaining({
          color: '#ef5350',
          lineWidth: 2,
          lineStyle: 2,
          title: 'Resistance TL',
        })
      );
    });

    it('should add both support and resistance line series when both are provided', () => {
      render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={{ support: mockSupportLine, resistance: mockResistanceLine }}
        />
      );

      // One call for each trendline series (plus potential price level calls)
      const trendlineCalls = mockAddLineSeries.mock.calls.filter(
        (call) => call[0]?.title === 'Support TL' || call[0]?.title === 'Resistance TL'
      );
      expect(trendlineCalls.length).toBe(2);
    });

    it('should not add trendline series when trendlines prop is not provided', () => {
      render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
        />
      );

      const trendlineCalls = mockAddLineSeries.mock.calls.filter(
        (call) => call[0]?.title === 'Support TL' || call[0]?.title === 'Resistance TL'
      );
      expect(trendlineCalls.length).toBe(0);
    });
  });

  describe('Trendline series removal on update', () => {
    it('should call removeSeries for previous trendline series when re-rendering', () => {
      const { rerender } = render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={{ support: mockSupportLine }}
        />
      );

      // Clear to track new calls
      mockRemoveSeries.mockClear();

      // Re-render with different trendline data
      const newSupportLine: TrendlineLine = {
        slope: 3.0,
        intercept: 90,
        r_squared: 0.95,
        start_point: 1,
        end_point: 4,
      };

      rerender(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={{ support: newSupportLine }}
        />
      );

      // removeSeries should be called to clean up old trendline series
      expect(mockRemoveSeries).toHaveBeenCalled();
    });

    it('should call removeSeries when trendlines are removed entirely', () => {
      const { rerender } = render(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
          trendlines={{ support: mockSupportLine, resistance: mockResistanceLine }}
        />
      );

      mockRemoveSeries.mockClear();

      // Re-render without trendlines
      rerender(
        <IntradayChart
          symbol="RELIANCE"
          data={mockOHLCVData}
        />
      );

      // removeSeries should be called to remove previous trendline series
      expect(mockRemoveSeries).toHaveBeenCalled();
    });
  });
});
