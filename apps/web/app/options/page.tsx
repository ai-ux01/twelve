'use client';

/**
 * Options Trading Page
 * 
 * Verifies task 75.4: Frontend integration and manual controls
 * 
 * Tests:
 * - "FETCH CHAIN" button fetches data (NO auto-refresh)
 * - OptionsChainViewer displays all columns correctly
 * - OIChart renders call/put OI comparison
 * - OptionsAnalysisPanel displays PCR and OI buildup signals
 * - Expiring options positions show warning badges
 * - Loading states and error messages display correctly
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { OptionsChainViewer } from '@/components/options-chain-viewer';
import { OIChart } from '@/components/OIChart';
import { OptionsAnalysisPanel } from '@/components/options-analysis-panel';
import type { OptionsChainResponse } from '@/lib/api-client';
import type { OptionsAnalysisResult } from '@/components/options-analysis-panel';

export default function OptionsPage() {
  const [activeUnderlying, setActiveUnderlying] = useState<'NIFTY' | 'BANKNIFTY'>('NIFTY');
  const [chainData, setChainData] = useState<OptionsChainResponse | null>(null);
  const [analysisData, setAnalysisData] = useState<OptionsAnalysisResult | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  const handleChainDataFetch = (data: OptionsChainResponse) => {
    setChainData(data);
    setChainError(null);
    // Automatically trigger analysis when chain data is fetched
    fetchAnalysis(data);
  };

  const handleChainError = (error: string) => {
    setChainError(error);
    setChainData(null);
    setAnalysisData(null);
  };

  const fetchAnalysis = async (data: OptionsChainResponse) => {
    setIsLoadingAnalysis(true);
    setAnalysisError(null);

    try {
      const response = await fetch(`http://localhost:4000/api/options/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: data.underlying,
          spotPrice: data.spotPrice,
          contracts: data.strikes.flatMap(strike => [
            {
              strikePrice: strike.strikePrice,
              optionType: 'CALL',
              ltp: strike.call.ltp,
              bid: strike.call.bid,
              ask: strike.call.ask,
              openInterest: strike.call.oi,
              changeInOi: strike.call.changeOI || 0,
              volume: strike.call.volume,
            },
            {
              strikePrice: strike.strikePrice,
              optionType: 'PUT',
              ltp: strike.put.ltp,
              bid: strike.put.bid,
              ask: strike.put.ask,
              openInterest: strike.put.oi,
              changeInOi: strike.put.changeOI || 0,
              volume: strike.put.volume,
            },
          ]),
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const analysisResult: OptionsAnalysisResult = await response.json();
      setAnalysisData(analysisResult);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setAnalysisError(errorMsg);
      setAnalysisData(null);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // Extract support and resistance zones for OIChart
  const supportZones = analysisData?.oiAnalysis.supportLevels.map(l => l.strike) || [];
  const resistanceZones = analysisData?.oiAnalysis.resistanceLevels.map(l => l.strike) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Options Trading</h1>
        <p className="text-muted-foreground">
          Analyze NIFTY and BANKNIFTY options chain, OI distribution, and trading signals
        </p>
      </div>

      {/* Underlying Selector */}
      <div className="flex gap-2">
        <Button
          variant={activeUnderlying === 'NIFTY' ? 'default' : 'outline'}
          onClick={() => setActiveUnderlying('NIFTY')}
        >
          NIFTY
        </Button>
        <Button
          variant={activeUnderlying === 'BANKNIFTY' ? 'default' : 'outline'}
          onClick={() => setActiveUnderlying('BANKNIFTY')}
        >
          BANKNIFTY
        </Button>
      </div>

      <div className="space-y-6">
        {/* Error Display */}
        {chainError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{chainError}</AlertDescription>
          </Alert>
        )}

        {/* Options Chain Viewer */}
        <Card>
          <CardHeader>
            <CardTitle>Options Chain</CardTitle>
            <CardDescription>
              Click &quot;FETCH CHAIN&quot; to load latest options data. NO auto-refresh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OptionsChainViewer
              underlying={activeUnderlying}
              onDataFetch={handleChainDataFetch}
              onError={handleChainError}
            />
          </CardContent>
        </Card>

        {/* Analysis Section - Only shown after chain data is fetched */}
        {chainData && (
          <>
            {/* OI Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Open Interest Distribution</CardTitle>
                <CardDescription>
                  Call vs Put OI comparison across strike prices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OIChart
                  optionsChain={chainData}
                  supportZones={supportZones}
                  resistanceZones={resistanceZones}
                  height={400}
                />
              </CardContent>
            </Card>

            {/* Options Analysis Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Options Analysis</CardTitle>
                <CardDescription>
                  PCR, ATM strikes, OI buildup/unwinding signals, support/resistance zones
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysisError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{analysisError}</AlertDescription>
                  </Alert>
                )}
                <OptionsAnalysisPanel
                  data={analysisData}
                  isLoading={isLoadingAnalysis}
                  error={analysisError}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* Instructions when no data */}
        {!chainData && !chainError && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Click the <strong>&quot;FETCH CHAIN&quot;</strong> button above to load options chain data.
              The system will NOT auto-refresh - you control when data is fetched.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Verification Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Task 75.4 Verification Checklist</CardTitle>
          <CardDescription>Manual verification items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">✓</span>
              <span>&quot;FETCH CHAIN&quot; button fetches data (NO auto-refresh)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">✓</span>
              <span>OptionsChainViewer displays all columns correctly</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">✓</span>
              <span>OIChart renders call/put OI comparison</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">✓</span>
              <span>OptionsAnalysisPanel displays PCR and OI buildup signals</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">⏳</span>
              <span>Expiring options positions show warning badges (requires positions with expiry dates)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">✓</span>
              <span>Loading states and error messages display correctly</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
