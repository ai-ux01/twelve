import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreCard } from './score-card';
import { ScoreResult } from '@/lib/api-client';

describe('ScoreCard', () => {
  const mockScore: ScoreResult = {
    trend: 'BULLISH',
    rsi: 65.5,
    adx: 35.2,
    vwap: 2450.75,
    volumeRatio: 1.35,
    score: 75,
    signals: [
      'RSI indicates bullish momentum',
      'ADX shows strong trend strength',
      'Price trading above VWAP',
      'Volume above average'
    ]
  };

  it('should render score value correctly', () => {
    render(<ScoreCard score={mockScore} />);
    
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('Market Score')).toBeInTheDocument();
  });

  it('should render trend badge correctly', () => {
    render(<ScoreCard score={mockScore} />);
    
    expect(screen.getByText('BULLISH')).toBeInTheDocument();
  });

  it('should render key metrics', () => {
    render(<ScoreCard score={mockScore} />);
    
    expect(screen.getByText('65.5')).toBeInTheDocument(); // RSI
    expect(screen.getByText('35.2')).toBeInTheDocument(); // ADX
    expect(screen.getByText('₹2450.75')).toBeInTheDocument(); // VWAP
    expect(screen.getByText('1.35x')).toBeInTheDocument(); // Volume Ratio
  });

  it('should render all signals', () => {
    render(<ScoreCard score={mockScore} />);
    
    expect(screen.getByText('RSI indicates bullish momentum')).toBeInTheDocument();
    expect(screen.getByText('ADX shows strong trend strength')).toBeInTheDocument();
    expect(screen.getByText('Price trading above VWAP')).toBeInTheDocument();
    expect(screen.getByText('Volume above average')).toBeInTheDocument();
  });

  it('should render BEARISH trend correctly', () => {
    const bearishScore: ScoreResult = {
      ...mockScore,
      trend: 'BEARISH',
      score: 25
    };
    
    render(<ScoreCard score={bearishScore} />);
    
    expect(screen.getByText('BEARISH')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('should render NEUTRAL trend correctly', () => {
    const neutralScore: ScoreResult = {
      ...mockScore,
      trend: 'NEUTRAL',
      score: 50
    };
    
    render(<ScoreCard score={neutralScore} />);
    
    expect(screen.getByText('NEUTRAL')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should apply custom className if provided', () => {
    const { container } = render(<ScoreCard score={mockScore} className="custom-class" />);
    
    const card = container.firstChild;
    expect(card).toHaveClass('custom-class');
  });

  it('should handle empty signals array', () => {
    const scoreWithNoSignals: ScoreResult = {
      ...mockScore,
      signals: []
    };
    
    render(<ScoreCard score={scoreWithNoSignals} />);
    
    expect(screen.getByText('No signals available')).toBeInTheDocument();
  });
});
