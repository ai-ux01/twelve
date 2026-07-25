/**
 * IntradayRecommendationCard Component
 * 
 * Displays intraday trading recommendation with execution controls.
 * Shows signal with color coding, confidence score, entry/stop/target levels,
 * risk/reward ratio, key indicators, and rationale.
 * 
 * Requirements covered: 6.7, 6.8, 13.2
 * 
 * CRITICAL:
 * - If isStale = true: Show "HOLD - Data is stale" message prominently
 * - If NO_TRADE: Show reason why trade not recommended
 * - Only paper trading button (only if signal is BUY or SELL and data is fresh)
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, TrendingUp, AlertCircle } from 'lucide-react';

export interface IntradayRecommendationCardProps {
  recommendation: {
    symbol: string;
    signal: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE';
    confidence: number;
    timestamp: string;
    entry: number;
    stopLoss: number;
    target: number;
    riskReward: number;
    currentPrice: number;
    vwap: number;
    ema5: number;
    ema15: number;
    rsi: number;
    macd: {
      value: number;
      signal: number;
      histogram: number;
    };
    isStale: boolean;
    dataTimestamp: string;
    rationale: string;
    warnings?: string[];
  };
  userId?: string;
  onPaperTradeSuccess?: (tradeId: string) => void;
  onPaperTradeError?: (error: Error) => void;
}

/**
 * IntradayRecommendationCard - Trading recommendation with paper execution
 * 
 * Features:
 * - Display recommendation signal with color coding (BUY=green, SELL=red, HOLD=yellow, NO_TRADE=gray)
 * - Show confidence score as progress bar
 * - Display entry, stop loss, target levels
 * - Show risk/reward ratio
 * - Display key indicators (VWAP, RSI, MACD)
 * - Display rationale text
 * - If isStale = true: Show "HOLD - Data is stale" message prominently
 * - If NO_TRADE: Show reason why trade not recommended
 * - Include "BUY ON PAPER" button (only if signal is BUY or SELL and data is fresh)
 */
export function IntradayRecommendationCard({
  recommendation,
  userId = 'user-123',
  onPaperTradeSuccess,
  onPaperTradeError,
}: IntradayRecommendationCardProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const {
    symbol,
    signal,
    confidence,
    entry,
    stopLoss,
    target,
    riskReward,
    currentPrice,
    vwap,
    ema5,
    ema15,
    rsi,
    macd,
    isStale,
    rationale,
    warnings,
  } = recommendation;

  // Determine if paper trade button should be shown
  const canTrade = !isStale && (signal === 'BUY' || signal === 'SELL');

  // Override signal to HOLD if data is stale
  const effectiveSignal = isStale ? 'HOLD' : signal;

  const handleBuyOnPaper = async () => {
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const response = await fetch('http://localhost:4000/api/trade/paper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          symbol,
          action: signal,
          quantity: 1, // Default quantity for intraday trades
          price: entry,
          stopLoss,
          target,
          intradayFlag: true, // Task 64.1: Mark as intraday position
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Paper trade failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      setExecutionResult({
        success: true,
        message: `Paper trade executed successfully! Trade ID: ${result.tradeId}`,
      });

      if (onPaperTradeSuccess) {
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

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return 'bg-green-500';
      case 'SELL':
        return 'bg-red-500';
      case 'HOLD':
        return 'bg-yellow-500';
      case 'NO_TRADE':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSignalTextColor = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return 'text-green-600';
      case 'SELL':
        return 'text-red-600';
      case 'HOLD':
        return 'text-yellow-600';
      case 'NO_TRADE':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  // Calculate price differences for visual display
  const targetGain = signal === 'BUY' ? ((target - entry) / entry) * 100 : ((entry - target) / entry) * 100;
  const stopLossRisk = signal === 'BUY' ? ((entry - stopLoss) / entry) * 100 : ((stopLoss - entry) / entry) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{symbol}</CardTitle>
            <CardDescription>Intraday Trading Recommendation</CardDescription>
          </div>
          <Badge className={getSignalColor(effectiveSignal)}>{effectiveSignal}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stale Data Warning - PROMINENT */}
        {isStale && (
          <div className="bg-yellow-50 dark:bg-yellow-950 border-2 border-yellow-500 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                HOLD - Data is stale
              </p>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              The data used for this recommendation is outdated. Click REFRESH & ANALYZE to get the latest data
              before making any trading decisions.
            </p>
          </div>
        )}

        {/* NO_TRADE Warning - PROMINENT */}
        {signal === 'NO_TRADE' && !isStale && (
          <div className="bg-gray-50 dark:bg-gray-900 border-2 border-gray-400 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-gray-600" />
              <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                NO TRADE RECOMMENDED
              </p>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {rationale}
            </p>
          </div>
        )}

        {/* Confidence Score */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">Confidence Score</span>
            <span className="text-muted-foreground">{confidence.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${confidence >= 70 ? 'bg-green-500' : confidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'} transition-all duration-500`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        <Separator />

        {/* Price Levels - Only show for BUY/SELL signals */}
        {(signal === 'BUY' || signal === 'SELL') && (
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
        )}

        {/* Risk/Reward */}
        {(signal === 'BUY' || signal === 'SELL') && (
          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Risk/Reward Ratio</p>
              <p className="text-2xl font-bold">{riskReward.toFixed(2)}:1</p>
            </div>
            {riskReward >= 2 && <Badge className="bg-green-500">Favorable</Badge>}
          </div>
        )}

        <Separator />

        {/* Key Indicators */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Key Indicators</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Current Price</p>
              <p className="font-medium">₹{currentPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">VWAP</p>
              <p className="font-medium">₹{vwap.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">EMA 5</p>
              <p className="font-medium">₹{ema5.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">EMA 15</p>
              <p className="font-medium">₹{ema15.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">RSI</p>
              <p className="font-medium">{rsi.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">MACD Histogram</p>
              <p className={`font-medium ${macd.histogram >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {macd.histogram.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Rationale */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Rationale</h3>
          <p className="text-sm text-muted-foreground">{rationale}</p>
        </div>

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg">
            <h3 className="text-sm font-semibold mb-2 text-yellow-800 dark:text-yellow-200">Warnings</h3>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              {warnings.map((warning, i) => (
                <li key={i}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

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
        {canTrade && (
          <>
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
                  {signal} ON PAPER
                </>
              )}
            </Button>

            {/* Safety Notice */}
            <p className="text-xs text-muted-foreground text-center">
              This is a paper trade (simulated). No real money will be used.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
