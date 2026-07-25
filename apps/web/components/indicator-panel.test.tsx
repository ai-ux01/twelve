import { render, screen } from '@testing-library/react';
import { IndicatorPanel } from './indicator-panel';
import { IndicatorResult } from '@/lib/api-client';

describe('IndicatorPanel', () => {
  const mockIndicators: IndicatorResult = {
    rsi: 65.4,
    macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
    sma_20: 2455.0,
    sma_50: 2450.0,
    sma_200: 2380.0,
    ema_20: 2458.0,
    bollingerBands: { upper: 2500.0, middle: 2455.0, lower: 2410.0 },
    adx: 28.5,
    atr: 45.2,
    vwap: 2461.0,
    volume_ma: 1500000,
    relative_volume: 1.25,
    week_52_high: 2600.0,
    week_52_low: 2200.0,
    momentum: 3.5,
  };

  it('renders the component with all indicator sections', () => {
    render(<IndicatorPanel indicators={mockIndicators} />);

    // Check main title
    expect(screen.getByText('Technical Indicators')).toBeInTheDocument();

    // Check section headers
    expect(screen.getByText('ADX (Trend Strength)')).toBeInTheDocument();
    expect(screen.getByText('ATR (Average True Range)')).toBeInTheDocument();
    expect(screen.getByText('VWAP (Volume Weighted Avg)')).toBeInTheDocument();
    expect(screen.getByText('Volume Analysis')).toBeInTheDocument();
    expect(screen.getByText('52-Week Range')).toBeInTheDocument();
    expect(screen.getByText('Momentum')).toBeInTheDocument();
    expect(screen.getByText('Additional Indicators')).toBeInTheDocument();
  });

  it('displays ADX value and trend strength interpretation', () => {
    render(<IndicatorPanel indicators={mockIndicators} />);

    // Check ADX value
    expect(screen.getByText('28.50')).toBeInTheDocument();
    
    // Check trend strength badge
    expect(screen.getByText('Strong Trend')).toBeInTheDocument();
  });

  it('displays ATR value with volatility assessment', () => {
    render(<IndicatorPanel indicators={mockIndicators} currentPrice={2465.0} />);

    // Check ATR value
    expect(screen.getByText('₹45.20')).toBeInTheDocument();
    
    // Check volatility interpretation
    expect(screen.getByText(/Normal Volatility/i)).toBeInTheDocument();
  });

  it('displays VWAP and current price position', () => {
    const currentPrice = 2465.0;
    render(<IndicatorPanel indicators={mockIndicators} currentPrice={currentPrice} />);

    // Check VWAP value
    expect(screen.getByText('₹2461.00')).toBeInTheDocument();
    
    // Check current price
    expect(screen.getByText('₹2465.00')).toBeInTheDocument();
    
    // Should show "Above VWAP" since 2465 > 2461
    expect(screen.getByText(/Above VWAP/i)).toBeInTheDocument();
  });

  it('displays volume analysis with relative volume', () => {
    render(<IndicatorPanel indicators={mockIndicators} />);

    // Check volume MA
    expect(screen.getByText('1,500,000')).toBeInTheDocument();
    
    // Check relative volume
    expect(screen.getByText('1.25x')).toBeInTheDocument();
    
    // Check volume assessment
    expect(screen.getByText('High Volume')).toBeInTheDocument();
  });

  it('displays 52-week high and low', () => {
    render(<IndicatorPanel indicators={mockIndicators} currentPrice={2465.0} />);

    // Check 52-week high
    expect(screen.getByText('₹2600.00')).toBeInTheDocument();
    
    // Check 52-week low
    expect(screen.getByText('₹2200.00')).toBeInTheDocument();
    
    // Check distance calculations
    expect(screen.getByText(/below high/i)).toBeInTheDocument();
    expect(screen.getByText(/above low/i)).toBeInTheDocument();
  });

  it('displays momentum indicator with interpretation', () => {
    render(<IndicatorPanel indicators={mockIndicators} />);

    // Check momentum value
    expect(screen.getByText('+3.50%')).toBeInTheDocument();
    
    // Check momentum assessment (3.5% is "Bullish")
    expect(screen.getByText('Bullish')).toBeInTheDocument();
  });

  it('displays additional indicators (RSI and MACD)', () => {
    render(<IndicatorPanel indicators={mockIndicators} />);

    // Check RSI
    expect(screen.getByText('65.40')).toBeInTheDocument();
    
    // Check MACD
    expect(screen.getByText('12.30')).toBeInTheDocument();
  });

  it('shows weak trend interpretation for low ADX', () => {
    const lowADXIndicators = { ...mockIndicators, adx: 15.0 };
    render(<IndicatorPanel indicators={lowADXIndicators} />);

    expect(screen.getByText('Weak/No Trend')).toBeInTheDocument();
    expect(screen.getByText(/Market is ranging with no clear trend direction/i)).toBeInTheDocument();
  });

  it('shows very strong trend interpretation for high ADX', () => {
    const highADXIndicators = { ...mockIndicators, adx: 55.0 };
    render(<IndicatorPanel indicators={highADXIndicators} />);

    expect(screen.getByText('Very Strong Trend')).toBeInTheDocument();
    expect(screen.getByText(/Extremely strong trend/i)).toBeInTheDocument();
  });

  it('shows extreme volatility for high ATR', () => {
    const highATRIndicators = { ...mockIndicators, atr: 100.0 };
    render(<IndicatorPanel indicators={highATRIndicators} currentPrice={2465.0} />);

    expect(screen.getByText(/Extreme Volatility/i)).toBeInTheDocument();
  });

  it('shows below VWAP when current price is lower', () => {
    const currentPrice = 2450.0; // Below VWAP of 2461
    render(<IndicatorPanel indicators={mockIndicators} currentPrice={currentPrice} />);

    expect(screen.getByText(/Below VWAP/i)).toBeInTheDocument();
  });

  it('shows very low volume interpretation', () => {
    const lowVolumeIndicators = { ...mockIndicators, relative_volume: 0.4 };
    render(<IndicatorPanel indicators={lowVolumeIndicators} />);

    expect(screen.getByText('Very Low Volume')).toBeInTheDocument();
  });

  it('shows extremely high volume interpretation', () => {
    const highVolumeIndicators = { ...mockIndicators, relative_volume: 2.5 };
    render(<IndicatorPanel indicators={highVolumeIndicators} />);

    expect(screen.getByText('Extremely High Volume')).toBeInTheDocument();
  });

  it('shows strong bullish momentum for high positive momentum', () => {
    const strongMomentumIndicators = { ...mockIndicators, momentum: 6.5 };
    render(<IndicatorPanel indicators={strongMomentumIndicators} />);

    expect(screen.getByText('Strong Bullish')).toBeInTheDocument();
  });

  it('shows strong bearish momentum for high negative momentum', () => {
    const bearishMomentumIndicators = { ...mockIndicators, momentum: -6.5 };
    render(<IndicatorPanel indicators={bearishMomentumIndicators} />);

    expect(screen.getByText('Strong Bearish')).toBeInTheDocument();
  });

  it('shows neutral momentum for low momentum values', () => {
    const neutralMomentumIndicators = { ...mockIndicators, momentum: 0.5 };
    render(<IndicatorPanel indicators={neutralMomentumIndicators} />);

    expect(screen.getByText('Neutral')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <IndicatorPanel indicators={mockIndicators} className="custom-class" />
    );
    
    const card = container.querySelector('.custom-class');
    expect(card).toBeInTheDocument();
  });

  it('works without currentPrice prop', () => {
    render(<IndicatorPanel indicators={mockIndicators} />);

    // Should still render all sections
    expect(screen.getByText('Technical Indicators')).toBeInTheDocument();
    expect(screen.getByText('ADX (Trend Strength)')).toBeInTheDocument();
    expect(screen.getByText('VWAP (Volume Weighted Avg)')).toBeInTheDocument();
  });

  it('displays correct RSI color based on overbought/oversold levels', () => {
    // Overbought (>70)
    const overboughtIndicators = { ...mockIndicators, rsi: 75.0 };
    const { rerender } = render(<IndicatorPanel indicators={overboughtIndicators} />);
    expect(screen.getByText('75.00')).toHaveClass('text-red-600');

    // Oversold (<30)
    const oversoldIndicators = { ...mockIndicators, rsi: 25.0 };
    rerender(<IndicatorPanel indicators={oversoldIndicators} />);
    expect(screen.getByText('25.00')).toHaveClass('text-green-600');

    // Neutral (30-70)
    const neutralIndicators = { ...mockIndicators, rsi: 50.0 };
    rerender(<IndicatorPanel indicators={neutralIndicators} />);
    expect(screen.getByText('50.00')).toHaveClass('text-gray-600');
  });
});
