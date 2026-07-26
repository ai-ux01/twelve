/**
 * Backtesting Page
 *
 * Main page for the Backtesting Engine.
 * Layout: configuration form on the left, results panel on the right.
 * Submits to POST /quant/backtesting/run and displays results.
 */

'use client';

import { useState } from 'react';
import { BacktestConfigForm, type BacktestFormData } from '@/components/backtesting/BacktestConfigForm';
import { BacktestResults, type BacktestResultData } from '@/components/backtesting/BacktestResults';

export default function BacktestingPage() {
  const [result, setResult] = useState<BacktestResultData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: BacktestFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/quant/backtesting/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Request failed with status ${response.status}`);
      }

      const resultData: BacktestResultData = await response.json();
      setResult(resultData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Backtesting Engine</h1>
        <p className="text-sm text-muted-foreground">
          Configure and run strategy backtests against historical OHLCV data
        </p>
      </header>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        {/* Left: Config Form */}
        <div>
          <BacktestConfigForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          )}

          {isLoading && !result && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p>Running backtest...</p>
              </div>
            </div>
          )}

          {!isLoading && !result && !error && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium mb-1">No results yet</p>
                <p className="text-sm">Configure your strategy and click &quot;Run Backtest&quot; to see results.</p>
              </div>
            </div>
          )}

          <BacktestResults result={result} />
        </div>
      </div>
    </div>
  );
}
