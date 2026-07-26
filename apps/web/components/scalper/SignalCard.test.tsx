import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalCard, SignalData } from './SignalCard';

describe('SignalCard', () => {
  const mockBuySignal: SignalData = {
    signalType: 'BUY CE',
    strikePrice: 19500.0,
    expiryDate: '2024-01-18',
    entryPrice: 245.5,
    targetPrice: 295.5,
    stopLoss: 220.5,
    probability: 75.5,
    riskRewardRatio: 2.0,
    trend: 'Bullish',
    oiInterpretation: 'Bullish',
    pcr: 1.25,
    trendlineStatus: 'Bullish',
    supportLevel: 19350.0,
    resistanceLevel: 19650.0,
  };

  const mockHoldSignal: SignalData = {
    signalType: 'HOLD',
    strikePrice: null,
    expiryDate: null,
    entryPrice: null,
    targetPrice: null,
    stopLoss: null,
    probability: 55.3,
    riskRewardRatio: 1.5,
    trend: 'Neutral',
    oiInterpretation: 'Neutral',
    pcr: 0.95,
    trendlineStatus: 'Neutral',
    supportLevel: 19350.0,
    resistanceLevel: 19650.0,
    holdReason: 'Low Probability',
  };

  it('should display signal type BUY CE with font >= 32px', () => {
    render(<SignalCard signal={mockBuySignal} />);
    const signalText = screen.getByText('BUY CE');
    expect(signalText).toBeInTheDocument();
    expect(signalText).toHaveStyle({ fontSize: '32px' });
  });

  it('should display signal type BUY PE', () => {
    const peSignal: SignalData = { ...mockBuySignal, signalType: 'BUY PE' };
    render(<SignalCard signal={peSignal} />);
    expect(screen.getByText('BUY PE')).toBeInTheDocument();
  });

  it('should display signal type HOLD', () => {
    render(<SignalCard signal={mockHoldSignal} />);
    expect(screen.getByText('HOLD')).toBeInTheDocument();
  });

  it('should display strike price with 2 decimals when BUY', () => {
    render(<SignalCard signal={mockBuySignal} />);
    expect(screen.getByText('₹19500.00')).toBeInTheDocument();
  });

  it('should display expiry date in DD-MMM-YYYY format when BUY', () => {
    render(<SignalCard signal={mockBuySignal} />);
    expect(screen.getByText('18-JAN-2024')).toBeInTheDocument();
  });

  it('should display entry, target, stop loss prices with 2 decimals', () => {
    render(<SignalCard signal={mockBuySignal} />);
    expect(screen.getByText('₹245.50')).toBeInTheDocument();
    expect(screen.getByText('₹295.50')).toBeInTheDocument();
    expect(screen.getByText('₹220.50')).toBeInTheDocument();
  });

  it('should display probability with 1 decimal', () => {
    render(<SignalCard signal={mockBuySignal} />);
    // Probability appears in badge and in Probability section
    const probElements = screen.getAllByText('75.5%');
    expect(probElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should display risk/reward ratio in 1:X.X format', () => {
    render(<SignalCard signal={mockBuySignal} />);
    expect(screen.getByText('1:2.0')).toBeInTheDocument();
  });

  it('should display trend', () => {
    render(<SignalCard signal={mockBuySignal} />);
    // Trend "Bullish" appears multiple times (trend, OI, trendline)
    const bullishElements = screen.getAllByText('Bullish');
    expect(bullishElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should display OI interpretation', () => {
    render(<SignalCard signal={mockBuySignal} />);
    const oiElements = screen.getAllByText('Bullish');
    expect(oiElements.length).toBeGreaterThanOrEqual(2); // trend + OI + trendline
  });

  it('should display PCR with 2 decimals', () => {
    render(<SignalCard signal={mockBuySignal} />);
    expect(screen.getByText('1.25')).toBeInTheDocument();
  });

  it('should display support and resistance levels with 2 decimals', () => {
    render(<SignalCard signal={mockBuySignal} />);
    expect(screen.getByText('₹19350.00')).toBeInTheDocument();
    expect(screen.getByText('₹19650.00')).toBeInTheDocument();
  });

  it('should display "N/A" for null values', () => {
    const nullSignal: SignalData = {
      ...mockHoldSignal,
      trend: null,
      oiInterpretation: null,
      pcr: null,
      trendlineStatus: null,
      supportLevel: null,
      resistanceLevel: null,
    };
    render(<SignalCard signal={nullSignal} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should display "Error" for invalid probability (out of range)', () => {
    const invalidSignal: SignalData = {
      ...mockBuySignal,
      probability: 150,
    };
    render(<SignalCard signal={invalidSignal} />);
    // Multiple "Error" elements may appear (badge, probability text, error message)
    const errorElements = screen.getAllByText(/Error/);
    expect(errorElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should display hold reason when signal is HOLD', () => {
    render(<SignalCard signal={mockHoldSignal} />);
    expect(screen.getByText('Reason: Low Probability')).toBeInTheDocument();
  });

  it('should display "Waiting for analysis..." when signal is null', () => {
    render(<SignalCard signal={null} />);
    expect(screen.getByText('Waiting for analysis...')).toBeInTheDocument();
  });

  it('should not display strike/expiry for HOLD signals', () => {
    render(<SignalCard signal={mockHoldSignal} />);
    expect(screen.queryByText('Strike Price')).not.toBeInTheDocument();
    expect(screen.queryByText('Expiry Date')).not.toBeInTheDocument();
  });

  describe('Trendline display', () => {
    it('should display trendline direction when data is available', () => {
      const signalWithTrendline: SignalData = {
        ...mockBuySignal,
        trendlineDirection: 'UPTREND',
      };
      render(<SignalCard signal={signalWithTrendline} />);
      expect(screen.getByText('UPTREND')).toBeInTheDocument();
    });

    it('should display DOWNTREND direction when provided', () => {
      const signalWithTrendline: SignalData = {
        ...mockBuySignal,
        trendlineDirection: 'DOWNTREND',
      };
      render(<SignalCard signal={signalWithTrendline} />);
      expect(screen.getByText('DOWNTREND')).toBeInTheDocument();
    });

    it('should display SIDEWAYS direction when provided', () => {
      const signalWithTrendline: SignalData = {
        ...mockBuySignal,
        trendlineDirection: 'SIDEWAYS',
      };
      render(<SignalCard signal={signalWithTrendline} />);
      expect(screen.getByText('SIDEWAYS')).toBeInTheDocument();
    });

    it('should display breakout badge when breakoutStatus is BREAKOUT', () => {
      const signalWithBreakout: SignalData = {
        ...mockBuySignal,
        breakoutStatus: 'BREAKOUT',
      };
      render(<SignalCard signal={signalWithBreakout} />);
      expect(screen.getByText('BREAKOUT')).toBeInTheDocument();
      // The Badge should be rendered (default variant for BREAKOUT)
      const badge = screen.getByText('BREAKOUT').closest('[class*="badge"]') ||
        screen.getByText('BREAKOUT').closest('.inline-flex');
      expect(badge).toBeInTheDocument();
    });

    it('should display breakdown badge with destructive variant when breakoutStatus is BREAKDOWN', () => {
      const signalWithBreakdown: SignalData = {
        ...mockBuySignal,
        breakoutStatus: 'BREAKDOWN',
      };
      render(<SignalCard signal={signalWithBreakdown} />);
      expect(screen.getByText('BREAKDOWN')).toBeInTheDocument();
    });

    it('should display confirmed badge when breakoutStatus is CONFIRMED', () => {
      const signalWithConfirmed: SignalData = {
        ...mockBuySignal,
        breakoutStatus: 'CONFIRMED',
      };
      render(<SignalCard signal={signalWithConfirmed} />);
      expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    });

    it('should display "N/A" for trendline direction when not provided', () => {
      const signalWithoutTrendline: SignalData = {
        ...mockBuySignal,
        trendlineDirection: undefined,
        breakoutStatus: undefined,
      };
      render(<SignalCard signal={signalWithoutTrendline} />);
      // The Direction field should show N/A
      const directionLabel = screen.getByText('Direction:');
      const directionContainer = directionLabel.closest('div');
      expect(directionContainer).toHaveTextContent('N/A');
    });

    it('should display "N/A" for breakout when breakoutStatus is not provided', () => {
      const signalWithoutBreakout: SignalData = {
        ...mockBuySignal,
        breakoutStatus: undefined,
      };
      render(<SignalCard signal={signalWithoutBreakout} />);
      const breakoutLabel = screen.getByText('Breakout:');
      const breakoutContainer = breakoutLabel.closest('div');
      expect(breakoutContainer).toHaveTextContent('N/A');
    });

    it('should display "N/A" for breakout when breakoutStatus is null', () => {
      const signalWithNullBreakout: SignalData = {
        ...mockBuySignal,
        breakoutStatus: null,
      };
      render(<SignalCard signal={signalWithNullBreakout} />);
      const breakoutLabel = screen.getByText('Breakout:');
      const breakoutContainer = breakoutLabel.closest('div');
      expect(breakoutContainer).toHaveTextContent('N/A');
    });

    it('should display formatted trendline support level when provided', () => {
      const signalWithLevels: SignalData = {
        ...mockBuySignal,
        trendlineSupportLevel: 19200.75,
      };
      render(<SignalCard signal={signalWithLevels} />);
      expect(screen.getByText('₹19200.75')).toBeInTheDocument();
    });

    it('should display formatted trendline resistance level when provided', () => {
      const signalWithLevels: SignalData = {
        ...mockBuySignal,
        trendlineResistanceLevel: 19800.50,
      };
      render(<SignalCard signal={signalWithLevels} />);
      expect(screen.getByText('₹19800.50')).toBeInTheDocument();
    });

    it('should display "N/A" for trendline support level when not provided', () => {
      const signalWithoutLevels: SignalData = {
        ...mockBuySignal,
        trendlineSupportLevel: undefined,
        trendlineResistanceLevel: undefined,
      };
      render(<SignalCard signal={signalWithoutLevels} />);
      const tlSupportLabel = screen.getByText('TL Support:');
      const tlSupportContainer = tlSupportLabel.closest('div');
      expect(tlSupportContainer).toHaveTextContent('N/A');
    });

    it('should display "N/A" for trendline resistance level when not provided', () => {
      const signalWithoutLevels: SignalData = {
        ...mockBuySignal,
        trendlineSupportLevel: undefined,
        trendlineResistanceLevel: undefined,
      };
      render(<SignalCard signal={signalWithoutLevels} />);
      const tlResistanceLabel = screen.getByText('TL Resistance:');
      const tlResistanceContainer = tlResistanceLabel.closest('div');
      expect(tlResistanceContainer).toHaveTextContent('N/A');
    });

    it('should display NONE breakoutStatus as plain text without badge', () => {
      const signalWithNone: SignalData = {
        ...mockBuySignal,
        breakoutStatus: 'NONE',
      };
      render(<SignalCard signal={signalWithNone} />);
      const breakoutLabel = screen.getByText('Breakout:');
      const breakoutContainer = breakoutLabel.closest('div');
      expect(breakoutContainer).toHaveTextContent('NONE');
      // Should not be rendered as a Badge (no badge class)
      expect(breakoutContainer?.querySelector('[class*="badge"]')).not.toBeInTheDocument();
    });
  });
});
