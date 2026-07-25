import { render, screen } from '@testing-library/react';
import { SwingAnalysisPanel, SwingAnalysisData } from './swing-analysis-panel';

describe('SwingAnalysisPanel', () => {
  const mockAnalysisData: SwingAnalysisData = {
    symbol: 'RELIANCE',
    timeframe: '1d',
    priceAction: {
      trend: 'UPTREND',
      higherHighs: true,
      higherLows: true,
      momentum: 12.5,
    },
    indicators: {
      rsi: 58.5,
      adx: 32.4,
      atr: 45.2,
      macd: {
        value: 12.3,
        signal: 10.1,
        histogram: 2.2,
      },
      ema_20: 2458.0,
      ema_50: 2452.0,
      ema_200: 2385.0,
      bollingerBands: {
        upper: 2500.0,
        middle: 2455.0,
        lower: 2410.0,
      },
      vwap: 2455.0,
    },
    volumeAnalysis: {
      volumeMA: 1200000,
      relativeVolume: 1.35,
      volumeTrend: 'INCREASING',
    },
    breakout: {
      status: 'BREAKOUT',
      type: 'RESISTANCE',
      volumeConfirmed: true,
      strength: 0.85,
    },
    supportResistance: [
      { level: 2400.0, strength: 0.85, touches: 5 },
      { level: 2500.0, strength: 0.72, touches: 3 },
    ],
    trendlines: [
      {
        type: 'SUPPORT',
        slope: 2.5,
        intercept: 2350.0,
        rSquared: 0.89,
      },
      {
        type: 'RESISTANCE',
        slope: 1.8,
        intercept: 2400.0,
        rSquared: 0.85,
      },
    ],
    sectorStrength: 68.5,
    marketRegime: {
      status: 'BULL_MARKET',
      strength: 0.78,
    },
    scoreBreakdown: {
      totalScore: 72.5,
      components: {
        trendScore: 80.0,
        technicalScore: 75.0,
        volumeScore: 85.0,
        relativeStrengthScore: 68.0,
        breakoutScore: 85.0,
        sectorScore: 65.0,
        riskRewardScore: 70.0,
      },
      weights: {
        trendWeight: 0.20,
        technicalWeight: 0.20,
        volumeWeight: 0.15,
        relativeStrengthWeight: 0.15,
        breakoutWeight: 0.10,
        sectorWeight: 0.10,
        riskRewardWeight: 0.10,
      },
    },
  };

  describe('Component Rendering', () => {
    it('should render the component without crashing', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    });

    it('should display symbol and timeframe', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText(/1d timeframe/i)).toBeInTheDocument();
    });

    it('should display overall score when provided', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('72.5')).toBeInTheDocument();
    });
  });

  describe('Price Action Section', () => {
    it('should display price action section', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('Price Action')).toBeInTheDocument();
    });

    it('should display trend correctly', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('UPTREND')).toBeInTheDocument();
    });

    it('should display momentum', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('12.50%')).toBeInTheDocument();
    });

    it('should display higher highs and higher lows status', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      const yesElements = screen.getAllByText('Yes');
      expect(yesElements.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle downtrend', () => {
      const downtrendData = {
        ...mockAnalysisData,
        priceAction: {
          ...mockAnalysisData.priceAction,
          trend: 'DOWNTREND' as const,
        },
      };
      render(<SwingAnalysisPanel analysis={downtrendData} />);
      expect(screen.getByText('DOWNTREND')).toBeInTheDocument();
    });
  });

  describe('Technical Indicators Section', () => {
    it('should display technical indicators section', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('Technical Indicators')).toBeInTheDocument();
    });

    it('should display RSI with status', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('58.50')).toBeInTheDocument();
      expect(screen.getByText('Bullish')).toBeInTheDocument();
    });

    it('should display ADX with status', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('32.40')).toBeInTheDocument();
      expect(screen.getByText('Strong Trend')).toBeInTheDocument();
    });

    it('should display ATR', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('45.20')).toBeInTheDocument();
    });

    it('should display MACD values', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('12.30')).toBeInTheDocument();
      expect(screen.getByText('10.10')).toBeInTheDocument();
      expect(screen.getByText('2.20')).toBeInTheDocument();
    });

    it('should display EMA values', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('₹2458.00')).toBeInTheDocument();
      expect(screen.getByText('₹2452.00')).toBeInTheDocument();
      expect(screen.getByText('₹2385.00')).toBeInTheDocument();
    });

    it('should display Bollinger Bands', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      // Use getAllByText for values that appear in multiple places
      const upperValues = screen.getAllByText('₹2500.00');
      const middleValues = screen.getAllByText('₹2455.00');
      const lowerValues = screen.getAllByText('₹2410.00');
      expect(upperValues.length).toBeGreaterThanOrEqual(1);
      expect(middleValues.length).toBeGreaterThanOrEqual(1);
      expect(lowerValues.length).toBeGreaterThanOrEqual(1);
    });

    it('should display VWAP', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('Volume Weighted Average Price')).toBeInTheDocument();
    });

    it('should show RSI as overbought when > 70', () => {
      const overboughtData = {
        ...mockAnalysisData,
        indicators: { ...mockAnalysisData.indicators, rsi: 75 },
      };
      render(<SwingAnalysisPanel analysis={overboughtData} />);
      expect(screen.getByText('Overbought')).toBeInTheDocument();
    });

    it('should show RSI as oversold when < 30', () => {
      const oversoldData = {
        ...mockAnalysisData,
        indicators: { ...mockAnalysisData.indicators, rsi: 25 },
      };
      render(<SwingAnalysisPanel analysis={oversoldData} />);
      expect(screen.getByText('Oversold')).toBeInTheDocument();
    });
  });

  describe('Volume Analysis Section', () => {
    it('should display volume analysis section', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('Volume Analysis')).toBeInTheDocument();
    });

    it('should display volume MA', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('1,200,000')).toBeInTheDocument();
    });

    it('should display relative volume', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('1.35x')).toBeInTheDocument();
      expect(screen.getByText('Above Average')).toBeInTheDocument();
    });

    it('should display volume trend', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('INCREASING')).toBeInTheDocument();
    });

    it('should show below average when relative volume < 1', () => {
      const belowAverageData = {
        ...mockAnalysisData,
        volumeAnalysis: { ...mockAnalysisData.volumeAnalysis, relativeVolume: 0.8 },
      };
      render(<SwingAnalysisPanel analysis={belowAverageData} />);
      expect(screen.getByText('Below Average')).toBeInTheDocument();
    });
  });

  describe('Breakout Status Section', () => {
    it('should display breakout section when breakout data is present', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('Breakout Status')).toBeInTheDocument();
    });

    it('should display breakout status', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('BREAKOUT')).toBeInTheDocument();
    });

    it('should display breakout type', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      const resistanceElements = screen.getAllByText('RESISTANCE');
      expect(resistanceElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should display volume confirmation', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      const yesElements = screen.getAllByText('Yes');
      expect(yesElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should display breakout strength', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      const strengthElements = screen.getAllByText('85%');
      expect(strengthElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should not display breakout section when data is missing', () => {
      const noBreakoutData = {
        ...mockAnalysisData,
        breakout: undefined,
      };
      render(<SwingAnalysisPanel analysis={noBreakoutData} />);
      expect(screen.queryByText('Breakout Status')).not.toBeInTheDocument();
    });
  });

  describe('Support/Resistance Levels Section', () => {
    it('should display support and resistance section', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('Support & Resistance Levels')).toBeInTheDocument();
    });

    it('should display all levels', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
    });

    it('should display level values', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      const level2400 = screen.getAllByText('₹2400.00');
      const level2500 = screen.getAllByText('₹2500.00');
      expect(level2400.length).toBeGreaterThanOrEqual(1);
      expect(level2500.length).toBeGreaterThanOrEqual(1);
    });

    it('should display touches count', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('5 touches')).toBeInTheDocument();
      expect(screen.getByText('3 touches')).toBeInTheDocument();
    });

    it('should display empty state when no levels', () => {
      const noLevelsData = {
        ...mockAnalysisData,
        supportResistance: [],
      };
      render(<SwingAnalysisPanel analysis={noLevelsData} />);
      expect(screen.getByText('No significant levels detected')).toBeInTheDocument();
    });
  });

  describe('Trendlines Section', () => {
    it('should display trendlines section when data is present', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('Trendlines')).toBeInTheDocument();
    });

    it('should display trendline types', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      const supportElements = screen.getAllByText('SUPPORT');
      const resistanceElements = screen.getAllByText('RESISTANCE');
      expect(supportElements.length).toBeGreaterThanOrEqual(1);
      expect(resistanceElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should display R-squared values', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText(/R² = 0\.89/)).toBeInTheDocument();
      expect(screen.getByText(/R² = 0\.85/)).toBeInTheDocument();
    });

    it('should not display trendlines section when data is missing', () => {
      const noTrendlinesData = {
        ...mockAnalysisData,
        trendlines: undefined,
      };
      render(<SwingAnalysisPanel analysis={noTrendlinesData} />);
      const trendlinesHeadings = screen.queryAllByText('Trendlines');
      expect(trendlinesHeadings.length).toBe(0);
    });
  });

  describe('Sector & Market Context Section', () => {
    it('should display sector and market section when data is present', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('Sector & Market Context')).toBeInTheDocument();
    });

    it('should display sector strength', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('68.5')).toBeInTheDocument();
    });

    it('should display market regime', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('BULL MARKET')).toBeInTheDocument();
    });

    it('should not display section when both sector and market data are missing', () => {
      const noContextData = {
        ...mockAnalysisData,
        sectorStrength: undefined,
        marketRegime: undefined,
      };
      render(<SwingAnalysisPanel analysis={noContextData} />);
      expect(screen.queryByText('Sector & Market Context')).not.toBeInTheDocument();
    });
  });

  describe('Scoring Breakdown Section', () => {
    it('should display scoring breakdown section when data is present', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('Scoring Breakdown')).toBeInTheDocument();
    });

    it('should display all component scores', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      expect(screen.getByText('80.0')).toBeInTheDocument(); // trend score
      expect(screen.getByText('75.0')).toBeInTheDocument(); // technical score
      expect(screen.getByText('68.0')).toBeInTheDocument(); // relative strength score
    });

    it('should display weights for each component', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      const weight20Elements = screen.getAllByText('Weight: 20%'); // trend weight
      const weight15Elements = screen.getAllByText('Weight: 15%'); // volume weight
      expect(weight20Elements.length).toBeGreaterThanOrEqual(1);
      expect(weight15Elements.length).toBeGreaterThanOrEqual(1);
    });

    it('should not display scoring section when data is missing', () => {
      const noScoreData = {
        ...mockAnalysisData,
        scoreBreakdown: undefined,
      };
      render(<SwingAnalysisPanel analysis={noScoreData} />);
      expect(screen.queryByText('Scoring Breakdown')).not.toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should accept and apply custom className', () => {
      const { container } = render(
        <SwingAnalysisPanel analysis={mockAnalysisData} className="custom-class" />
      );
      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv.className).toContain('custom-class');
    });
  });

  describe('Requirement 13.2: UI Component Structure', () => {
    it('should display all required sections for comprehensive analysis', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      
      // Verify all main sections are present
      expect(screen.getByText('Price Action')).toBeInTheDocument();
      expect(screen.getByText('Technical Indicators')).toBeInTheDocument();
      expect(screen.getByText('Volume Analysis')).toBeInTheDocument();
      expect(screen.getByText('Breakout Status')).toBeInTheDocument();
      expect(screen.getByText('Support & Resistance Levels')).toBeInTheDocument();
      expect(screen.getByText('Trendlines')).toBeInTheDocument();
      expect(screen.getByText('Sector & Market Context')).toBeInTheDocument();
      expect(screen.getByText('Scoring Breakdown')).toBeInTheDocument();
    });
  });

  describe('Requirement 5.5 (21.2): Technical Factor Display', () => {
    it('should display all technical factors required for swing trading analysis', () => {
      render(<SwingAnalysisPanel analysis={mockAnalysisData} />);
      
      // Price Action factors
      expect(screen.getByText('UPTREND')).toBeInTheDocument();
      expect(screen.getByText('12.50%')).toBeInTheDocument();
      
      // Technical Indicators
      expect(screen.getByText('58.50')).toBeInTheDocument(); // RSI
      expect(screen.getByText('32.40')).toBeInTheDocument(); // ADX
      expect(screen.getByText('45.20')).toBeInTheDocument(); // ATR
      
      // Volume Analysis
      expect(screen.getByText('1.35x')).toBeInTheDocument();
      expect(screen.getByText('INCREASING')).toBeInTheDocument();
      
      // Breakout
      expect(screen.getByText('BREAKOUT')).toBeInTheDocument();
      
      // Support/Resistance
      const level2400 = screen.getAllByText('₹2400.00');
      const level2500 = screen.getAllByText('₹2500.00');
      expect(level2400.length).toBeGreaterThanOrEqual(1);
      expect(level2500.length).toBeGreaterThanOrEqual(1);
      
      // Sector & Market
      expect(screen.getByText('68.5')).toBeInTheDocument();
      expect(screen.getByText('BULL MARKET')).toBeInTheDocument();
    });
  });
});
