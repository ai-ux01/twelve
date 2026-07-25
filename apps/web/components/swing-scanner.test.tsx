import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SwingScanner, SwingCandidate, ScanResponse } from './swing-scanner';

/**
 * Unit tests for SwingScanner component
 * Requirements: 5.1, 5.4
 */

describe('SwingScanner', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should render scan configuration inputs', () => {
    render(<SwingScanner />);

    expect(screen.getByLabelText(/minimum score/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max results/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan universe/i })).toBeInTheDocument();
  });

  it('should display initial values for min score and max results', () => {
    render(<SwingScanner initialMinScore={70} initialMaxResults={15} />);

    const minScoreInput = screen.getByLabelText(/minimum score/i) as HTMLInputElement;
    const maxResultsInput = screen.getByLabelText(/max results/i) as HTMLInputElement;

    expect(minScoreInput.value).toBe('70');
    expect(maxResultsInput.value).toBe('15');
  });

  it('should update min score when input changes', () => {
    render(<SwingScanner />);

    const minScoreInput = screen.getByLabelText(/minimum score/i) as HTMLInputElement;
    fireEvent.change(minScoreInput, { target: { value: '75' } });

    expect(minScoreInput.value).toBe('75');
  });

  it('should update max results when input changes', () => {
    render(<SwingScanner />);

    const maxResultsInput = screen.getByLabelText(/max results/i) as HTMLInputElement;
    fireEvent.change(maxResultsInput, { target: { value: '25' } });

    expect(maxResultsInput.value).toBe('25');
  });

  it('should show loading state during scan', async () => {
    global.fetch = vi.fn(() =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({
              scannedCount: 0,
              candidatesFound: 0,
              candidates: [],
            }),
          } as Response);
        }, 100);
      })
    );

    render(<SwingScanner />);

    const scanButton = screen.getByRole('button', { name: /scan universe/i });
    fireEvent.click(scanButton);

    // Should show loading state
    expect(screen.getByText(/scanning\.\.\./i)).toBeInTheDocument();

    // Wait for scan to complete
    await waitFor(() => {
      expect(screen.queryByText(/scanning\.\.\./i)).not.toBeInTheDocument();
    });
  });

  it('should call API with correct parameters when scan is triggered', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          scannedCount: 10,
          candidatesFound: 2,
          candidates: [],
        }),
      } as Response)
    );
    global.fetch = mockFetch;

    render(<SwingScanner userId="test-user" initialMinScore={65} initialMaxResults={30} />);

    const scanButton = screen.getByRole('button', { name: /scan universe/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/swing/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          minScore: 65,
          maxResults: 30,
          userId: 'test-user',
        }),
      });
    });
  });

  it('should display scan results in table', async () => {
    const mockResults: ScanResponse = {
      scannedCount: 50,
      candidatesFound: 2,
      candidates: [
        {
          symbol: 'RELIANCE',
          score: 85.5,
          trend: 'UPTREND',
          setupType: 'Breakout',
          entry: 2450.0,
          stopLoss: 2400.0,
          target: 2550.0,
          riskReward: 2.0,
          components: {
            trendScore: 90,
            technicalScore: 85,
            volumeScore: 80,
            relativeStrengthScore: 85,
            breakoutScore: 90,
            sectorScore: 75,
            riskRewardScore: 80,
          },
        },
        {
          symbol: 'TCS',
          score: 72.3,
          trend: 'SIDEWAYS',
          setupType: 'Support Bounce',
          entry: 3500.0,
          stopLoss: 3450.0,
          target: 3600.0,
          riskReward: 2.0,
          components: {
            trendScore: 70,
            technicalScore: 75,
            volumeScore: 68,
            relativeStrengthScore: 72,
            breakoutScore: 65,
            sectorScore: 78,
            riskRewardScore: 80,
          },
        },
      ],
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockResults,
      } as Response)
    );

    render(<SwingScanner />);

    const scanButton = screen.getByRole('button', { name: /scan universe/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText('TCS')).toBeInTheDocument();
    });

    expect(screen.getByText('85.5')).toBeInTheDocument();
    expect(screen.getByText('72.3')).toBeInTheDocument();
    expect(screen.getByText('Breakout')).toBeInTheDocument();
    expect(screen.getByText('Support Bounce')).toBeInTheDocument();
  });

  it('should display "No candidates found" when scan returns empty results', async () => {
    const mockResults: ScanResponse = {
      scannedCount: 50,
      candidatesFound: 0,
      candidates: [],
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockResults,
      } as Response)
    );

    render(<SwingScanner />);

    const scanButton = screen.getByRole('button', { name: /scan universe/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(screen.getByText(/no candidates found matching the criteria/i)).toBeInTheDocument();
    });
  });

  it('should display error message when scan fails', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        statusText: 'Internal Server Error',
      } as Response)
    );

    render(<SwingScanner />);

    const scanButton = screen.getByRole('button', { name: /scan universe/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(screen.getByText(/scan failed: internal server error/i)).toBeInTheDocument();
    });
  });

  it('should call onScanComplete callback when scan succeeds', async () => {
    const mockResults: ScanResponse = {
      scannedCount: 50,
      candidatesFound: 1,
      candidates: [
        {
          symbol: 'RELIANCE',
          score: 85.5,
          trend: 'UPTREND',
          setupType: 'Breakout',
          entry: 2450.0,
          stopLoss: 2400.0,
          target: 2550.0,
          riskReward: 2.0,
          components: {
            trendScore: 90,
            technicalScore: 85,
            volumeScore: 80,
            relativeStrengthScore: 85,
            breakoutScore: 90,
            sectorScore: 75,
            riskRewardScore: 80,
          },
        },
      ],
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockResults,
      } as Response)
    );

    const onScanComplete = vi.fn();
    render(<SwingScanner onScanComplete={onScanComplete} />);

    const scanButton = screen.getByRole('button', { name: /scan universe/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(onScanComplete).toHaveBeenCalledWith(mockResults);
    });
  });

  it('should call onCandidateSelect when a row is clicked', async () => {
    const candidate: SwingCandidate = {
      symbol: 'RELIANCE',
      score: 85.5,
      trend: 'UPTREND',
      setupType: 'Breakout',
      entry: 2450.0,
      stopLoss: 2400.0,
      target: 2550.0,
      riskReward: 2.0,
      components: {
        trendScore: 90,
        technicalScore: 85,
        volumeScore: 80,
        relativeStrengthScore: 85,
        breakoutScore: 90,
        sectorScore: 75,
        riskRewardScore: 80,
      },
    };

    const mockResults: ScanResponse = {
      scannedCount: 50,
      candidatesFound: 1,
      candidates: [candidate],
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResults),
      } as Response)
    );

    const onCandidateSelect = vi.fn();
    render(<SwingScanner onCandidateSelect={onCandidateSelect} />);

    const scanButton = screen.getByRole('button', { name: /scan universe/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    }, { timeout: 3000 });

    const row = screen.getByText('RELIANCE').closest('tr');
    if (row) {
      fireEvent.click(row);
    }

    expect(onCandidateSelect).toHaveBeenCalledWith(candidate);
  });

  it('should execute paper trade when BUY ON PAPER button is clicked', async () => {
    const candidate: SwingCandidate = {
      symbol: 'RELIANCE',
      score: 85.5,
      trend: 'UPTREND',
      setupType: 'Breakout',
      entry: 2450.0,
      stopLoss: 2400.0,
      target: 2550.0,
      riskReward: 2.0,
      components: {
        trendScore: 90,
        technicalScore: 85,
        volumeScore: 80,
        relativeStrengthScore: 85,
        breakoutScore: 90,
        sectorScore: 75,
        riskRewardScore: 80,
      },
    };

    const mockScanResults: ScanResponse = {
      scannedCount: 50,
      candidatesFound: 1,
      candidates: [candidate],
    };

    const mockTradeResponse = {
      success: true,
      tradeId: 'trade-123',
      message: 'Paper trade executed successfully',
      trade: {
        symbol: 'RELIANCE',
        quantity: 10,
        entryPrice: 2450.0,
        stopLoss: 2400.0,
        target: 2550.0,
        status: 'EXECUTED',
        simulatedSlippage: 0.5,
      },
    };

    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        // First call is scan
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockScanResults),
        } as Response);
      } else {
        // Second call is paper trade
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTradeResponse),
        } as Response);
      }
    });

    render(<SwingScanner userId="test-user" />);

    // First trigger scan
    const scanButton = screen.getByRole('button', { name: /scan universe/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click BUY ON PAPER button
    const buyButton = screen.getByRole('button', { name: /buy on paper/i });
    fireEvent.click(buyButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:4000/swing/paper-trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'test-user',
          symbol: 'RELIANCE',
          quantity: 10,
          entryPrice: 2450.0,
          stopLoss: 2400.0,
          target: 2550.0,
        }),
      });
    });

    // Should display success message
    await waitFor(() => {
      expect(screen.getByText(/paper trade executed successfully/i)).toBeInTheDocument();
    });
  });

  it('should display error when paper trade fails', async () => {
    const candidate: SwingCandidate = {
      symbol: 'RELIANCE',
      score: 85.5,
      trend: 'UPTREND',
      setupType: 'Breakout',
      entry: 2450.0,
      stopLoss: 2400.0,
      target: 2550.0,
      riskReward: 2.0,
      components: {
        trendScore: 90,
        technicalScore: 85,
        volumeScore: 80,
        relativeStrengthScore: 85,
        breakoutScore: 90,
        sectorScore: 75,
        riskRewardScore: 80,
      },
    };

    const mockScanResults: ScanResponse = {
      scannedCount: 50,
      candidatesFound: 1,
      candidates: [candidate],
    };

    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        // First call is scan
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockScanResults),
        } as Response);
      } else {
        // Second call is paper trade - fails
        return Promise.resolve({
          ok: false,
          statusText: 'Bad Request',
        } as Response);
      }
    });

    render(<SwingScanner />);

    // First trigger scan
    const scanButton = screen.getByRole('button', { name: /scan universe/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click BUY ON PAPER button
    const buyButton = screen.getByRole('button', { name: /buy on paper/i });
    fireEvent.click(buyButton);

    // Should display error message
    await waitFor(() => {
      expect(screen.getByText(/paper trade failed: bad request/i)).toBeInTheDocument();
    });
  });

  it('should disable inputs during scan', async () => {
    global.fetch = vi.fn(() =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({
              scannedCount: 0,
              candidatesFound: 0,
              candidates: [],
            }),
          } as Response);
        }, 100);
      })
    );

    render(<SwingScanner />);

    const scanButton = screen.getByRole('button', { name: /scan universe/i });
    const minScoreInput = screen.getByLabelText(/minimum score/i) as HTMLInputElement;
    const maxResultsInput = screen.getByLabelText(/max results/i) as HTMLInputElement;

    fireEvent.click(scanButton);

    // Should disable inputs during scan
    expect(minScoreInput).toBeDisabled();
    expect(maxResultsInput).toBeDisabled();

    // Wait for scan to complete
    await waitFor(() => {
      expect(minScoreInput).not.toBeDisabled();
      expect(maxResultsInput).not.toBeDisabled();
    });
  });

  it('should use custom API base URL when provided', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          scannedCount: 0,
          candidatesFound: 0,
          candidates: [],
        }),
      } as Response)
    );
    global.fetch = mockFetch;

    render(<SwingScanner apiBaseUrl="http://custom-api:5000" />);

    const scanButton = screen.getByRole('button', { name: /scan universe/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom-api:5000/swing/scan',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});
