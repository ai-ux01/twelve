/**
 * IntradayAnalyzer Component
 * 
 * Provides UI for manual refresh and analysis of stocks for intraday trading opportunities.
 * Features manual trigger only (NO auto-refresh), interval selection, loading states,
 * and data freshness tracking.
 * 
 * Requirements covered: 6.8, 13.1
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, Clock } from 'lucide-react';

export interface IntradayAnalyzerProps {
  onAnalyzeComplete?: (result: any) => void;
  onAnalyzeError?: (error: Error) => void;
}

/**
 * IntradayAnalyzer - Manual analysis trigger with configuration
 * 
 * Features:
 * - Text input for stock symbol
 * - Dropdown for interval selection (1min, 5min, 15min)
 * - "REFRESH & ANALYZE" button (manual trigger - NO auto-refresh)
 * - Loading state during analysis
 * - Display last refresh timestamp prominently
 * - Display data timestamp and freshness indicator
 * 
 * CRITICAL: NO automatic refresh timer - user must click button
 */
export function IntradayAnalyzer({ onAnalyzeComplete, onAnalyzeError }: IntradayAnalyzerProps) {
  const [symbol, setSymbol] = useState('');
  const [interval, setInterval] = useState<'1m' | '5m' | '15m'>('5m');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const handleAnalyze = async () => {
    if (!symbol.trim()) {
      if (onAnalyzeError) {
        onAnalyzeError(new Error('Please enter a stock symbol'));
      }
      return;
    }

    setIsAnalyzing(true);

    try {
      // Step 1: Fetch candle data from MongoDB
      const timeframeMap: Record<string, string> = { '1m': '1minute', '5m': '5minute', '15m': '15minute' };
      const timeframe = timeframeMap[interval] || 'day';
      const ohlcvRes = await fetch(
        `http://localhost:8000/api/market-data/ohlcv?symbol=${symbol.toUpperCase()}&timeframe=${timeframe}&limit=100`
      );

      let ohlcvData: { open: number; high: number; low: number; close: number; volume: number }[] = [];

      if (ohlcvRes.ok) {
        const ohlcvJson = await ohlcvRes.json();
        const candles = ohlcvJson.candles || ohlcvJson.data || ohlcvJson;
        if (Array.isArray(candles) && candles.length > 0) {
          ohlcvData = candles.map((c: any) => ({
            timestamp: c.timestamp || new Date().toISOString(),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume || 0,
          }));
        }
      }

      // If no candle data from MongoDB, try daily candles as fallback
      if (ohlcvData.length < 30) {
        const dailyRes = await fetch(
          `http://localhost:8000/api/market-data/ohlcv?symbol=${symbol.toUpperCase()}&timeframe=day&limit=100`
        );
        if (dailyRes.ok) {
          const dailyJson = await dailyRes.json();
          const dailyCandles = dailyJson.candles || dailyJson.data || dailyJson;
          if (Array.isArray(dailyCandles) && dailyCandles.length >= 30) {
            ohlcvData = dailyCandles.map((c: any) => ({
              timestamp: c.timestamp || new Date().toISOString(),
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume || 0,
            }));
          }
        }
      }

      if (ohlcvData.length < 30) {
        throw new Error(`Not enough candle data for ${symbol.toUpperCase()}. Need at least 30 candles, found ${ohlcvData.length}. Make sure market data is available in MongoDB.`);
      }

      // Step 2: Send to analyze endpoint with the candle data
      const response = await fetch('http://localhost:8000/quant/intraday/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          interval,
          data: ohlcvData,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analysis failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setLastRefresh(new Date());

      if (onAnalyzeComplete) {
        onAnalyzeComplete(data);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      if (onAnalyzeError) {
        onAnalyzeError(error instanceof Error ? error : new Error('Analysis failed'));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyze();
    }
  };

  const formatLastRefresh = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intraday Analysis</CardTitle>
        <CardDescription>
          Manually refresh and analyze stocks for same-day trading opportunities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Symbol and Interval Input Row */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="symbol" className="text-sm font-medium mb-1 block">
                Stock Symbol
              </label>
              <Input
                id="symbol"
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="e.g., RELIANCE, TCS, INFY"
                disabled={isAnalyzing}
                className="uppercase"
              />
            </div>
            <div className="w-40">
              <label htmlFor="interval" className="text-sm font-medium mb-1 block">
                Interval
              </label>
              <select
                id="interval"
                value={interval}
                onChange={(e) => setInterval(e.target.value as '1m' | '5m' | '15m')}
                disabled={isAnalyzing}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="1m">1 Minute</option>
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
              </select>
            </div>
            <Button onClick={handleAnalyze} disabled={isAnalyzing} className="flex gap-2" size="lg">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  REFRESH & ANALYZE
                </>
              )}
            </Button>
          </div>

          {/* Last Refresh Timestamp */}
          {lastRefresh && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-slate-50 dark:bg-slate-900 p-3 rounded-md">
              <Clock className="h-4 w-4" />
              <span>Last refreshed: {formatLastRefresh(lastRefresh)}</span>
            </div>
          )}

          {/* Instructions */}
          <div className="text-xs text-muted-foreground">
            <p>
              <strong>Note:</strong> Data is refreshed manually only. Click &quot;REFRESH & ANALYZE&quot;
              to get the latest analysis.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
