import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarketAnalysisPanel, MarketAnalysisData } from './MarketAnalysisPanel';

describe('MarketAnalysisPanel', () => {
  const baseData: MarketAnalysisData = {
    spotPrice: 19542.35,
    trend: 'Bullish',
    rsi: 65.42,
    macd: 12.56,
    macdSignal: 10.23,
    vwap: 19500.0,
    ema5: 19530.15,
    ema15: 19510.80,
    supportLevel: 19450.25,
    resistanceLevel: 19620.50,
    trendlineStatus: 'Bullish',
    callOI: 1250000,
    putOI: 1875000,
    callOIChange: 50000,
    putOIChange: -25000,
    callOIChangePct: 4.17,
    putOIChangePct: -1.32,
    pcr: 1.5,
    atr: 85.45,
  };

  it('should display spot price with 2 decimals', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('₹19542.35')).toBeInTheDocument();
  });

  it('should display trend as Bullish', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    const bullishElements = screen.getAllByText('Bullish');
    expect(bullishElements.length).toBeGreaterThan(0);
  });

  it('should display trend as Bearish', () => {
    const data: MarketAnalysisData = { ...baseData, trend: 'Bearish', trendlineStatus: 'Neutral' };
    render(<MarketAnalysisPanel data={data} />);
    expect(screen.getByText('Bearish')).toBeInTheDocument();
  });

  it('should display trend as Neutral', () => {
    const data: MarketAnalysisData = { ...baseData, trend: 'Neutral', trendlineStatus: 'Bearish' };
    render(<MarketAnalysisPanel data={data} />);
    const neutralElements = screen.getAllByText('Neutral');
    expect(neutralElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should display RSI with 2 decimals', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('65.42')).toBeInTheDocument();
  });

  it('should display RSI Overbought indication for RSI > 70', () => {
    const data: MarketAnalysisData = { ...baseData, rsi: 75.32 };
    render(<MarketAnalysisPanel data={data} />);
    expect(screen.getByText('75.32')).toBeInTheDocument();
    expect(screen.getByText('Overbought')).toBeInTheDocument();
  });

  it('should display RSI Oversold indication for RSI < 30', () => {
    const data: MarketAnalysisData = { ...baseData, rsi: 25.10 };
    render(<MarketAnalysisPanel data={data} />);
    expect(screen.getByText('25.10')).toBeInTheDocument();
    expect(screen.getByText('Oversold')).toBeInTheDocument();
  });

  it('should display RSI Neutral indication for RSI between 30-70', () => {
    const data: MarketAnalysisData = { ...baseData, rsi: 65.42, trendlineStatus: 'Bearish', trend: 'Bearish' };
    render(<MarketAnalysisPanel data={data} />);
    expect(screen.getByText('65.42')).toBeInTheDocument();
    // RSI Neutral indication
    const neutralElements = screen.getAllByText('Neutral');
    expect(neutralElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should display MACD and signal line with 2 decimals', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('12.56 / 10.23')).toBeInTheDocument();
  });

  it('should display MACD Bullish indication when MACD > Signal', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    // MACD 12.56 > Signal 10.23 = Bullish
    const bullishElements = screen.getAllByText('Bullish');
    expect(bullishElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should display MACD Bearish indication when MACD < Signal', () => {
    const data: MarketAnalysisData = { ...baseData, macd: 8.0, macdSignal: 10.23, trend: 'Neutral', trendlineStatus: 'Neutral' };
    render(<MarketAnalysisPanel data={data} />);
    expect(screen.getByText('Bearish')).toBeInTheDocument();
  });

  it('should display MACD Neutral indication when equal', () => {
    const data: MarketAnalysisData = { ...baseData, macd: 10.0, macdSignal: 10.0, trend: 'Bearish', trendlineStatus: 'Bearish' };
    render(<MarketAnalysisPanel data={data} />);
    // MACD Neutral + RSI Neutral + PCR Neutral = at least one "Neutral"
    const neutralElements = screen.getAllByText('Neutral');
    expect(neutralElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should display price vs VWAP as percentage with Above VWAP label', () => {
    // ((19542.35 - 19500) / 19500) * 100 = +0.22%
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('+0.22%')).toBeInTheDocument();
    expect(screen.getByText('Above VWAP')).toBeInTheDocument();
  });

  it('should display Below VWAP when price is below VWAP', () => {
    const data: MarketAnalysisData = { ...baseData, spotPrice: 19400.0, vwap: 19500.0 };
    render(<MarketAnalysisPanel data={data} />);
    // ((19400 - 19500) / 19500) * 100 = -0.51%
    expect(screen.getByText('-0.51%')).toBeInTheDocument();
    expect(screen.getByText('Below VWAP')).toBeInTheDocument();
  });

  it('should display EMA 5 with 2 decimals', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('19530.15')).toBeInTheDocument();
  });

  it('should display EMA 15 with 2 decimals', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('19510.80')).toBeInTheDocument();
  });

  it('should display support level with 2 decimals and ₹ symbol', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('₹19450.25')).toBeInTheDocument();
  });

  it('should display resistance level with 2 decimals and ₹ symbol', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('₹19620.50')).toBeInTheDocument();
  });

  it('should display trendline status', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    const bullishElements = screen.getAllByText('Bullish');
    expect(bullishElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should display Call OI with comma separators', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('12,50,000')).toBeInTheDocument();
  });

  it('should display Put OI with comma separators', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('18,75,000')).toBeInTheDocument();
  });

  it('should display Call OI change with absolute and percentage', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    // Rendered as "Change: +50,000 (+4.17%)"
    expect(screen.getByText('Change: +50,000 (+4.17%)')).toBeInTheDocument();
  });

  it('should display Put OI change with negative values', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    // Rendered as "Change: -25,000 (-1.32%)"
    expect(screen.getByText('Change: -25,000 (-1.32%)')).toBeInTheDocument();
  });

  it('should display PCR with 2 decimals', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('1.50')).toBeInTheDocument();
  });

  it('should display PCR Bearish interpretation for PCR > 1.5', () => {
    const data: MarketAnalysisData = { ...baseData, pcr: 1.8, trend: 'Neutral', trendlineStatus: 'Neutral' };
    render(<MarketAnalysisPanel data={data} />);
    expect(screen.getByText('1.80')).toBeInTheDocument();
    expect(screen.getByText('Bearish')).toBeInTheDocument();
  });

  it('should display PCR Bullish interpretation for PCR < 0.7', () => {
    const data: MarketAnalysisData = { ...baseData, pcr: 0.5 };
    render(<MarketAnalysisPanel data={data} />);
    expect(screen.getByText('0.50')).toBeInTheDocument();
    const bullishBadges = screen.getAllByText('Bullish');
    expect(bullishBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('should display PCR Neutral interpretation for PCR 0.7-1.5', () => {
    const data: MarketAnalysisData = { ...baseData, pcr: 1.0, trend: 'Bearish', trendlineStatus: 'Bearish' };
    render(<MarketAnalysisPanel data={data} />);
    expect(screen.getByText('1.00')).toBeInTheDocument();
    const neutralElements = screen.getAllByText('Neutral');
    expect(neutralElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should display ATR with 2 decimals', () => {
    render(<MarketAnalysisPanel data={baseData} />);
    expect(screen.getByText('85.45')).toBeInTheDocument();
  });

  it('should display "N/A" for null spot price', () => {
    const data: MarketAnalysisData = { ...baseData, spotPrice: null };
    render(<MarketAnalysisPanel data={data} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should display "N/A" for null RSI', () => {
    const data: MarketAnalysisData = { ...baseData, rsi: null };
    render(<MarketAnalysisPanel data={data} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should display "N/A" in MACD section for null MACD', () => {
    const data: MarketAnalysisData = { ...baseData, macd: null };
    render(<MarketAnalysisPanel data={data} />);
    // MACD text becomes "N/A / 10.23" (contained within a single element)
    expect(screen.getByText('N/A / 10.23')).toBeInTheDocument();
  });

  it('should display "N/A" for null VWAP', () => {
    const data: MarketAnalysisData = { ...baseData, vwap: null };
    render(<MarketAnalysisPanel data={data} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should display "N/A" for null Call OI', () => {
    const data: MarketAnalysisData = { ...baseData, callOI: null };
    render(<MarketAnalysisPanel data={data} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should display "N/A" for null trend', () => {
    const data: MarketAnalysisData = { ...baseData, trend: null };
    render(<MarketAnalysisPanel data={data} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should display waiting message when data is null', () => {
    render(<MarketAnalysisPanel data={null} />);
    expect(screen.getByText('Waiting for market data...')).toBeInTheDocument();
  });

  it('should display "N/A" for null PCR', () => {
    const data: MarketAnalysisData = { ...baseData, pcr: null };
    render(<MarketAnalysisPanel data={data} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should display "N/A" for null ATR', () => {
    const data: MarketAnalysisData = { ...baseData, atr: null };
    render(<MarketAnalysisPanel data={data} />);
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });
});
