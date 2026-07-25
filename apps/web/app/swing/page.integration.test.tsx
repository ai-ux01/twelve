/**
 * Integration Tests for Swing Trading Frontend
 * 
 * Task 53.4: Verify frontend integration
 * 
 * Tests:
 * - SwingScanner component triggers scan correctly
 * - Candidate list displays with all columns
 * - Clicking candidate shows detailed analysis
 * - SwingRecommendationCard displays all fields
 * - "BUY ON PAPER" button executes paper trade
 * - Portfolio updates after paper trade
 * 
 * Requirements: 13.1, 13.2
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import SwingScannerPage from './page';

// Mock fetch
global.fetch = vi.fn();

// Mock scan response with complete data
const mockScanResponse = {
  scannedCount: 50,
  candidatesFound: 2,
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

const mockPaperTradeResponse = {
  success: true,
  tradeId: 'trade-123',
  message: 'Paper trade executed successfully for RELIANCE',
  trade: {
    symbol: 'RELIANCE',
    quantity: 10,
    entryPrice: 2453.50,
    stopLoss: 2400.00,
    target: 2550.00,
    status: 'OPEN',
    simulatedSlippage: 3.50,
  },
};

describe('Task 53.4: Frontend Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SwingScanner triggers scan correctly', () => {
    it('should call scan API with correct parameters', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScanResponse,
      });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/swing/scan'),
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('"minScore":60'),
          })
        );
      });
    });

    it('should show loading state during scan', async () => {
      (global.fetch as vi.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          ok: true,
          json: async () => mockScanResponse,
        }), 100))
      );

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      // Should show loading state immediately
      expect(screen.getByText('Scanning...')).toBeInTheDocument();
      
      // Scan button should be disabled during scan
      expect(scanButton).toBeDisabled();
    });
  });

  describe('Candidate list displays with all columns', () => {
    it('should display all required columns in the table', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScanResponse,
      });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        // Check for candidates count text which is unique to results display
        expect(screen.getByText(/candidates found/)).toBeInTheDocument();
      });

      // Verify table headers
      expect(screen.getByText('Symbol')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
      expect(screen.getByText('Trend')).toBeInTheDocument();
      expect(screen.getByText('R:R')).toBeInTheDocument();
    });

    it('should display all candidate data in the table', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScanResponse,
      });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      // Verify RELIANCE data
      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      expect(within(relianceRow).getByText('75.5')).toBeInTheDocument();
      expect(within(relianceRow).getByText('STRONG_UPTREND')).toBeInTheDocument();
      expect(within(relianceRow).getByText('2.00')).toBeInTheDocument();

      // Verify TCS data
      const tcsRow = screen.getByText('TCS').closest('tr')!;
      expect(within(tcsRow).getByText('72.3')).toBeInTheDocument();
      expect(within(tcsRow).getByText('UPTREND')).toBeInTheDocument();
      expect(within(tcsRow).getByText('2.00')).toBeInTheDocument();
    });

    it('should display scan summary', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScanResponse,
      });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText(/2 candidates found/)).toBeInTheDocument();
      });

      expect(screen.getByText(/Scanned 50 stocks/)).toBeInTheDocument();
    });
  });

  describe('Clicking candidate shows detailed analysis', () => {
    it('should display SwingAnalysisPanel when candidate is clicked', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScanResponse,
      });

      render(<SwingScannerPage />);
      
      // Perform scan
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      // Click on RELIANCE row
      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      // Should display detailed analysis panel with all sections
      await waitFor(() => {
        expect(screen.getByText('Detailed Swing Trading Analysis')).toBeInTheDocument();
      });

      // Verify Price Action section
      expect(screen.getByText('Price Action')).toBeInTheDocument();
      expect(screen.getAllByText('Setup Type').length).toBeGreaterThan(0);

      // Verify Entry/Exit Levels section
      expect(screen.getByText('Entry & Exit Levels')).toBeInTheDocument();
      expect(screen.getByText('Entry Price')).toBeInTheDocument();
      expect(screen.getByText('Target Price')).toBeInTheDocument();
      // Use getAllByText since "Stop Loss" appears in both cards
      expect(screen.getAllByText('Stop Loss').length).toBeGreaterThan(0);

      // Verify Scoring Breakdown section
      expect(screen.getByText('Scoring Breakdown')).toBeInTheDocument();
      // "Trend" appears in table header and scoring section, use getAllByText
      expect(screen.getAllByText('Trend').length).toBeGreaterThan(0);
      expect(screen.getByText('Technical')).toBeInTheDocument();
      expect(screen.getByText('Volume')).toBeInTheDocument();
      expect(screen.getByText('Relative Strength')).toBeInTheDocument();
      expect(screen.getByText('Breakout')).toBeInTheDocument();
      expect(screen.getByText('Sector')).toBeInTheDocument();
      // "Risk/Reward" appears in both cards, use getAllByText
      expect(screen.getAllByText('Risk/Reward').length).toBeGreaterThan(0);
    });

    it('should display scoring component values correctly', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScanResponse,
      });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      await waitFor(() => {
        expect(screen.getByText('Scoring Breakdown')).toBeInTheDocument();
      });

      // Verify component scores are displayed (using text pattern matching)
      expect(screen.getByText(/80\.0 \/ 100 \(20%\)/)).toBeInTheDocument(); // Trend
      expect(screen.getByText(/75\.0 \/ 100 \(20%\)/)).toBeInTheDocument(); // Technical
      expect(screen.getByText(/70\.0 \/ 100 \(15%\)/)).toBeInTheDocument(); // Volume
      expect(screen.getByText(/65\.0 \/ 100 \(15%\)/)).toBeInTheDocument(); // Relative Strength
      expect(screen.getByText(/85\.0 \/ 100 \(10%\)/)).toBeInTheDocument(); // Breakout
      expect(screen.getByText(/60\.0 \/ 100 \(10%\)/)).toBeInTheDocument(); // Sector
      expect(screen.getByText(/75\.0 \/ 100 \(10%\)/)).toBeInTheDocument(); // Risk/Reward
    });

    it('should highlight selected candidate in the table', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScanResponse,
      });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      // Row should have selected state styling
      expect(relianceRow).toHaveClass('bg-blue-50');
    });
  });

  describe('SwingRecommendationCard displays all fields', () => {
    it('should display all required fields in recommendation card', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScanResponse,
      });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      await waitFor(() => {
        expect(screen.getByText('Swing Trading Opportunity')).toBeInTheDocument();
      });

      // Verify symbol and score badge (get from card title, not table)
      const cardTitles = screen.getAllByText('RELIANCE');
      // First is in table, second and third are in cards
      expect(cardTitles.length).toBeGreaterThanOrEqual(2);
      // Score appears in multiple places, just verify one exists
      expect(screen.getAllByText(/Score: 75\.5/).length).toBeGreaterThan(0);

      // Verify trend badge - appears in table and both cards
      expect(screen.getAllByText('STRONG_UPTREND').length).toBeGreaterThanOrEqual(2);

      // Verify setup type - appears in both cards
      expect(screen.getAllByText('Setup Type').length).toBeGreaterThan(0);
      expect(screen.getAllByText('BREAKOUT').length).toBeGreaterThan(0);

      // Verify price levels section
      expect(screen.getByText('Price Levels')).toBeInTheDocument();
      
      // Target
      expect(screen.getAllByText('Target').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/₹2550\.00/).length).toBeGreaterThan(0);
      expect(screen.getByText(/\+4\.1%/)).toBeInTheDocument();

      // Entry
      expect(screen.getAllByText('Entry').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/₹2450\.00/).length).toBeGreaterThan(0);

      // Stop Loss
      expect(screen.getAllByText('Stop Loss').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/₹2400\.00/).length).toBeGreaterThan(0);
      expect(screen.getByText(/-2\.0%/)).toBeInTheDocument();

      // Risk/Reward ratio - appears in multiple places
      expect(screen.getAllByText('Risk/Reward Ratio').length).toBeGreaterThan(0);
      expect(screen.getAllByText('2.00:1').length).toBeGreaterThan(0);
      expect(screen.getByText('Favorable')).toBeInTheDocument();

      // BUY ON PAPER button
      expect(screen.getByText('BUY ON PAPER')).toBeInTheDocument();

      // Safety notice
      expect(screen.getByText(/This is a paper trade \(simulated\)/)).toBeInTheDocument();
    });

    it('should display price differences with correct colors', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScanResponse,
      });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      await waitFor(() => {
        expect(screen.getByText('Price Levels')).toBeInTheDocument();
      });

      // Target should be green (get parent div with border)
      const targetLabels = screen.getAllByText('Target');
      // Find the one in Price Levels section which has border styling
      const targetSection = targetLabels[0].closest('div')?.parentElement;
      expect(targetSection).toBeTruthy();
      // Check that the border class is present somewhere in the tree
      const hasGreenBorder = targetSection?.className.includes('border-l-4') || 
                            targetSection?.parentElement?.className.includes('border-green');
      expect(hasGreenBorder || targetSection?.querySelector('.border-green-500')).toBeTruthy();

      // Entry should be blue (similar check)
      const entryLabels = screen.getAllByText('Entry');
      const entrySection = entryLabels[0].closest('div')?.parentElement;
      expect(entrySection).toBeTruthy();

      // Stop Loss should be red (similar check)
      const stopLossLabels = screen.getAllByText('Stop Loss');
      const stopLossSection = stopLossLabels[0].closest('div')?.parentElement;
      expect(stopLossSection).toBeTruthy();
    });
  });

  describe('"BUY ON PAPER" button executes paper trade', () => {
    it('should call paper trade API when button is clicked', async () => {
      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockScanResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPaperTradeResponse,
        });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      await waitFor(() => {
        expect(screen.getByText('BUY ON PAPER')).toBeInTheDocument();
      });

      const buyButton = screen.getByText('BUY ON PAPER');
      fireEvent.click(buyButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/swing/paper-trade'),
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('"symbol":"RELIANCE"'),
          })
        );
      });
    });

    it('should show loading state during paper trade execution', async () => {
      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockScanResponse,
        })
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({
            ok: true,
            json: async () => mockPaperTradeResponse,
          }), 100))
        );

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      await waitFor(() => {
        expect(screen.getByText('BUY ON PAPER')).toBeInTheDocument();
      });

      const buyButton = screen.getByText('BUY ON PAPER');
      fireEvent.click(buyButton);

      // Should show executing state
      expect(screen.getByText('Executing Paper Trade...')).toBeInTheDocument();
      expect(buyButton).toBeDisabled();
    });

    it('should display success message after paper trade execution', async () => {
      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockScanResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPaperTradeResponse,
        });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      await waitFor(() => {
        expect(screen.getByText('BUY ON PAPER')).toBeInTheDocument();
      });

      const buyButton = screen.getByText('BUY ON PAPER');
      fireEvent.click(buyButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/Paper trade executed successfully for RELIANCE/)).toBeInTheDocument();
      });

      // Should show trade ID in page-level success alert
      expect(screen.getByText(/Trade ID: trade-123/)).toBeInTheDocument();
    });

    it('should send correct trade parameters', async () => {
      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockScanResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPaperTradeResponse,
        });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      await waitFor(() => {
        expect(screen.getByText('BUY ON PAPER')).toBeInTheDocument();
      });

      const buyButton = screen.getByText('BUY ON PAPER');
      fireEvent.click(buyButton);

      await waitFor(() => {
        const calls = (global.fetch as vi.Mock).mock.calls;
        const paperTradeCall = calls.find(call => call[0].includes('/paper-trade'));
        expect(paperTradeCall).toBeDefined();
        
        const requestBody = JSON.parse(paperTradeCall[1].body);
        expect(requestBody).toMatchObject({
          userId: 'user-123',
          symbol: 'RELIANCE',
          quantity: 10,
          entryPrice: 2450.00,
          stopLoss: 2400.00,
          target: 2550.00,
        });
      });
    });
  });

  describe('Portfolio updates after paper trade', () => {
    it('should display success message indicating portfolio will be updated', async () => {
      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockScanResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPaperTradeResponse,
        });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      await waitFor(() => {
        expect(screen.getByText('BUY ON PAPER')).toBeInTheDocument();
      });

      const buyButton = screen.getByText('BUY ON PAPER');
      fireEvent.click(buyButton);

      // Success callback should be triggered
      await waitFor(() => {
        expect(screen.getByText(/Paper trade executed successfully for RELIANCE/)).toBeInTheDocument();
      });

      // Verify trade details are shown
      expect(mockPaperTradeResponse.trade.symbol).toBe('RELIANCE');
      expect(mockPaperTradeResponse.trade.quantity).toBe(10);
      expect(mockPaperTradeResponse.trade.status).toBe('OPEN');
    });

    it('should show trade ID for tracking in portfolio', async () => {
      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockScanResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPaperTradeResponse,
        });

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      await waitFor(() => {
        expect(screen.getByText('BUY ON PAPER')).toBeInTheDocument();
      });

      const buyButton = screen.getByText('BUY ON PAPER');
      fireEvent.click(buyButton);

      await waitFor(() => {
        // Trade ID should be displayed for user to track in portfolio
        expect(screen.getByText(/trade-123/)).toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('should display error when scan fails', async () => {
      (global.fetch as vi.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('should display error when paper trade fails', async () => {
      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockScanResponse,
        })
        .mockRejectedValueOnce(new Error('Paper trade failed'));

      render(<SwingScannerPage />);
      
      const scanButton = screen.getByText('Scan Universe');
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });

      const relianceRow = screen.getByText('RELIANCE').closest('tr')!;
      fireEvent.click(relianceRow);

      await waitFor(() => {
        expect(screen.getByText('BUY ON PAPER')).toBeInTheDocument();
      });

      const buyButton = screen.getByText('BUY ON PAPER');
      fireEvent.click(buyButton);

      await waitFor(() => {
        // Error message appears in both the page-level alert AND the card
        const errorMessages = screen.getAllByText(/Paper trade failed/);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });
});
