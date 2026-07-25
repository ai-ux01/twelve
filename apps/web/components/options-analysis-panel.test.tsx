/**
 * OptionsAnalysisPanel Component Tests
 * 
 * Tests PCR display, ATM strikes, OI buildup signals, support/resistance zones,
 * and data freshness indicators.
 * 
 * Requirements covered: 7.1, 13.2, 16.6
 */

import { render, screen } from '@testing-library/react';
import { OptionsAnalysisPanel } from './options-analysis-panel';
import type { OptionsAnalysisResult } from '../types/options';

describe('OptionsAnalysisPanel', () => {
  const mockData: OptionsAnalysisResult = {
    symbol: 'NIFTY',
    expiryDate: '2024-12-26',
    spotPrice: 21500.0,
    timestamp: new Date('2024-01-15T10:30:00Z'),
    pcrAnalysis: {
      pcrByOI: 0.85,
      pcrByVolume: 0.75,
      sentiment: 'BULLISH',
      totalCallOI: 5000000,
      totalPutOI: 4250000,
      totalCallVolume: 200000,
      totalPutVolume: 150000,
    },
    atmAnalysis: {
      spotPrice: 21500.0,
      atmStrike: 21500,
      strikeInterval: 50,
      nearATMStrikes: [
        {
          strike: 21350,
          distanceFromSpot: -0.7,
          callOI: 100000,
          putOI: 150000,
          callVolume: 5000,
          putVolume: 8000,
        },
        {
          strike: 21400,
          distanceFromSpot: -0.46,
          callOI: 120000,
          putOI: 180000,
          callVolume: 6000,
          putVolume: 9000,
        },
        {
          strike: 21450,
          distanceFromSpot: -0.23,
          callOI: 150000,
          putOI: 200000,
          callVolume: 7000,
          putVolume: 10000,
        },
        {
          strike: 21500,
          distanceFromSpot: 0,
          callOI: 200000,
          putOI: 250000,
          callVolume: 10000,
          putVolume: 12000,
        },
        {
          strike: 21550,
          distanceFromSpot: 0.23,
          callOI: 180000,
          putOI: 220000,
          callVolume: 8000,
          putVolume: 10000,
        },
        {
          strike: 21600,
          distanceFromSpot: 0.46,
          callOI: 160000,
          putOI: 190000,
          callVolume: 7000,
          putVolume: 9000,
        },
        {
          strike: 21650,
          distanceFromSpot: 0.7,
          callOI: 140000,
          putOI: 160000,
          callVolume: 6000,
          putVolume: 7000,
        },
      ],
    },
    oiAnalysis: {
      buildupType: 'LONG_BUILDUP',
      explanation: 'Increasing call OI with rising prices suggests bullish sentiment',
      supportLevels: [
        {
          strike: 21400,
          strength: 0.85,
          reason: 'High put OI concentration',
        },
        {
          strike: 21300,
          strength: 0.72,
          reason: 'Previous day support',
        },
        {
          strike: 21200,
          strength: 0.65,
          reason: 'Historical support zone',
        },
      ],
      resistanceLevels: [
        {
          strike: 21600,
          strength: 0.88,
          reason: 'High call OI concentration',
        },
        {
          strike: 21700,
          strength: 0.75,
          reason: 'Previous day resistance',
        },
        {
          strike: 21800,
          strength: 0.68,
          reason: 'Psychological level',
        },
      ],
      maxCallOIStrike: 21600,
      maxPutOIStrike: 21400,
      oiChangeAnalysis: [],
    },
  };

  describe('Component Rendering', () => {
    it('renders the options analysis title', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      expect(screen.getByText('Options Analysis')).toBeInTheDocument();
    });

    it('shows loading skeleton when isLoading is true', () => {
      render(<OptionsAnalysisPanel data={null} isLoading={true} error={null} />);

      // Check that the component shows loading state (no data content displayed)
      expect(screen.queryByText('Put-Call Ratio (PCR)')).not.toBeInTheDocument();
      expect(screen.queryByText('ATM Strike & Near Strikes')).not.toBeInTheDocument();
    });

    it('displays error message when error prop is provided', () => {
      render(<OptionsAnalysisPanel data={null} isLoading={false} error="Failed to fetch data" />);

      expect(screen.getByText(/Error:/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch data/i)).toBeInTheDocument();
    });
  });

  describe('PCR (Put-Call Ratio) Display', () => {
    it('displays PCR by OI and PCR by Volume', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      expect(screen.getByText('PCR by OI')).toBeInTheDocument();
      expect(screen.getByText('PCR by Volume')).toBeInTheDocument();
      // Use getAllByText since values appear multiple times (gauge + display)
      const pcrByOIValues = screen.getAllByText('0.85');
      const pcrByVolumeValues = screen.getAllByText('0.75');
      expect(pcrByOIValues.length).toBeGreaterThan(0);
      expect(pcrByVolumeValues.length).toBeGreaterThan(0);
    });

    it('displays market sentiment badge', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      expect(screen.getByText('Sentiment:')).toBeInTheDocument();
      expect(screen.getByText('BULLISH')).toBeInTheDocument();
    });

    it('displays total Call and Put OI and Volume', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      // Use getAllByText since these labels appear multiple times
      const callOILabels = screen.getAllByText(/Call OI:/i);
      const putOILabels = screen.getAllByText(/Put OI:/i);
      const callVolLabels = screen.getAllByText(/Call Vol:/i);
      const putVolLabels = screen.getAllByText(/Put Vol:/i);
      
      expect(callOILabels.length).toBeGreaterThan(0);
      expect(putOILabels.length).toBeGreaterThan(0);
      expect(callVolLabels.length).toBeGreaterThan(0);
      expect(putVolLabels.length).toBeGreaterThan(0);
    });

    it('renders PCR gauge visualization', () => {
      const { container } = render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      // Check for gradient gauge element
      const gauge = container.querySelector('[class*="bg-gradient-to-r"]');
      expect(gauge).toBeInTheDocument();
    });
  });

  describe('ATM Strike Analysis', () => {
    it('displays spot price and ATM strike', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      expect(screen.getByText('Spot Price:')).toBeInTheDocument();
      expect(screen.getByText('ATM Strike:')).toBeInTheDocument();
    });

    it('displays all near ATM strikes (±3)', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      expect(screen.getByText('Near ATM Strikes (±3):')).toBeInTheDocument();
      
      // Check that strikes are rendered (use getAllByText for strikes that appear multiple times)
      const strikes = mockData.atmAnalysis.nearATMStrikes;
      strikes.forEach((strike) => {
        const formattedStrike = strike.strike.toLocaleString('en-IN');
        const elements = screen.getAllByText(new RegExp(`₹${formattedStrike}`));
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it('highlights ATM strike with special styling', () => {
      const { container } = render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      // ATM strike should have yellow background/border
      const atmElement = container.querySelector('[class*="border-yellow-500"]');
      expect(atmElement).toBeInTheDocument();
    });

    it('displays Call OI and Put OI for each strike', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      // Check for Call OI and Put OI labels
      const callOIElements = screen.getAllByText(/Call OI:/i);
      const putOIElements = screen.getAllByText(/Put OI:/i);
      
      expect(callOIElements.length).toBeGreaterThan(0);
      expect(putOIElements.length).toBeGreaterThan(0);
    });
  });

  describe('OI Buildup/Unwinding Signals', () => {
    it('displays OI buildup type badge', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      expect(screen.getByText('LONG BUILDUP')).toBeInTheDocument();
    });

    it('displays explanation for OI buildup', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      expect(screen.getByText(mockData.oiAnalysis.explanation)).toBeInTheDocument();
    });

    it('displays max Call OI and Put OI strikes', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      expect(screen.getByText('Max Call OI Strike')).toBeInTheDocument();
      expect(screen.getByText('Max Put OI Strike')).toBeInTheDocument();
    });

    describe('Badge Colors', () => {
      it('displays LONG_BUILDUP with green badge', () => {
        const { container } = render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

        const badge = screen.getByText('LONG BUILDUP');
        expect(badge).toHaveClass('bg-green-500');
      });

      it('displays SHORT_BUILDUP with red badge', () => {
        const shortBuildupData = {
          ...mockData,
          oiAnalysis: {
            ...mockData.oiAnalysis,
            buildupType: 'SHORT_BUILDUP' as const,
          },
        };

        render(<OptionsAnalysisPanel data={shortBuildupData} isLoading={false} error={null} />);

        const badge = screen.getByText('SHORT BUILDUP');
        expect(badge).toHaveClass('bg-red-500');
      });

      it('displays LONG_UNWINDING with yellow badge', () => {
        const unwindingData = {
          ...mockData,
          oiAnalysis: {
            ...mockData.oiAnalysis,
            buildupType: 'LONG_UNWINDING' as const,
          },
        };

        render(<OptionsAnalysisPanel data={unwindingData} isLoading={false} error={null} />);

        const badge = screen.getByText('LONG UNWINDING');
        expect(badge).toHaveClass('bg-yellow-500');
      });

      it('displays SHORT_UNWINDING with blue badge', () => {
        const unwindingData = {
          ...mockData,
          oiAnalysis: {
            ...mockData.oiAnalysis,
            buildupType: 'SHORT_UNWINDING' as const,
          },
        };

        render(<OptionsAnalysisPanel data={unwindingData} isLoading={false} error={null} />);

        const badge = screen.getByText('SHORT UNWINDING');
        expect(badge).toHaveClass('bg-blue-500');
      });
    });
  });

  describe('Support and Resistance Zones', () => {
    it('displays support zones section', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      expect(screen.getByText('Support Zones')).toBeInTheDocument();
    });

    it('displays support level details', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      mockData.oiAnalysis.supportLevels.forEach((level) => {
        expect(screen.getByText(level.reason)).toBeInTheDocument();
      });
    });

    it('displays resistance zones section', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      expect(screen.getByText('Resistance Zones')).toBeInTheDocument();
    });

    it('displays resistance level details', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      mockData.oiAnalysis.resistanceLevels.forEach((level) => {
        expect(screen.getByText(level.reason)).toBeInTheDocument();
      });
    });

    it('displays strength percentage for each level', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      // Check for strength badges (85%, 72%, etc.)
      expect(screen.getByText(/Strength: 85%/i)).toBeInTheDocument();
      expect(screen.getByText(/Strength: 72%/i)).toBeInTheDocument();
    });
  });

  describe('Data Freshness Indicator', () => {
    it('displays last updated timestamp', () => {
      render(<OptionsAnalysisPanel data={mockData} isLoading={false} error={null} />);

      expect(screen.getByText(/Last updated:/i)).toBeInTheDocument();
    });

    it('shows staleness warning for old data (> 5 minutes)', () => {
      const staleData = {
        ...mockData,
        timestamp: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
      };

      render(<OptionsAnalysisPanel data={staleData} isLoading={false} error={null} />);

      expect(screen.getByText('Data may be stale')).toBeInTheDocument();
    });

    it('does not show staleness warning for fresh data (< 5 minutes)', () => {
      const freshData = {
        ...mockData,
        timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
      };

      render(<OptionsAnalysisPanel data={freshData} isLoading={false} error={null} />);

      expect(screen.queryByText('Data may be stale')).not.toBeInTheDocument();
    });
  });

  describe('Sentiment Display', () => {
    it('displays BEARISH sentiment correctly', () => {
      const bearishData = {
        ...mockData,
        pcrAnalysis: {
          ...mockData.pcrAnalysis,
          sentiment: 'BEARISH',
          pcrByOI: 1.5,
        },
      };

      render(<OptionsAnalysisPanel data={bearishData} isLoading={false} error={null} />);

      expect(screen.getByText('BEARISH')).toBeInTheDocument();
    });

    it('displays NEUTRAL sentiment correctly', () => {
      const neutralData = {
        ...mockData,
        pcrAnalysis: {
          ...mockData.pcrAnalysis,
          sentiment: 'NEUTRAL',
          pcrByOI: 1.0,
        },
      };

      render(<OptionsAnalysisPanel data={neutralData} isLoading={false} error={null} />);

      expect(screen.getByText('NEUTRAL')).toBeInTheDocument();
    });
  });
});
