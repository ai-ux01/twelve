/**
 * SwingRecommendationCard Component
 * 
 * Displays swing trading recommendation with execution controls.
 * Provides "BUY ON PAPER" button for paper trading execution.
 * 
 * Requirements covered: 5.5, 5.7, 13.2
 * 
 * CRITICAL: NO automatic live trade execution.
 * Only paper trading button is provided.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp } from 'lucide-react';
import { apiClient, SwingCandidate } from '@/lib/api-client';

export interface SwingRecommendationCardProps {
  candidate: SwingCandidate;
  userId?: string;
  onPaperTradeSuccess?: (tradeId: string) => void;
  onPaperTradeError?: (error: Error) => void;
}

/**
 * SwingRecommendationCard - Trading recommendation with paper execution
 * 
 * Features:
 * - Visual price ladder (Entry, Target, Stop Loss)
 * - Risk/Reward ratio display
 * - "BUY ON PAPER" execution button
 * - Loading and error states
 * 
 * Safety:
 * - Only paper trading execution
 * - No automatic live trade execution
 * - Explicit user action required
 */
export function SwingRecommendationCard({
  candidate,
  userId = 'user-123',
  onPaperTradeSuccess,
  onPaperTradeError,
}: SwingRecommendationCardProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const { symbol, score, trend, setupType, entry, stopLoss, target, riskReward } = candidate;

  const handleBuyOnPaper = async () => {
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await apiClient.executeSwingPaperTrade({
        userId,
        symbol,
        quantity: 10, // Default quantity for swing trades
        entryPrice: entry,
        stopLoss,
        target,
      });

      setExecutionResult({
        success: result.success,
        message: result.message,
      });

      if (result.success && onPaperTradeSuccess) {
        onPaperTradeSuccess(result.tradeId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Paper trade execution failed';
      setExecutionResult({
        success: false,
        message: errorMessage,
      });

      if (onPaperTradeError) {
        onPaperTradeError(error instanceof Error ? error : new Error(errorMessage));
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const getTrendColor = (trend: string) => {
    if (trend.includes('UPTREND')) return 'bg-green-500';
    if (trend.includes('DOWNTREND')) return 'bg-red-500';
    return 'bg-gray-500';
  };

  // Calculate price differences for visual display
  const targetGain = ((target - entry) / entry) * 100;
  const stopLossRisk = ((entry - stopLoss) / entry) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{symbol}</CardTitle>
            <CardDescription>Swing Trading Opportunity</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge className={getTrendColor(trend)}>{trend}</Badge>
            <Badge variant="outline">Score: {score.toFixed(1)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Setup Information */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Setup Type</p>
          <p className="text-lg font-medium">{setupType}</p>
        </div>

        {/* Price Ladder */}
        <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
          <h3 className="text-sm font-semibold mb-3">Price Levels</h3>
          
          {/* Target */}
          <div className="flex items-center justify-between border-l-4 border-green-500 pl-3">
            <div>
              <p className="text-sm text-muted-foreground">Target</p>
              <p className="text-lg font-bold text-green-600">₹{target.toFixed(2)}</p>
            </div>
            <Badge className="bg-green-100 text-green-800">
              +{targetGain.toFixed(1)}%
            </Badge>
          </div>

          {/* Entry */}
          <div className="flex items-center justify-between border-l-4 border-blue-500 pl-3">
            <div>
              <p className="text-sm text-muted-foreground">Entry</p>
              <p className="text-lg font-bold">₹{entry.toFixed(2)}</p>
            </div>
          </div>

          {/* Stop Loss */}
          <div className="flex items-center justify-between border-l-4 border-red-500 pl-3">
            <div>
              <p className="text-sm text-muted-foreground">Stop Loss</p>
              <p className="text-lg font-bold text-red-600">₹{stopLoss.toFixed(2)}</p>
            </div>
            <Badge className="bg-red-100 text-red-800">
              -{stopLossRisk.toFixed(1)}%
            </Badge>
          </div>
        </div>

        {/* Risk/Reward */}
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Risk/Reward Ratio</p>
            <p className="text-2xl font-bold">{riskReward.toFixed(2)}:1</p>
          </div>
          {riskReward >= 2 && (
            <Badge className="bg-green-500">Favorable</Badge>
          )}
        </div>

        {/* Execution Result */}
        {executionResult && (
          <div
            className={`p-4 rounded-lg ${
              executionResult.success
                ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200'
            }`}
          >
            <p className="text-sm font-medium">{executionResult.message}</p>
          </div>
        )}

        {/* Paper Trade Button */}
        <Button
          onClick={handleBuyOnPaper}
          disabled={isExecuting}
          className="w-full"
          size="lg"
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Executing Paper Trade...
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 mr-2" />
              BUY ON PAPER
            </>
          )}
        </Button>

        {/* Safety Notice */}
        <p className="text-xs text-muted-foreground text-center">
          This is a paper trade (simulated). No real money will be used.
        </p>
      </CardContent>
    </Card>
  );
}
