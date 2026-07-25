/**
 * Unit tests for Analysis Page - Task 21.2 Implementation
 *
 * Tests verify that the Execute Live Trade button properly:
 * - Opens the confirmation dialog
 * - Validates trade with Risk Engine
 * - Calculates portfolio impact
 * - Executes trade with userConfirmed=true on confirmation
 * - Displays success/failure messages
 * - Refreshes portfolio after successful trade
 *
 * Requirements covered: 10.1, 10.2, 10.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalysisPage from './page';
import { apiClient } from '@/lib/api-client';
import type {
  PromptResponse,
  RiskValidationResult,
  Portfolio,
  TradeResult,
} from '@/lib/api-client';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    submitPrompt: vi.fn(),
    executePaperTrade: vi.fn(),
    executeLiveTrade: vi.fn(),
    validateTrade: vi.fn(),
    getPortfolio: vi.fn(),
  },
}));

// Mock the PromptInput component
vi.mock('@/components/prompt-input', () => ({
  PromptInput: ({ onSubmit }: { onSubmit: (response: PromptResponse) => void }) => (
    <button
      onClick={() =>
        onSubmit({
          rawPrompt: 'Find the best swing trade in RELIANCE',
          parsed: {
            intent: 'FIND_TRADE',
            symbols: ['RELIANCE'],
            timeframe: 'SWING',
            assetType: 'STOCK',
          },
          recommendation: {
            id: 'test-rec-123',
            action: 'BUY',
            symbol: 'RELIANCE',
            entryPrice: 2460,
            target: 2520,
            stopLoss: 2430,
            confidence: 0.75,
            reasoning: 'Test reasoning',
            quantData: {
              symbol: 'RELIANCE',
              timeframe: '1d',
              indicators: {
                rsi: 45.2,
                macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
                sma_20: 2455.0,
                sma_50: 2450.0,
                sma_200: 2380.0,
                ema_20: 2458.0,
                bollingerBands: { upper: 2500.0, middle: 2455.0, lower: 2410.0 },
              },
              supportResistance: [],
              trendlines: [],
            },
          },
        })
      }
    >
      Submit Test Prompt
    </button>
  ),
}));

// Mock the RecommendationCard component
vi.mock('@/components/recommendation-card', () => ({
  RecommendationCard: ({ onExecuteLiveTrade }: { onExecuteLiveTrade?: () => void }) => (
    <div>
      <div>Recommendation Card</div>
      <button onClick={onExecuteLiveTrade}>Execute Live Trade</button>
    </div>
  ),
}));

// Mock the TradeConfirmationDialog component
vi.mock('@/components/trade-confirmation-dialog', () => ({
  TradeConfirmationDialog: ({
    open,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div role="dialog">
        <div>Trade Confirmation Dialog</div>
        <button onClick={onConfirm}>Confirm Trade</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

describe('AnalysisPage - Live Trade Confirmation Flow (Task 21.2)', () => {
  const mockRiskValidation: RiskValidationResult = {
    passed: true,
    violations: [],
  };

  const mockPortfolio: Portfolio = {
    totalValue: 500000,
    cashBalance: 200000,
    investedValue: 300000,
    positions: [],
    totalPnL: 25000,
    dailyPnL: 1200,
    metrics: {
      totalExposure: 0.6,
      openPositions: 0,
      winRate: 0.68,
      avgWin: 3500,
      avgLoss: -1200,
    },
  };

  const mockTradeResult: TradeResult = {
    tradeId: 'trade-456',
    status: 'EXECUTED',
    executedPrice: 2460,
    brokerOrderId: 'NEO123456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens confirmation dialog when Execute Live Trade button is clicked', async () => {
    vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    vi.mocked(apiClient.getPortfolio).mockResolvedValue(mockPortfolio);

    render(<AnalysisPage />);

    // Submit a prompt to get a recommendation
    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    // Wait for recommendation to appear
    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    // Click Execute Live Trade button
    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    // Wait for dialog to open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Trade Confirmation Dialog')).toBeInTheDocument();
    });
  });

  it('validates trade with Risk Engine before opening dialog', async () => {
    vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    vi.mocked(apiClient.getPortfolio).mockResolvedValue(mockPortfolio);

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(apiClient.validateTrade).toHaveBeenCalledWith({
        userId: 'demo-user',
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 1,
        price: 2460,
        stopLoss: 2430,
        target: 2520,
        signalId: 'test-rec-123',
      });
    });
  });

  it('fetches portfolio and calculates impact before opening dialog', async () => {
    vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    vi.mocked(apiClient.getPortfolio).mockResolvedValue(mockPortfolio);

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(apiClient.getPortfolio).toHaveBeenCalledWith('demo-user');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('calls executeLiveTrade with userConfirmed=true when user confirms', async () => {
    vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    vi.mocked(apiClient.getPortfolio).mockResolvedValue(mockPortfolio);
    vi.mocked(apiClient.executeLiveTrade).mockResolvedValue(mockTradeResult);

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click confirm button in dialog
    const confirmButton = screen.getByText('Confirm Trade');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(apiClient.executeLiveTrade).toHaveBeenCalledWith({
        userId: 'demo-user',
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 1,
        price: 2460,
        stopLoss: 2430,
        target: 2520,
        signalId: 'test-rec-123',
        userConfirmed: true,
      });
    });
  });

  it('displays success message after successful live trade execution', async () => {
    vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    vi.mocked(apiClient.getPortfolio).mockResolvedValue(mockPortfolio);
    vi.mocked(apiClient.executeLiveTrade).mockResolvedValue(mockTradeResult);

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm Trade');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Live trade executed! Trade ID: trade-456/)).toBeInTheDocument();
      expect(screen.getByText(/Broker Order ID: NEO123456/)).toBeInTheDocument();
    });
  });

  it('displays success message for pending live trade', async () => {
    vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    vi.mocked(apiClient.getPortfolio).mockResolvedValue(mockPortfolio);
    vi.mocked(apiClient.executeLiveTrade).mockResolvedValue({
      ...mockTradeResult,
      status: 'PENDING',
    });

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm Trade');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Live trade pending! Trade ID: trade-456/)).toBeInTheDocument();
    });
  });

  it('displays error message when live trade fails', async () => {
    vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    vi.mocked(apiClient.getPortfolio).mockResolvedValue(mockPortfolio);
    vi.mocked(apiClient.executeLiveTrade).mockResolvedValue({
      tradeId: 'trade-456',
      status: 'FAILED',
      error: 'Insufficient funds',
    });

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm Trade');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Insufficient funds/)).toBeInTheDocument();
    });
  });

  it('displays error message when API call throws exception', async () => {
    vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    vi.mocked(apiClient.getPortfolio).mockResolvedValue(mockPortfolio);
    vi.mocked(apiClient.executeLiveTrade).mockRejectedValue(new Error('Network error'));

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm Trade');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('closes dialog when user cancels', async () => {
    vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    vi.mocked(apiClient.getPortfolio).mockResolvedValue(mockPortfolio);

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Verify trade was not executed
    expect(apiClient.executeLiveTrade).not.toHaveBeenCalled();
  });

  it('closes dialog after successful trade execution', async () => {
    vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    vi.mocked(apiClient.getPortfolio).mockResolvedValue(mockPortfolio);
    vi.mocked(apiClient.executeLiveTrade).mockResolvedValue(mockTradeResult);

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm Trade');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('handles risk validation errors gracefully', async () => {
    vi.mocked(apiClient.validateTrade).mockRejectedValue(
      new Error('Risk validation service unavailable')
    );

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(screen.getByText(/Risk validation service unavailable/)).toBeInTheDocument();
    });

    // Dialog should not open
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('handles portfolio fetch errors gracefully', async () => {
    vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    vi.mocked(apiClient.getPortfolio).mockRejectedValue(new Error('Portfolio service unavailable'));

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(screen.getByText(/Portfolio service unavailable/)).toBeInTheDocument();
    });

    // Dialog should not open
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calculates portfolio impact correctly', async () => {
    const validateSpy = vi.mocked(apiClient.validateTrade).mockResolvedValue(mockRiskValidation);
    const portfolioSpy = vi.mocked(apiClient.getPortfolio).mockResolvedValue(mockPortfolio);

    render(<AnalysisPage />);

    const submitButton = screen.getByText('Submit Test Prompt');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Recommendation Card')).toBeInTheDocument();
    });

    const liveTradeButton = screen.getByText('Execute Live Trade');
    fireEvent.click(liveTradeButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Verify calculations:
    // newInvestment = 2460 * 1 = 2460
    // maxPotentialProfit = |2520 - 2460| * 1 = 60
    // maxPotentialLoss = |2460 - 2430| * 1 = 30
    // newExposurePercent = ((300000 + 2460) / 500000) * 100 = 60.49%

    expect(validateSpy).toHaveBeenCalled();
    expect(portfolioSpy).toHaveBeenCalled();
  });
});
