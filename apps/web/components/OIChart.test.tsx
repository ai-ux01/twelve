/**
 * Unit tests for OIChart component
 *
 * Tests:
 * - Component renders without errors
 * - Displays options chain data correctly
 * - Highlights ATM strike
 * - Shows Call OI and Put OI
 * - Displays support/resistance zones
 * - Shows tooltip on hover
 * - Displays summary statistics
 *
 * Task: 70.3
 */

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { OIChart } from './OIChart';
import type { OptionsChainResponse } from '@/lib/api-client';

// Mock lightweight-charts
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addHistogramSeries: vi.fn(() => ({
      setData: vi.fn(),
      createPriceLine: vi.fn(),
    })),
    addLineSeries: vi.fn(() => ({
      setData: vi.fn(),
      createPriceLine: vi.fn(),
    })),
    applyOptions: vi.fn(),
    timeScale: vi.fn(() => ({
      fitContent: vi.fn(),
    })),
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
    remove: vi.fn(),
  })),
  ColorType: {
    Solid: 'Solid',
  },
  CrosshairMode: {
    Normal: 'Normal',
  },
  LineStyle: {
    Solid: 'Solid',
    Dashed: 'Dashed',
  },
}));

// ============================================================================
// Mock Data
// ============================================================================

const mockOptionsChain: OptionsChainResponse = {
  underlying: 'NIFTY',
  expiryDate: '2024-12-26',
  spotPrice: 21500,
  strikes: [
    {
      strikePrice: 21300,
      call: { ltp: 250, volume: 1000, oi: 50000, iv: 18 },
      put: { ltp: 50, volume: 500, oi: 30000, iv: 16 },
    },
    {
      strikePrice: 21400,
      call: { ltp: 180, volume: 1200, oi: 60000, iv: 17 },
      put: { ltp: 80, volume: 800, oi: 40000, iv: 17 },
    },
    {
      strikePrice: 21500,
      call: { ltp: 120, volume: 1500, oi: 80000, iv: 16 },
      put: { ltp: 120, volume: 1500, oi: 80000, iv: 16 },
    },
    {
      strikePrice: 21600,
      call: { ltp: 80, volume: 800, oi: 40000, iv: 17 },
      put: { ltp: 180, volume: 1200, oi: 60000, iv: 17 },
    },
    {
      strikePrice: 21700,
      call: { ltp: 50, volume: 500, oi: 30000, iv: 18 },
      put: { ltp: 250, volume: 1000, oi: 50000, iv: 18 },
    },
  ],
};

// ============================================================================
// Tests
// ============================================================================

describe('OIChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<OIChart optionsChain={mockOptionsChain} />);
    expect(screen.getByText(/NIFTY Open Interest Comparison/i)).toBeInTheDocument();
  });

  it('displays the underlying symbol in the title', () => {
    render(<OIChart optionsChain={mockOptionsChain} />);
    expect(screen.getByText(/NIFTY Open Interest Comparison/i)).toBeInTheDocument();
  });

  it('displays spot price in summary', () => {
    render(<OIChart optionsChain={mockOptionsChain} />);
    expect(screen.getByText('Spot Price')).toBeInTheDocument();
    expect(screen.getByText('21500.00')).toBeInTheDocument();
  });

  it('calculates and displays total Call OI', () => {
    render(<OIChart optionsChain={mockOptionsChain} />);
    expect(screen.getByText('Total Call OI')).toBeInTheDocument();
    // Total: 50000 + 60000 + 80000 + 40000 + 30000 = 260000
    // Use getAllByText since both Call OI and Put OI have the same total
    const values = screen.getAllByText('260,000');
    expect(values.length).toBeGreaterThan(0);
  });

  it('calculates and displays total Put OI', () => {
    render(<OIChart optionsChain={mockOptionsChain} />);
    expect(screen.getByText('Total Put OI')).toBeInTheDocument();
    // Total: 30000 + 40000 + 80000 + 60000 + 50000 = 260000
    // Use getAllByText since both Call OI and Put OI have the same total
    const values = screen.getAllByText('260,000');
    expect(values.length).toBeGreaterThan(0);
  });

  it('displays legend with Call OI and Put OI labels', () => {
    render(<OIChart optionsChain={mockOptionsChain} />);
    expect(screen.getByText('Call OI')).toBeInTheDocument();
    expect(screen.getByText('Put OI')).toBeInTheDocument();
  });

  it('displays ATM strike in legend', () => {
    render(<OIChart optionsChain={mockOptionsChain} />);
    // ATM strike is closest to spot price (21500)
    expect(screen.getByText(/ATM Strike: 21500\.00/i)).toBeInTheDocument();
  });

  it('displays support zones when provided', () => {
    render(<OIChart optionsChain={mockOptionsChain} supportZones={[21300, 21400]} />);
    expect(screen.getByText('Support Zones')).toBeInTheDocument();
  });

  it('displays resistance zones when provided', () => {
    render(<OIChart optionsChain={mockOptionsChain} resistanceZones={[21600, 21700]} />);
    expect(screen.getByText('Resistance Zones')).toBeInTheDocument();
  });

  it('accepts custom height prop', () => {
    const { container } = render(<OIChart optionsChain={mockOptionsChain} height={500} />);
    const chartDiv = container.querySelector('div[style*="height: 500px"]');
    expect(chartDiv).toBeInTheDocument();
  });

  it('uses default height when not specified', () => {
    const { container } = render(<OIChart optionsChain={mockOptionsChain} />);
    const chartDiv = container.querySelector('div[style*="height: 400px"]');
    expect(chartDiv).toBeInTheDocument();
  });

  it('identifies correct ATM strike when spot is between strikes', () => {
    const modifiedChain = {
      ...mockOptionsChain,
      spotPrice: 21450, // Between 21400 and 21500
    };
    render(<OIChart optionsChain={modifiedChain} />);
    // Should pick 21400 or 21500 (whichever is closer)
    expect(screen.getByText(/ATM Strike: 21(400|500)\.00/i)).toBeInTheDocument();
  });

  it('handles empty strikes array gracefully', () => {
    const emptyChain: OptionsChainResponse = {
      underlying: 'NIFTY',
      expiryDate: '2024-12-26',
      spotPrice: 21500,
      strikes: [],
    };
    render(<OIChart optionsChain={emptyChain} />);
    expect(screen.getByText(/NIFTY Open Interest Comparison/i)).toBeInTheDocument();
    // Should not display ATM strike when no strikes
    expect(screen.queryByText(/ATM Strike/i)).not.toBeInTheDocument();
  });

  it('displays BANKNIFTY correctly', () => {
    const bankniftyChain: OptionsChainResponse = {
      underlying: 'BANKNIFTY',
      expiryDate: '2024-12-26',
      spotPrice: 45000,
      strikes: [
        {
          strikePrice: 45000,
          call: { ltp: 150, volume: 1000, oi: 50000, iv: 18 },
          put: { ltp: 150, volume: 1000, oi: 50000, iv: 18 },
        },
      ],
    };
    render(<OIChart optionsChain={bankniftyChain} />);
    expect(screen.getByText(/BANKNIFTY Open Interest Comparison/i)).toBeInTheDocument();
    expect(screen.getByText('45000.00')).toBeInTheDocument();
  });

  it('formats large OI numbers with commas', () => {
    const largeOIChain: OptionsChainResponse = {
      underlying: 'NIFTY',
      expiryDate: '2024-12-26',
      spotPrice: 21500,
      strikes: [
        {
          strikePrice: 21500,
          call: { ltp: 100, volume: 1000, oi: 1000000, iv: 18 },
          put: { ltp: 100, volume: 1000, oi: 2000000, iv: 18 },
        },
      ],
    };
    render(<OIChart optionsChain={largeOIChain} />);
    expect(screen.getByText('1,000,000')).toBeInTheDocument();
    expect(screen.getByText('2,000,000')).toBeInTheDocument();
  });
});
