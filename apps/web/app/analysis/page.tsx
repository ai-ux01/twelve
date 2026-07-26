/**
 * Analysis Page
 *
 * Main interface for submitting trading prompts and viewing AI recommendations.
 * Uses PromptInput component for natural language input and RecommendationCard for displaying results.
 *
 * Task: 19.1 - Connect PromptInput to POST /api/prompt
 * Task: 21.2 - Wire "Execute Live Trade" button to confirmation dialog
 * Requirements: 4.1, 10.1, 10.2, 10.3, 13.1
 */

'use client';

import { useState } from 'react';
import { PromptInput } from '@/components/prompt-input';
import { RecommendationCard } from '@/components/recommendation-card';
import { ScoreCard } from '@/components/score-card';
import {
  TradeConfirmationDialog,
  type PortfolioImpact,
} from '@/components/trade-confirmation-dialog';
import {
  apiClient,
  type PromptResponse,
  type TradeRequest,
  type RiskValidationResult,
} from '@/lib/api-client';
import { AlertCircle } from 'lucide-react';
import { DEFAULT_USER_ID } from '@/lib/constants';

export default function AnalysisPage() {
  const [recommendation, setRecommendation] = useState<PromptResponse | null>(null);
  const [isPaperTradeLoading, setIsPaperTradeLoading] = useState(false);
  const [isLiveTradeLoading, setIsLiveTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

  // State for trade confirmation dialog
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [riskValidation, setRiskValidation] = useState<RiskValidationResult | null>(null);
  const [portfolioImpact, setPortfolioImpact] = useState<PortfolioImpact | null>(null);
  const [tradeQuantity] = useState(1); // Default quantity, could be made configurable

  const handlePromptSubmit = (response: PromptResponse) => {
    setRecommendation(response);
    setTradeError(null);
    setTradeSuccess(null);
  };

  const handleExecutePaperTrade = async () => {
    if (!recommendation) return;

    setIsPaperTradeLoading(true);
    setTradeError(null);
    setTradeSuccess(null);

    try {
      const tradeRequest: TradeRequest = {
        userId: DEFAULT_USER_ID,
        symbol: recommendation.recommendation.symbol,
        action: recommendation.recommendation.action as 'BUY' | 'SELL',
        quantity: 1, // Default quantity, could be made configurable
        price: recommendation.recommendation.entryPrice,
        stopLoss: recommendation.recommendation.stopLoss,
        target: recommendation.recommendation.target,
        signalId: recommendation.recommendation.id,
      };

      const result = await apiClient.executePaperTrade(tradeRequest);

      if (result.status === 'EXECUTED') {
        setTradeSuccess(`Paper trade executed successfully! Trade ID: ${result.tradeId}`);
      } else {
        setTradeError(result.message || 'Paper trade failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute paper trade';
      setTradeError(errorMessage);
    } finally {
      setIsPaperTradeLoading(false);
    }
  };

  const handleExecuteLiveTrade = async () => {
    if (!recommendation) return;

    setIsLiveTradeLoading(true);
    setTradeError(null);
    setTradeSuccess(null);

    try {
      // Build trade request
      const tradeRequest: TradeRequest = {
        userId: DEFAULT_USER_ID,
        symbol: recommendation.recommendation.symbol,
        action: recommendation.recommendation.action as 'BUY' | 'SELL',
        quantity: tradeQuantity,
        price: recommendation.recommendation.entryPrice,
        stopLoss: recommendation.recommendation.stopLoss,
        target: recommendation.recommendation.target,
        signalId: recommendation.recommendation.id,
      };

      // Step 1: Validate trade with Risk Engine
      const validation = await apiClient.validateTrade(tradeRequest);
      setRiskValidation(validation);

      // Step 2: Calculate portfolio impact
      const portfolio = await apiClient.getPortfolio(tradeRequest.userId);
      const newInvestment = tradeRequest.price * tradeRequest.quantity;
      const maxPotentialProfit =
        Math.abs(recommendation.recommendation.target - tradeRequest.price) * tradeRequest.quantity;
      const maxPotentialLoss =
        Math.abs(tradeRequest.price - recommendation.recommendation.stopLoss) *
        tradeRequest.quantity;

      const impact: PortfolioImpact = {
        currentValue: portfolio.totalValue,
        newInvestment,
        newTotalValue: portfolio.totalValue + newInvestment,
        newExposurePercent:
          ((portfolio.investedValue + newInvestment) / portfolio.totalValue) * 100,
        maxPotentialLoss,
        maxPotentialProfit,
        existingPositions: portfolio.positions.length,
      };
      setPortfolioImpact(impact);

      // Step 3: Open confirmation dialog
      setIsConfirmDialogOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to prepare live trade';
      setTradeError(errorMessage);
    } finally {
      setIsLiveTradeLoading(false);
    }
  };

  const handleConfirmLiveTrade = async () => {
    if (!recommendation) return;

    setIsLiveTradeLoading(true);
    setTradeError(null);
    setTradeSuccess(null);

    try {
      const tradeRequest: TradeRequest = {
        userId: DEFAULT_USER_ID,
        symbol: recommendation.recommendation.symbol,
        action: recommendation.recommendation.action as 'BUY' | 'SELL',
        quantity: tradeQuantity,
        price: recommendation.recommendation.entryPrice,
        stopLoss: recommendation.recommendation.stopLoss,
        target: recommendation.recommendation.target,
        signalId: recommendation.recommendation.id,
      };

      // Execute the live trade with userConfirmed=true
      const result = await apiClient.executeLiveTrade({
        ...tradeRequest,
        userConfirmed: true,
      });

      if (result.status === 'EXECUTED' || result.status === 'PENDING') {
        setTradeSuccess(
          `Live trade ${result.status.toLowerCase()}! Trade ID: ${result.tradeId}` +
            (result.brokerOrderId ? ` | Broker Order ID: ${result.brokerOrderId}` : '')
        );

        // Refresh portfolio after successful trade
        // In a real app, this would trigger a refetch of the portfolio data
        // For now, we just close the dialog
        setIsConfirmDialogOpen(false);
      } else {
        setTradeError(result.message || result.error || 'Live trade failed');
        setIsConfirmDialogOpen(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute live trade';
      setTradeError(errorMessage);
      setIsConfirmDialogOpen(false);
    } finally {
      setIsLiveTradeLoading(false);
    }
  };

  const handleCancelLiveTrade = () => {
    setIsConfirmDialogOpen(false);
    setRiskValidation(null);
    setPortfolioImpact(null);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Analysis</h1>
        <p className="text-muted-foreground">
          Use natural language to analyze stocks and get AI-powered trade recommendations
        </p>
      </div>

      {/* Natural Language Input */}
      <div className="rounded-lg border bg-card p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Ask ProfitTerminal</h2>
        <PromptInput onSubmit={handlePromptSubmit} />
      </div>

      {/* Trade Status Messages */}
      {tradeSuccess && (
        <div className="mb-6 flex items-center gap-2 text-sm text-green-600 bg-green-50 p-4 rounded-lg border border-green-200">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{tradeSuccess}</span>
        </div>
      )}

      {tradeError && (
        <div className="mb-6 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
          <AlertCircle className="h-5 w-5" />
          <span>{tradeError}</span>
        </div>
      )}

      {/* AI Recommendations Section */}
      {recommendation ? (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">AI Recommendation</h2>
          
          {/* Display ScoreCard alongside RecommendationCard if score is available */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RecommendationCard
                recommendation={recommendation.recommendation}
                onExecutePaperTrade={handleExecutePaperTrade}
                onExecuteLiveTrade={handleExecuteLiveTrade}
                isPaperTradeLoading={isPaperTradeLoading}
                isLiveTradeLoading={isLiveTradeLoading}
              />
            </div>
            
            {/* Show ScoreCard if score data is available */}
            {recommendation.recommendation.score && (
              <div className="lg:col-span-1">
                <ScoreCard score={recommendation.recommendation.score} />
              </div>
            )}
          </div>

          {/* Trade Confirmation Dialog */}
          <TradeConfirmationDialog
            open={isConfirmDialogOpen}
            onOpenChange={setIsConfirmDialogOpen}
            recommendation={recommendation.recommendation}
            quantity={tradeQuantity}
            riskValidation={riskValidation}
            portfolioImpact={portfolioImpact}
            isLoading={isLiveTradeLoading}
            onConfirm={handleConfirmLiveTrade}
            onCancel={handleCancelLiveTrade}
          />
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">AI Recommendations</h2>
          <div className="text-center py-12 text-muted-foreground">
            <p>Submit a prompt above to receive AI-powered trade recommendations</p>
            <p className="text-sm mt-2">
              Recommendations include entry price, target, stop-loss, confidence level, and detailed
              reasoning
            </p>
          </div>
        </div>
      )}

      {/* Example Prompts */}
      {!recommendation && (
        <div className="rounded-lg border bg-card p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Example Prompts</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="text-left rounded-lg border bg-muted/40 p-4 text-sm">
              <strong>Swing Trading:</strong> Find the best swing trade in RELIANCE
            </div>
            <div className="text-left rounded-lg border bg-muted/40 p-4 text-sm">
              <strong>Intraday:</strong> Analyze TCS for intraday trading
            </div>
            <div className="text-left rounded-lg border bg-muted/40 p-4 text-sm">
              <strong>Options Scalping:</strong> Find NIFTY call options for scalping
            </div>
            <div className="text-left rounded-lg border bg-muted/40 p-4 text-sm">
              <strong>Options Analysis:</strong> Should I buy BANKNIFTY puts today?
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="mt-6 rounded-lg border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>How it works:</strong> Your prompt is parsed to extract trading intent, symbols,
          timeframe, and asset type. Market data flows through the Quant Engine for technical
          analysis, then AI provides reasoning and recommendations. All recommendations are
          validated by the Risk Engine.
        </p>
      </div>
    </div>
  );
}
