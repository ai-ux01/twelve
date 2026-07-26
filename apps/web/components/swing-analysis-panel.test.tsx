import { render, screen } from '@testing-library/react';
import { SwingAnalysisPanel } from './swing-analysis-panel';
import { SwingCandidate, TrendlineData } from '@/lib/api-client';

describe('SwingAnalysisPanel', () => {
  const mockCandidate: SwingCandidate = {
    symbol: 'RELIANCE',
    score: 72.5,
    trend: 'UPTREND',
    setupType: 'BREAKOUT',
    entry: 2460.0,
    stopLoss: 2420.0,
    target: 2540.0,
    riskReward: 2.0,
    components: {
      trendScore: 80.0,
      technicalScore: 75.0,
      volumeScore: 85.0,
      relativeStrengthScore: 68.0,
      breakoutScore: 85.0,
      sectorScore: 65.0,
      riskRewardScore: 70.0,
    },
  };

  const mockTrendline: TrendlineData = {
    support_line: {
      slope: 2.5,
      intercept: 2350.0,
      r_squared: 0.89,
      start_point: 0,
      end_point: 10,
    },
    resistance_line: {
      slope: 1.8,
      intercept: 2400.0,
      r_squared: 0.85,
      start_point: 0,
      end_point: 10,
    },
    swing_points: [],
    breakout_status: 'BREAKOUT',
    direction: 'UPTREND',
    support_status: 'ACTIVE',
    resistance_status: 'BROKEN',
    confidence: 0.85,
  };

  describe('Component Rendering', () => {
    it('should render the component without crashing', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    });

    it('should display symbol', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    });

    it('should display overall score', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText(/72\.5/)).toBeInTheDocument();
    });
  });

  describe('Price Action Section', () => {
    it('should display price action section', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText('Price Action')).toBeInTheDocument();
    });

    it('should display trend correctly', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText('UPTREND')).toBeInTheDocument();
    });

    it('should display setup type', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText('BREAKOUT')).toBeInTheDocument();
    });

    it('should handle downtrend', () => {
      const downtrendCandidate = { ...mockCandidate, trend: 'DOWNTREND' };
      render(<SwingAnalysisPanel candidate={downtrendCandidate} />);
      expect(screen.getByText('DOWNTREND')).toBeInTheDocument();
    });
  });

  describe('Entry & Exit Levels Section', () => {
    it('should display entry and exit section', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText('Entry & Exit Levels')).toBeInTheDocument();
    });

    it('should display entry price', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText('₹2460.00')).toBeInTheDocument();
    });

    it('should display target price', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText('₹2540.00')).toBeInTheDocument();
    });

    it('should display stop loss', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText('₹2420.00')).toBeInTheDocument();
    });

    it('should display risk reward ratio', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText('2.00:1')).toBeInTheDocument();
    });
  });

  describe('Scoring Breakdown Section', () => {
    it('should display scoring breakdown section', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText('Scoring Breakdown')).toBeInTheDocument();
    });

    it('should display component scores', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.getByText(/80\.0/)).toBeInTheDocument(); // trend score
      expect(screen.getByText(/75\.0/)).toBeInTheDocument(); // technical score
      expect(screen.getByText(/68\.0/)).toBeInTheDocument(); // relative strength score
    });

    it('should display score labels', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      // "Trend" appears in both Price Action (as value) and Scoring Breakdown (as label)
      const trendElements = screen.getAllByText('Trend');
      expect(trendElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Technical')).toBeInTheDocument();
      expect(screen.getByText('Volume')).toBeInTheDocument();
      expect(screen.getByText('Relative Strength')).toBeInTheDocument();
    });
  });

  describe('Trendline Analysis Section', () => {
    it('should display trendline analysis section when trendline prop is provided', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} trendline={mockTrendline} />);
      expect(screen.getByText('Trendline Analysis')).toBeInTheDocument();
    });

    it('should display direction from trendline data', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} trendline={mockTrendline} />);
      // Direction appears in both Price Action and Trendline Analysis
      const uptrendElements = screen.getAllByText('UPTREND');
      expect(uptrendElements.length).toBeGreaterThanOrEqual(2);
    });

    it('should display breakout status', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} trendline={mockTrendline} />);
      const breakoutElements = screen.getAllByText('BREAKOUT');
      expect(breakoutElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should display confidence percentage', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} trendline={mockTrendline} />);
      expect(screen.getByText('85.0%')).toBeInTheDocument();
    });

    it('should display support status', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} trendline={mockTrendline} />);
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });

    it('should display resistance status', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} trendline={mockTrendline} />);
      expect(screen.getByText('BROKEN')).toBeInTheDocument();
    });

    it('should omit trendline section when trendline data is not available', () => {
      render(<SwingAnalysisPanel candidate={mockCandidate} />);
      expect(screen.queryByText('Trendline Analysis')).not.toBeInTheDocument();
    });

    it('should use candidate.trendline when trendline prop is not provided', () => {
      const candidateWithTrendline = { ...mockCandidate, trendline: mockTrendline };
      render(<SwingAnalysisPanel candidate={candidateWithTrendline} />);
      expect(screen.getByText('Trendline Analysis')).toBeInTheDocument();
    });
  });
});
