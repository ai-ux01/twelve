'use client';

import { useState } from 'react';
import { TradeConfirmationDialog, PortfolioImpact } from './trade-confirmation-dialog';
import { apiClient, Recommendation, RiskValidationResult } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

/**
 * Example usage of TradeConfirmationDialog component
 *
 * This example demonstrates how to:
 * 1. Open the dialog when user clicks "Execute Live Trade"
 * 2. Validate the trade with the Risk Engine
 * 3. Calculate portfolio impact
 * 4. Handle user confirmation
 * 5. Execute the live trade
 */
export function TradeConfirmationExample() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [riskValidation, setRiskValidation] = useState<RiskValidationResult | null>(null);
  const [portfolioImpact, setPortfolioImpact] = useState<PortfolioImpact | null>(null);

  // Example recommendation from AI
  const recommendation: Recommendation = {
    id: 'rec-123',
    action: 'BUY',
    symbol: 'RELIANCE',
    entryPrice: 2460,
    target: 2520,
    stopLoss: 2430,
    confidence: 0.75,
    reasoning: 'Strong uptrend with bullish technical indicators',
    quantData: {
      symbol: 'RELIANCE',
      timeframe: '1d',
      indicators: {
        rsi: 45.2,
        macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
        sma_20: 2455.0,
        sma_50: 2450.0,
        sma_200: 2380.0,
        ema_5: 2462.0,
        ema_15: 2460.0,
        ema_20: 2458.0,
        ema_50: 2452.0,
        ema_200: 2385.0,
        bollingerBands: { upper: 2500.0, middle: 2455.0, lower: 2410.0 },
        adx: 25.0,
        atr: 45.0,
        vwap: 2456.0,
        volume_ma: 1000000,
        relative_volume: 1.2,
        week_52_high: 2800.0,
        week_52_low: 2100.0,
        momentum: 15.5,
      },
      supportResistance: [
        { level: 2400, strength: 0.85 },
        { level: 2500, strength: 0.72 },
      ],
      trendlines: [{ slope: 2.5, intercept: 2350, rSquared: 0.89 }],
    },
  };

  const quantity = 10;
  const userId = 'user-123';

  /**
   * Handle "Execute Live Trade" button click
   * Opens the dialog and performs risk validation
   */
  const handleExecuteLiveTradeClick = async () => {
    try {
      setIsLoading(true);

      // Guard against HOLD action
      if (recommendation.action === 'HOLD') {
        alert('Cannot execute HOLD recommendation');
        return;
      }

      // 1. Validate the trade with Risk Engine
      const validation = await apiClient.validateTrade({
        userId,
        symbol: recommendation.symbol,
        action: recommendation.action,
        quantity,
        price: recommendation.entryPrice,
        stopLoss: recommendation.stopLoss,
        target: recommendation.target,
      });
      setRiskValidation(validation);

      // 2. Calculate portfolio impact (you would fetch current portfolio first)
      const currentPortfolio = await apiClient.getPortfolio(userId);
      const tradeValue = recommendation.entryPrice * quantity;
      const potentialProfit =
        Math.abs(recommendation.target - recommendation.entryPrice) * quantity;
      const potentialLoss =
        Math.abs(recommendation.entryPrice - recommendation.stopLoss) * quantity;

      const impact: PortfolioImpact = {
        currentValue: currentPortfolio.totalValue,
        newInvestment: tradeValue,
        newTotalValue: currentPortfolio.totalValue + tradeValue,
        newExposurePercent:
          ((currentPortfolio.investedValue + tradeValue) /
            (currentPortfolio.totalValue + tradeValue)) *
          100,
        maxPotentialLoss: potentialLoss,
        maxPotentialProfit: potentialProfit,
        existingPositions: currentPortfolio.positions.length,
      };
      setPortfolioImpact(impact);

      // 3. Open the dialog
      setIsDialogOpen(true);
    } catch (error) {
      console.error('Failed to prepare trade confirmation:', error);
      alert('Failed to validate trade. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle user confirmation
   * Executes the live trade when user clicks "Confirm"
   */
  const handleConfirm = async () => {
    try {
      setIsLoading(true);

      // Guard against HOLD action
      if (recommendation.action === 'HOLD') {
        alert('Cannot execute HOLD recommendation');
        return;
      }

      // Execute the live trade with userConfirmed=true
      const result = await apiClient.executeLiveTrade({
        userId,
        symbol: recommendation.symbol,
        action: recommendation.action,
        quantity,
        price: recommendation.entryPrice,
        stopLoss: recommendation.stopLoss,
        target: recommendation.target,
        signalId: recommendation.id,
        userConfirmed: true,
      });

      if (result.status === 'EXECUTED' || result.status === 'PENDING') {
        alert(
          `Trade ${result.status.toLowerCase()}! ${result.brokerOrderId ? `Order ID: ${result.brokerOrderId}` : ''}`
        );
        setIsDialogOpen(false);
        // Refresh portfolio or navigate to positions page
      } else {
        alert(`Trade failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to execute trade:', error);
      alert('Failed to execute trade. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle user cancellation
   * Closes the dialog without executing the trade
   */
  const handleCancel = () => {
    setIsDialogOpen(false);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Trade Confirmation Dialog Example</h2>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Click the button below to simulate opening the trade confirmation dialog.
        </p>
        <p className="text-sm text-muted-foreground">
          The dialog will show trade details, risk validation, and portfolio impact before
          executing.
        </p>
      </div>

      <Button onClick={handleExecuteLiveTradeClick} disabled={isLoading}>
        {isLoading ? 'Preparing...' : 'Execute Live Trade'}
      </Button>

      {/* Trade Confirmation Dialog */}
      <TradeConfirmationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        recommendation={recommendation}
        quantity={quantity}
        riskValidation={riskValidation}
        portfolioImpact={portfolioImpact}
        isLoading={isLoading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
