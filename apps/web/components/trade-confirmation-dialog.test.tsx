import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TradeConfirmationDialog, PortfolioImpact } from './trade-confirmation-dialog';
import type { Recommendation, RiskValidationResult } from '@/lib/api-client';

// Mock the UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-testid={`button-${children}`}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-variant={variant} data-testid="badge">
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

describe('TradeConfirmationDialog', () => {
  const mockRecommendation: Recommendation = {
    id: 'rec-123',
    action: 'BUY',
    symbol: 'RELIANCE',
    entryPrice: 2460,
    target: 2520,
    stopLoss: 2430,
    confidence: 0.75,
    reasoning: 'Strong uptrend with bullish indicators',
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
      supportResistance: [
        { level: 2400, strength: 0.85 },
        { level: 2500, strength: 0.72 },
      ],
      trendlines: [{ slope: 2.5, intercept: 2350, rSquared: 0.89 }],
    },
  };

  const mockRiskValidationPassed: RiskValidationResult = {
    passed: true,
    violations: [],
  };

  const mockRiskValidationFailed: RiskValidationResult = {
    passed: false,
    violations: [
      {
        rule: 'MAX_POSITION_SIZE',
        message: 'Position size exceeds maximum allowed',
        severity: 'ERROR',
      },
    ],
  };

  const mockRiskValidationWarning: RiskValidationResult = {
    passed: true,
    violations: [
      {
        rule: 'HIGH_EXPOSURE',
        message: 'Portfolio exposure is approaching limit',
        severity: 'WARNING',
      },
    ],
  };

  const mockPortfolioImpact: PortfolioImpact = {
    currentValue: 500000,
    newInvestment: 24600,
    newTotalValue: 524600,
    newExposurePercent: 60.5,
    maxPotentialLoss: 300,
    maxPotentialProfit: 600,
    existingPositions: 3,
  };

  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Display', () => {
    it('should not render when open is false', () => {
      render(
        <TradeConfirmationDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should render when open is true', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Confirm Live Trade');
    });

    it('should not render when recommendation is null', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={null}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Trade Details Display', () => {
    it('should display correct symbol and action', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText('BUY')).toBeInTheDocument();
    });

    it('should display correct quantity and trade value', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Trade Value')).toBeInTheDocument();
      // Trade value = 2460 * 10 = 24600 - appears twice (trade details + portfolio impact)
      const tradeValues = screen.getAllByText(/₹24,600/);
      expect(tradeValues.length).toBeGreaterThan(0);
    });

    it('should display entry price, target, and stop loss', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Entry Price')).toBeInTheDocument();
      expect(screen.getByText('₹2460.00')).toBeInTheDocument();
      expect(screen.getByText('Target')).toBeInTheDocument();
      expect(screen.getByText('₹2520.00')).toBeInTheDocument();
      expect(screen.getByText('Stop Loss')).toBeInTheDocument();
      expect(screen.getByText('₹2430.00')).toBeInTheDocument();
    });

    it('should display confidence percentage', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should calculate and display potential profit and loss', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Potential profit = (2520 - 2460) * 10 = 600 - appears twice (trade details + portfolio impact)
      const profitElements = screen.getAllByText(/\+₹600/);
      expect(profitElements.length).toBeGreaterThan(0);
      // Potential loss = (2460 - 2430) * 10 = 300 - appears twice (trade details + portfolio impact)
      const lossElements = screen.getAllByText(/-₹300/);
      expect(lossElements.length).toBeGreaterThan(0);
    });

    it('should calculate and display risk-reward ratio', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Risk-reward = (2520 - 2460) / (2460 - 2430) = 60 / 30 = 2.00
      expect(screen.getByText('1:2.00')).toBeInTheDocument();
    });
  });

  describe('Risk Validation Display', () => {
    it('should show passed validation with no violations', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Risk validation passed')).toBeInTheDocument();
      expect(screen.getByText('All risk checks passed successfully')).toBeInTheDocument();
    });

    it('should show failed validation with error violations', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationFailed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Risk validation failed')).toBeInTheDocument();
      expect(
        screen.getByText('Trade violates risk rules and cannot be executed')
      ).toBeInTheDocument();
      expect(screen.getByText('MAX POSITION SIZE')).toBeInTheDocument();
      expect(screen.getByText('Position size exceeds maximum allowed')).toBeInTheDocument();
    });

    it('should show warnings when violations have WARNING severity', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationWarning}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Risk warnings present')).toBeInTheDocument();
      expect(screen.getByText('Review warnings before proceeding')).toBeInTheDocument();
      expect(screen.getByText('HIGH EXPOSURE')).toBeInTheDocument();
      expect(screen.getByText('Portfolio exposure is approaching limit')).toBeInTheDocument();
    });

    it('should show pending state when risk validation is null', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={null}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Risk validation pending...')).toBeInTheDocument();
    });
  });

  describe('Portfolio Impact Display', () => {
    it('should display portfolio impact when provided', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Portfolio Impact')).toBeInTheDocument();
      expect(screen.getByText(/₹5,00,000/)).toBeInTheDocument(); // Current value
      // New investment appears twice (trade value + portfolio impact)
      const investmentElements = screen.getAllByText(/₹24,600/);
      expect(investmentElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/₹5,24,600/)).toBeInTheDocument(); // New total
      expect(screen.getByText('60.5%')).toBeInTheDocument(); // Exposure
    });

    it('should not display portfolio impact section when null', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={null}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText('Portfolio Impact')).not.toBeInTheDocument();
    });

    it('should display existing positions count', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(
        screen.getByText(/You have 3 existing positions in your portfolio/)
      ).toBeInTheDocument();
    });
  });

  describe('User Interaction', () => {
    it('should call onCancel and onOpenChange when Cancel button is clicked', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByTestId('button-Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should call onConfirm when Confirm button is clicked and validation passed', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByTestId('button-Confirm Trade');
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('should disable Confirm button when risk validation failed', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationFailed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByTestId('button-Confirm Trade');
      expect(confirmButton).toBeDisabled();
    });

    it('should disable Confirm button when risk validation is null', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={null}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByTestId('button-Confirm Trade');
      expect(confirmButton).toBeDisabled();
    });

    it('should disable both buttons when isLoading is true', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          isLoading={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByTestId('button-Executing...');
      const cancelButton = screen.getByTestId('button-Cancel');

      expect(confirmButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    it('should not call onConfirm when button is clicked while loading', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          isLoading={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByTestId('button-Executing...');
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('SELL Action Display', () => {
    const sellRecommendation: Recommendation = {
      ...mockRecommendation,
      action: 'SELL',
      entryPrice: 2460,
      target: 2400,
      stopLoss: 2490,
    };

    it('should display SELL action correctly', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={sellRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('SELL')).toBeInTheDocument();
    });

    it('should calculate SELL trade values correctly', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={sellRecommendation}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // For SELL: profit = (entry - target) * qty = (2460 - 2400) * 10 = 600
      const profitElements = screen.getAllByText(/\+₹600/);
      expect(profitElements.length).toBeGreaterThan(0);
      // For SELL: loss = (stopLoss - entry) * qty = (2490 - 2460) * 10 = 300
      const lossElements = screen.getAllByText(/-₹300/);
      expect(lossElements.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large quantity values', () => {
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={1000}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('1000')).toBeInTheDocument();
      // Trade value = 2460 * 1000 = 2,460,000
      expect(screen.getByText(/₹24,60,000/)).toBeInTheDocument();
    });

    it('should handle zero confidence', () => {
      const zeroConfidenceRec = { ...mockRecommendation, confidence: 0 };
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={zeroConfidenceRec}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle 100% confidence', () => {
      const highConfidenceRec = { ...mockRecommendation, confidence: 1.0 };
      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={highConfidenceRec}
          quantity={10}
          riskValidation={mockRiskValidationPassed}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle multiple risk violations', () => {
      const multipleViolations: RiskValidationResult = {
        passed: false,
        violations: [
          { rule: 'MAX_POSITION_SIZE', message: 'Position too large', severity: 'ERROR' },
          { rule: 'STOP_LOSS_PLACEMENT', message: 'Stop loss too tight', severity: 'WARNING' },
          { rule: 'MAX_EXPOSURE', message: 'Portfolio exposure exceeded', severity: 'ERROR' },
        ],
      };

      render(
        <TradeConfirmationDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          recommendation={mockRecommendation}
          quantity={10}
          riskValidation={multipleViolations}
          portfolioImpact={mockPortfolioImpact}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('MAX POSITION SIZE')).toBeInTheDocument();
      expect(screen.getByText('STOP LOSS PLACEMENT')).toBeInTheDocument();
      expect(screen.getByText('MAX EXPOSURE')).toBeInTheDocument();
    });
  });
});
