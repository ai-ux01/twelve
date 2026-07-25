/**
 * ChartViewer Integration Example
 *
 * Shows how to integrate ChartViewer into analysis page with:
 * - Market data fetching
 * - Recommendation display with chart
 * - Real-time updates with TanStack Query
 *
 * This is an example/reference for future implementation in task 19.1
 */

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChartViewer } from '@/components/ChartViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient, type PromptResponse } from '@/lib/api-client';

export function AnalysisPageWithChart() {
  const [prompt, setPrompt] = useState('');
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);

  // Fetch recommendation when prompt is submitted
  const {
    data: recommendation,
    isLoading: isAnalyzing,
    error: analysisError,
  } = useQuery({
    queryKey: ['analysis', submittedPrompt],
    queryFn: () => apiClient.submitPrompt(submittedPrompt!),
    enabled: !!submittedPrompt,
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch market data for the symbol once we have a recommendation
  const symbol = recommendation?.recommendation?.symbol;
  const { data: marketData, isLoading: isLoadingMarketData } = useQuery({
    queryKey: ['market', symbol, '1d'],
    queryFn: () => apiClient.getMarketData(symbol!, '1d'),
    enabled: !!symbol,
    refetchInterval: 60000, // Refetch every minute
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setSubmittedPrompt(prompt);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Analysis with Chart</h1>
        <p className="text-muted-foreground">
          Use natural language to analyze stocks and get AI-powered trade recommendations with
          interactive charts
        </p>
      </div>

      {/* Prompt Input */}
      <Card>
        <CardHeader>
          <CardTitle>Ask ProfitTerminal</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Find the best swing trade in RELIANCE"
              className="w-full min-h-[120px] rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              disabled={isAnalyzing}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={isAnalyzing || !prompt.trim()}>
                {isAnalyzing ? 'Analyzing...' : 'Analyze'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error Display */}
      {analysisError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Error analyzing prompt: {analysisError.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recommendation Display */}
      {recommendation && (
        <div className="space-y-6">
          {/* AI Recommendation Card */}
          <Card>
            <CardHeader>
              <CardTitle>AI Recommendation for {recommendation.recommendation.symbol}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Action and Confidence */}
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold">{recommendation.recommendation.action}</div>
                <div className="text-sm text-muted-foreground">
                  Confidence: {(recommendation.recommendation.confidence * 100).toFixed(0)}%
                </div>
              </div>

              {/* Price Levels */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Entry Price</div>
                  <div className="text-lg font-semibold">
                    ₹{recommendation.recommendation.entryPrice.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Target</div>
                  <div className="text-lg font-semibold text-green-600">
                    ₹{recommendation.recommendation.target.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Stop Loss</div>
                  <div className="text-lg font-semibold text-red-600">
                    ₹{recommendation.recommendation.stopLoss.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <div className="text-sm font-semibold mb-2">AI Reasoning</div>
                <div className="text-sm text-muted-foreground rounded-lg bg-muted p-4">
                  {recommendation.recommendation.reasoning}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button variant="default">Execute Paper Trade</Button>
                <Button variant="outline">Execute Live Trade</Button>
              </div>
            </CardContent>
          </Card>

          {/* Chart Display */}
          {isLoadingMarketData ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Loading chart data...
              </CardContent>
            </Card>
          ) : marketData ? (
            <ChartViewer
              symbol={recommendation.recommendation.symbol}
              data={marketData.data}
              quantAnalysis={recommendation.recommendation.quantData}
              height={600}
              showVolume={true}
            />
          ) : null}

          {/* Technical Analysis Summary */}
          {recommendation.recommendation.quantData && (
            <Card>
              <CardHeader>
                <CardTitle>Technical Analysis Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">RSI</div>
                    <div className="text-lg font-semibold">
                      {recommendation.recommendation.quantData.indicators.rsi.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">MACD</div>
                    <div className="text-lg font-semibold">
                      {recommendation.recommendation.quantData.indicators.macd.value.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">SMA 50</div>
                    <div className="text-lg font-semibold">
                      ₹{recommendation.recommendation.quantData.indicators.sma_50.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">SMA 200</div>
                    <div className="text-lg font-semibold">
                      ₹{recommendation.recommendation.quantData.indicators.sma_200.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Placeholder when no recommendation */}
      {!recommendation && !isAnalyzing && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Submit a prompt above to receive AI-powered trade recommendations with charts</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * INTEGRATION NOTES:
 *
 * 1. Replace analysis/page.tsx content with this component to get full functionality
 *
 * 2. Required dependencies (already installed):
 *    - @tanstack/react-query for data fetching
 *    - apiClient from @/lib/api-client
 *    - ChartViewer from @/components/ChartViewer
 *
 * 3. Data flow:
 *    a. User submits prompt
 *    b. apiClient.submitPrompt() fetches recommendation from backend
 *    c. Once symbol is known, apiClient.getMarketData() fetches OHLCV data
 *    d. ChartViewer displays candlestick chart with technical indicators
 *
 * 4. Real-time updates:
 *    - Market data refetches every 60 seconds
 *    - Recommendation cached for 60 seconds
 *
 * 5. Error handling:
 *    - Displays error message if analysis fails
 *    - Handles missing market data gracefully
 *
 * 6. Future enhancements (for task 19.1):
 *    - WebSocket integration for real-time price updates
 *    - Multiple timeframe selection (1m, 5m, 15m, 1h, 1d)
 *    - Save favorite symbols/analyses
 *    - Export chart as image
 */
