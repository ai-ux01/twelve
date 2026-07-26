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
});
