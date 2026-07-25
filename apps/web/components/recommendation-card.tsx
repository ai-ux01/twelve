'use client';

import { Recommendation } from '@/lib/api-client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Target, ShieldAlert, ChartBar } from 'lucide-react';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onExecutePaperTrade?: () => void;
  onExecuteLiveTrade?: () => void;
  isPaperTradeLoading?: boolean;
  isLiveTradeLoading?: boolean;
}

/**
 * RecommendationCard Component
 *
 * Displays AI trade recommendations with:
 * - Trade action (BUY/SELL/HOLD)
 * - Entry price, target, stop-loss
 * - Confidence level
 * - Quantitative analysis summary
 * - AI reasoning text
 * - Execute Paper Trade button
 * - Execute Live Trade button
 *
 * Requirements covered: 13.2
 */
export function RecommendationCard({
  recommendation,
  onExecutePaperTrade,
  onExecuteLiveTrade,
  isPaperTradeLoading = false,
  isLiveTradeLoading = false,
}: RecommendationCardProps) {
  const { action, symbol, entryPrice, target, stopLoss, confidence, reasoning, quantData } =
    recommendation;

  // Format confidence as percentage
  const confidencePercent = (confidence * 100).toFixed(0);

  // Calculate risk-reward ratio
  const riskRewardRatio =
    action === 'BUY'
      ? ((target - entryPrice) / (entryPrice - stopLoss)).toFixed(2)
      : ((entryPrice - target) / (stopLoss - entryPrice)).toFixed(2);

  // Calculate potential profit/loss percentages
  const profitPercent =
    action === 'BUY'
      ? (((target - entryPrice) / entryPrice) * 100).toFixed(2)
      : (((entryPrice - target) / entryPrice) * 100).toFixed(2);

  const lossPercent =
    action === 'BUY'
      ? (((entryPrice - stopLoss) / entryPrice) * 100).toFixed(2)
      : (((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2);

  // Get action badge styling
  const actionVariant =
    action === 'BUY' ? 'default' : action === 'SELL' ? 'destructive' : 'outline';
  const actionIcon =
    action === 'BUY' ? (
      <TrendingUp className="size-4" />
    ) : action === 'SELL' ? (
      <TrendingDown className="size-4" />
    ) : null;

  // Get confidence level styling
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.75) return 'text-green-600';
    if (conf >= 0.5) return 'text-yellow-600';
    return 'text-orange-600';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {symbol}
              <Badge variant={actionVariant} className="flex items-center gap-1">
                {actionIcon}
                {action}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Recommendation ID: {recommendation.id.slice(0, 8)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className={cn('text-2xl font-bold', getConfidenceColor(confidence))}>
              {confidencePercent}%
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Trade Details */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="size-3" />
              Entry Price
            </div>
            <p className="text-xl font-semibold">₹{entryPrice.toFixed(2)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="size-3" />
              Target
            </div>
            <p className="text-xl font-semibold text-green-600">₹{target.toFixed(2)}</p>
            <p className="text-xs text-green-600">+{profitPercent}%</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldAlert className="size-3" />
              Stop Loss
            </div>
            <p className="text-xl font-semibold text-red-600">₹{stopLoss.toFixed(2)}</p>
            <p className="text-xs text-red-600">-{lossPercent}%</p>
          </div>
        </div>

        {/* Risk-Reward Ratio */}
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
          <span className="text-sm font-medium">Risk:Reward Ratio</span>
          <span className="text-lg font-bold">1:{riskRewardRatio}</span>
        </div>

        {/* Quantitative Analysis Summary */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ChartBar className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Quantitative Analysis</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-3 text-sm">
            <div>
              <p className="text-muted-foreground">RSI</p>
              <p className="font-semibold">{quantData.indicators.rsi.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">MACD</p>
              <p className="font-semibold">{quantData.indicators.macd.value.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SMA 50</p>
              <p className="font-semibold">₹{quantData.indicators.sma_50.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SMA 200</p>
              <p className="font-semibold">₹{quantData.indicators.sma_200.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Support Levels</p>
              <p className="font-semibold">{quantData.supportResistance.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Trendlines</p>
              <p className="font-semibold">{quantData.trendlines.length}</p>
            </div>
          </div>

          {/* Bollinger Bands */}
          <div className="rounded-lg border bg-card p-3 text-sm">
            <p className="text-muted-foreground mb-2">Bollinger Bands</p>
            <div className="flex justify-between">
              <span className="text-xs">
                Lower: ₹{quantData.indicators.bollingerBands.lower.toFixed(2)}
              </span>
              <span className="text-xs font-semibold">
                Mid: ₹{quantData.indicators.bollingerBands.middle.toFixed(2)}
              </span>
              <span className="text-xs">
                Upper: ₹{quantData.indicators.bollingerBands.upper.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Options Greeks (if available) */}
          {quantData.optionsGreeks && (
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p className="text-muted-foreground mb-2">Options Greeks</p>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Delta</p>
                  <p className="font-semibold">{quantData.optionsGreeks.delta.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gamma</p>
                  <p className="font-semibold">{quantData.optionsGreeks.gamma.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Theta</p>
                  <p className="font-semibold">{quantData.optionsGreeks.theta.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vega</p>
                  <p className="font-semibold">{quantData.optionsGreeks.vega.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Reasoning */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">AI Reasoning</h3>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            {recommendation.aiUnavailable ? (
              <div className="flex flex-col items-center justify-center space-y-2 py-2 text-center">
                <ShieldAlert className="size-8 text-yellow-600" />
                <p className="font-semibold text-yellow-600">AI Analysis Unavailable</p>
                <p className="text-xs text-muted-foreground">
                  The AI service encountered an error. Quantitative analysis is still available
                  above.
                </p>
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed">{reasoning}</p>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onExecutePaperTrade}
          disabled={isPaperTradeLoading || action === 'HOLD'}
        >
          {isPaperTradeLoading ? 'Executing...' : 'Execute Paper Trade'}
        </Button>
        <Button
          variant="default"
          className="flex-1"
          onClick={onExecuteLiveTrade}
          disabled={isLiveTradeLoading || action === 'HOLD'}
        >
          {isLiveTradeLoading ? 'Executing...' : 'Execute Live Trade'}
        </Button>
      </CardFooter>
    </Card>
  );
}
