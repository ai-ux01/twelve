'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { IntradayAnalyzer } from '@/components/intraday-analyzer';
import { IntradayDataPanel } from '@/components/intraday-data-panel';
import { IntradayRecommendationCard } from '@/components/intraday-recommendation-card';
import { DataFreshnessIndicator } from '@/components/data-freshness-indicator';
import type { IntradayAnalysisResponse } from '@/lib/api-client';
import type { OHLCVData } from '@/lib/api-client';
import { DEFAULT_USER_ID } from '@/lib/constants';

const IntradayChart = dynamic(() => import('@/components/charts/IntradayChart'), { ssr: false });

/**
 * Intraday Analysis Page
 * 
 * Provides a UI for analyzing stocks for intraday trading opportunities.
 * Features manual refresh only (NO auto-refresh), comprehensive technical analysis,
 * and paper trading execution.
 * 
 * Requirements: 6.8, 13.1, 13.2
 * - 6.8: Manual refresh and analysis for intraday stocks
 * - 13.1: Natural language input and API integration
 * - 13.2: Structured recommendation display
 * 
 * CRITICAL: NO automatic refresh timer - user must click button
 */
export default function IntradayAnalysisPage() {
  const [analysisResult, setAnalysisResult] = useState<IntradayAnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userId] = useState(DEFAULT_USER_ID);
  const [ohlcvData, setOhlcvData] = useState<OHLCVData[]>([]);

  // Fetch OHLCV data when analysis completes
  useEffect(() => {
    if (!analysisResult) {
      setOhlcvData([]);
      return;
    }
    const fetchOhlcv = async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/api/market-data/ohlcv?symbol=${analysisResult.symbol}&timeframe=${analysisResult.interval || '5m'}&limit=100`
        );
        if (res.ok) {
          const data = await res.json();
          setOhlcvData(Array.isArray(data) ? data : data.data ?? []);
        }
      } catch {
        // Chart will show empty state
      }
    };
    fetchOhlcv();
  }, [analysisResult]);

  const handleAnalyzeComplete = (result: IntradayAnalysisResponse) => {
    setAnalysisResult(result);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleAnalyzeError = (error: Error) => {
    setErrorMessage(error.message);
  };

  const handlePaperTradeSuccess = (tradeId: string) => {
    setSuccessMessage(`Paper trade executed successfully! Trade ID: ${tradeId}`);
  };

  const handlePaperTradeError = (error: Error) => {
    setErrorMessage(error.message);
  };

  const handleRefreshClick = () => {
    // Trigger a refresh by clearing the current result
    // User will need to click REFRESH & ANALYZE button again
    setErrorMessage('Please click REFRESH & ANALYZE to get the latest data');
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Intraday Trading Analysis</h1>
        <p className="text-muted-foreground">
          Analyze NSE stocks for same-day trading opportunities with manual refresh
        </p>
      </div>

      {/* Analysis Configuration Component */}
      <div className="mb-6">
        <IntradayAnalyzer
          onAnalyzeComplete={handleAnalyzeComplete}
          onAnalyzeError={handleAnalyzeError}
        />
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <Alert className="mb-6 bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {successMessage && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Data Freshness Indicator */}
          {analysisResult.dataFreshness && (
            <DataFreshnessIndicator
              dataFreshness={analysisResult.dataFreshness}
              onRefreshClick={handleRefreshClick}
            />
          )}

          {/* Two Column Layout: Recommendation + Technical Data */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Recommendation Card */}
            <IntradayRecommendationCard
              recommendation={analysisResult.recommendation}
              userId={userId}
              onPaperTradeSuccess={handlePaperTradeSuccess}
              onPaperTradeError={handlePaperTradeError}
            />

            {/* Right Column: Technical Data Panel */}
            <IntradayDataPanel data={analysisResult} />
          </div>

          {/* Intraday Chart */}
          {ohlcvData.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <IntradayChart
                  symbol={analysisResult.symbol}
                  data={ohlcvData}
                  entry={analysisResult.recommendation.entry}
                  stopLoss={analysisResult.recommendation.stopLoss}
                  target={analysisResult.recommendation.target}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty State: No Analysis Yet */}
      {!analysisResult && !errorMessage && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Ready to Analyze</p>
              <p className="text-sm">
                Enter a stock symbol, select an interval, and click &quot;REFRESH & ANALYZE&quot; to
                find intraday trading opportunities
              </p>
              <p className="text-sm mt-2 text-xs">
                <strong>Note:</strong> Analysis is manual only. No auto-refresh timers.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
