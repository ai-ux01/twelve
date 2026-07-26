import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TradeDetailsCard, TradeDetails } from './TradeDetailsCard';

describe('TradeDetailsCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseBuyTrade: TradeDetails = {
    signalType: 'BUY CE',
    underlying: 'NIFTY',
    optionType: 'CE',
    strikePrice: 19500,
    expiryDate: '2025-08-14',
    entryPrice: 150.5,
    targetPrice: 200.75,
    stopLoss: 125.25,
    riskRewardRatio: 2.0,
    lotSize: 50,
  };

  it('should display when signal is BUY', () => {
    render(<TradeDetailsCard trade={baseBuyTrade} />);
    expect(screen.getByText('Trade Details')).toBeInTheDocument();
  });

  it('should not display when signal is HOLD', () => {
    const holdTrade: TradeDetails = { ...baseBuyTrade, signalType: 'HOLD' };
    const { container } = render(<TradeDetailsCard trade={holdTrade} />);

    // Wait for the 500ms hide timeout
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(container.querySelector('[class*="card"]')).toBeNull();
  });

  it('should hide within 500ms when signal changes to HOLD', () => {
    const { rerender, container } = render(<TradeDetailsCard trade={baseBuyTrade} />);
    expect(screen.getByText('Trade Details')).toBeInTheDocument();

    const holdTrade: TradeDetails = { ...baseBuyTrade, signalType: 'HOLD' };
    rerender(<TradeDetailsCard trade={holdTrade} />);

    // Should still be visible before 500ms
    expect(screen.queryByText('Trade Details')).toBeInTheDocument();

    // After 500ms, should be hidden
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByText('Trade Details')).not.toBeInTheDocument();
  });

  it('should display underlying (NIFTY)', () => {
    render(<TradeDetailsCard trade={baseBuyTrade} />);
    expect(screen.getByText('NIFTY')).toBeInTheDocument();
  });

  it('should display underlying (BANKNIFTY)', () => {
    const trade: TradeDetails = { ...baseBuyTrade, underlying: 'BANKNIFTY' };
    render(<TradeDetailsCard trade={trade} />);
    expect(screen.getByText('BANKNIFTY')).toBeInTheDocument();
  });

  it('should display option type (CE)', () => {
    render(<TradeDetailsCard trade={baseBuyTrade} />);
    expect(screen.getByText('CE')).toBeInTheDocument();
  });

  it('should display option type (PE)', () => {
    const trade: TradeDetails = { ...baseBuyTrade, signalType: 'BUY PE', optionType: 'PE' };
    render(<TradeDetailsCard trade={trade} />);
    expect(screen.getByText('PE')).toBeInTheDocument();
  });

  it('should display strike price as integer with comma separator', () => {
    render(<TradeDetailsCard trade={baseBuyTrade} />);
    expect(screen.getByText('19,500')).toBeInTheDocument();
  });

  it('should display expiry in DD-MMM-YYYY format', () => {
    render(<TradeDetailsCard trade={baseBuyTrade} />);
    expect(screen.getByText('14-AUG-2025')).toBeInTheDocument();
  });

  it('should display entry price as ₹X.XX', () => {
    render(<TradeDetailsCard trade={baseBuyTrade} />);
    expect(screen.getByText('₹150.50')).toBeInTheDocument();
  });

  it('should display target with profit calculation', () => {
    render(<TradeDetailsCard trade={baseBuyTrade} />);
    // Target price
    expect(screen.getByText('₹200.75')).toBeInTheDocument();
    // Profit = (200.75 - 150.50) * 50 = 2512.50
    expect(screen.getByText('₹2,512.50 profit')).toBeInTheDocument();
  });

  it('should display stop loss with loss calculation', () => {
    render(<TradeDetailsCard trade={baseBuyTrade} />);
    // Stop loss price
    expect(screen.getByText('₹125.25')).toBeInTheDocument();
    // Loss = (150.50 - 125.25) * 50 = 1262.50
    expect(screen.getByText('₹1,262.50 loss')).toBeInTheDocument();
  });

  it('should display R:R ratio in 1:X format with 1 decimal', () => {
    render(<TradeDetailsCard trade={baseBuyTrade} />);
    expect(screen.getByText('1:2.0')).toBeInTheDocument();
  });

  it('should display lot size as integer', () => {
    render(<TradeDetailsCard trade={baseBuyTrade} />);
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should display "N/A" for missing underlying', () => {
    const trade: TradeDetails = { ...baseBuyTrade, underlying: null };
    render(<TradeDetailsCard trade={trade} />);
    const underlying = screen.getAllByText('N/A');
    expect(underlying.length).toBeGreaterThan(0);
  });

  it('should display "N/A" for missing strike price', () => {
    const trade: TradeDetails = { ...baseBuyTrade, strikePrice: null };
    render(<TradeDetailsCard trade={trade} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should display "N/A" for missing expiry', () => {
    const trade: TradeDetails = { ...baseBuyTrade, expiryDate: null };
    render(<TradeDetailsCard trade={trade} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should display "N/A" for missing entry price', () => {
    const trade: TradeDetails = { ...baseBuyTrade, entryPrice: null };
    render(<TradeDetailsCard trade={trade} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should display error and hide card for invalid strike (≤0)', () => {
    const trade: TradeDetails = { ...baseBuyTrade, strikePrice: 0 };
    render(<TradeDetailsCard trade={trade} />);
    expect(screen.getByText('Invalid strike price')).toBeInTheDocument();
    expect(screen.queryByText('Trade Details')).not.toBeInTheDocument();
  });

  it('should display error and hide card for negative strike', () => {
    const trade: TradeDetails = { ...baseBuyTrade, strikePrice: -100 };
    render(<TradeDetailsCard trade={trade} />);
    expect(screen.getByText('Invalid strike price')).toBeInTheDocument();
  });

  it('should display error and hide card for invalid lot size (≤0)', () => {
    const trade: TradeDetails = { ...baseBuyTrade, lotSize: 0 };
    render(<TradeDetailsCard trade={trade} />);
    expect(screen.getByText('Invalid lot size')).toBeInTheDocument();
    expect(screen.queryByText('Trade Details')).not.toBeInTheDocument();
  });

  it('should display error and hide card for negative lot size', () => {
    const trade: TradeDetails = { ...baseBuyTrade, lotSize: -5 };
    render(<TradeDetailsCard trade={trade} />);
    expect(screen.getByText('Invalid lot size')).toBeInTheDocument();
  });

  it('should display warning for expired contracts', () => {
    const trade: TradeDetails = { ...baseBuyTrade, expiryDate: '2020-01-01' };
    render(<TradeDetailsCard trade={trade} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('should not display warning for future expiry', () => {
    const trade: TradeDetails = { ...baseBuyTrade, expiryDate: '2030-12-31' };
    render(<TradeDetailsCard trade={trade} />);
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
  });

  it('should render nothing when trade is null', () => {
    const { container } = render(<TradeDetailsCard trade={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('should use default lot size for NIFTY (50) when lotSize is null', () => {
    const trade: TradeDetails = { ...baseBuyTrade, lotSize: null };
    render(<TradeDetailsCard trade={trade} />);
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should use default lot size for BANKNIFTY (25) when lotSize is null', () => {
    const trade: TradeDetails = {
      ...baseBuyTrade,
      underlying: 'BANKNIFTY',
      lotSize: null,
    };
    render(<TradeDetailsCard trade={trade} />);
    expect(screen.getByText('25')).toBeInTheDocument();
  });
});
