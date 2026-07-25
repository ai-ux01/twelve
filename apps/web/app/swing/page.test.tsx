import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SwingScannerPage from './page';

// Mock fetch
global.fetch = jest.fn();

describe('Swing Scanner Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the swing scanner page', () => {
    render(<SwingScannerPage />);
    
    expect(screen.getByText('Swing Trading Scanner')).toBeInTheDocument();
    expect(screen.getByText('Scan the stock universe for high-quality swing trading opportunities')).toBeInTheDocument();
    expect(screen.getByText('Scan Universe')).toBeInTheDocument();
  });

  it('displays scan configuration inputs', () => {
    render(<SwingScannerPage />);
    
    const minScoreInput = screen.getByLabelText('Minimum Score');
    const maxResultsInput = screen.getByLabelText('Max Results');
    
    expect(minScoreInput).toBeInTheDocument();
    expect(maxResultsInput).toBeInTheDocument();
    expect(minScoreInput).toHaveValue(60);
    expect(maxResultsInput).toHaveValue(20);
  });

  it('performs a scan and displays results', async () => {
    const mockScanResponse = {
      scannedCount: 50,
      candidatesFound: 3,
      candidates: [
        {
          symbol: 'RELIANCE',
          score: 75.5,
          trend: 'STRONG_UPTREND',
          setupType: 'BREAKOUT',
          entry: 2450.00,
          stopLoss: 2400.00,
          target: 2550.00,
          riskReward: 2.0,
          components: {
            trendScore: 80,
            technicalScore: 75,
            volumeScore: 70,
            relativeStrengthScore: 65,
            breakoutScore: 85,
            sectorScore: 60,
            riskRewardScore: 75,
          },
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockScanResponse,
    });

    render(<SwingScannerPage />);
    
    const scanButton = screen.getByText('Scan Universe');
    fireEvent.click(scanButton);

    // Should show loading state
    expect(screen.getByText('Scanning...')).toBeInTheDocument();

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Scan Results')).toBeInTheDocument();
    });

    expect(screen.getByText(/Scanned 50 stocks, found 3 candidates/)).toBeInTheDocument();
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('STRONG_UPTREND')).toBeInTheDocument();
    expect(screen.getByText('BREAKOUT')).toBeInTheDocument();
  });

  it('executes a paper trade when BUY ON PAPER is clicked', async () => {
    const mockScanResponse = {
      scannedCount: 50,
      candidatesFound: 1,
      candidates: [
        {
          symbol: 'TCS',
          score: 72.3,
          trend: 'UPTREND',
          setupType: 'EMA20_BOUNCE',
          entry: 3500.00,
          stopLoss: 3450.00,
          target: 3600.00,
          riskReward: 2.0,
          components: {
            trendScore: 70,
            technicalScore: 72,
            volumeScore: 68,
            relativeStrengthScore: 75,
            breakoutScore: 60,
            sectorScore: 65,
            riskRewardScore: 75,
          },
        },
      ],
    };

    const mockTradeResponse = {
      success: true,
      tradeId: 'trade-123',
      message: 'Paper trade executed successfully for TCS',
      trade: {
        symbol: 'TCS',
        quantity: 10,
        entryPrice: 3503.50,
        stopLoss: 3450.00,
        target: 3600.00,
        status: 'OPEN',
        simulatedSlippage: 3.50,
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockScanResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTradeResponse,
      });

    render(<SwingScannerPage />);
    
    // Perform scan first
    const scanButton = screen.getByText('Scan Universe');
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(screen.getByText('TCS')).toBeInTheDocument();
    });

    // Click BUY ON PAPER button
    const buyButton = screen.getByText('BUY ON PAPER');
    fireEvent.click(buyButton);

    // Should show executing state
    await waitFor(() => {
      expect(screen.getByText('Executing...')).toBeInTheDocument();
    });

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText('Paper trade executed successfully for TCS')).toBeInTheDocument();
    });
  });

  it('displays error message when scan fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    render(<SwingScannerPage />);
    
    const scanButton = screen.getByText('Scan Universe');
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(screen.getByText(/Scan failed/)).toBeInTheDocument();
    });
  });

  it('displays error message when paper trade fails', async () => {
    const mockScanResponse = {
      scannedCount: 1,
      candidatesFound: 1,
      candidates: [
        {
          symbol: 'INFY',
          score: 65.0,
          trend: 'UPTREND',
          setupType: 'TREND_CONTINUATION',
          entry: 1450.00,
          stopLoss: 1420.00,
          target: 1500.00,
          riskReward: 1.67,
          components: {
            trendScore: 65,
            technicalScore: 68,
            volumeScore: 60,
            relativeStrengthScore: 70,
            breakoutScore: 55,
            sectorScore: 62,
            riskRewardScore: 70,
          },
        },
      ],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockScanResponse,
      })
      .mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

    render(<SwingScannerPage />);
    
    // Perform scan
    const scanButton = screen.getByText('Scan Universe');
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(screen.getByText('INFY')).toBeInTheDocument();
    });

    // Try to execute paper trade
    const buyButton = screen.getByText('BUY ON PAPER');
    fireEvent.click(buyButton);

    await waitFor(() => {
      expect(screen.getByText(/Paper trade failed/)).toBeInTheDocument();
    });
  });

  it('allows changing scan parameters', () => {
    render(<SwingScannerPage />);
    
    const minScoreInput = screen.getByLabelText('Minimum Score') as HTMLInputElement;
    const maxResultsInput = screen.getByLabelText('Max Results') as HTMLInputElement;
    
    fireEvent.change(minScoreInput, { target: { value: '70' } });
    fireEvent.change(maxResultsInput, { target: { value: '10' } });
    
    expect(minScoreInput.value).toBe('70');
    expect(maxResultsInput.value).toBe('10');
  });
});
