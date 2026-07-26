'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { SwingScanner } from '@/components/swing-scanner';
import { SwingAnalysisPanel } from '@/components/swing-analysis-panel';
import { SwingRecommendationCard } from '@/components/swing-recommendation-card';
import { SwingCandidate, SwingScanResponse } from '@/lib/api-client';
import type { OHLCVData } from '@/lib/api-client';
import { kotakApi } from '@/lib/kotak-api';
import { DEFAULT_USER_ID } from '@/lib/constants';

const SwingMiniChart = dynamic(() => import('@/components/charts/SwingMiniChart'), { ssr: false });

/**
 * Swing Scanner Page
 * 
 * Provides a UI for scanning the stock universe for swing trading opportunities
 * and executing paper trades on selected candidates.
 * 
 * Requirements: 5.1, 5.4, 5.7, 13.1, 13.2
 * - 5.1: Swing trading analysis and scanning
 * - 5.4: POST /swing/scan endpoint integration
 * - 5.7: Paper trading for swing opportunities
 * - 13.1: Natural language input and API integration
 * - 13.2: Structured recommendation display
 */
export default function SwingScannerPage() {
  const [scanResults, setScanResults] = useState<SwingScanResponse | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<SwingCandidate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userId] = useState(DEFAULT_USER_ID);
  const [candidateOhlcv, setCandidateOhlcv] = useState<Map<string, OHLCVData[]>>(new Map());

  // Fetch OHLCV data for each candidate when scan results change
  useEffect(() => {
    if (!scanResults || scanResults.candidates.length === 0) {
      setCandidateOhlcv(new Map());
      return;
    }

    const fetchAll = async () => {
      const newMap = new Map<string, OHLCVData[]>();
      await Promise.all(
        scanResults.candidates.map(async (candidate) => {
          try {
            const res = await fetch(
              `http://localhost:8000/api/market-data/ohlcv?symbol=${candidate.symbol}&timeframe=day&limit=30`
            );
            if (res.ok) {
              const data = await res.json();
              newMap.set(candidate.symbol, Array.isArray(data) ? data : data.data ?? []);
            }
          } catch {
            // Chart will show empty state for this candidate
          }
        })
      );
      setCandidateOhlcv(newMap);
    };
    fetchAll();
  }, [scanResults]);

  const handleScanComplete = (results: SwingScanResponse) => {
    setScanResults(results);
    setSelectedCandidate(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleScanError = (error: Error) => {
    setErrorMessage(error.message);
    setScanResults(null);
    setSelectedCandidate(null);
  };

  const handleCandidateClick = (candidate: SwingCandidate) => {
    setSelectedCandidate(candidate);
    setSuccessMessage(null);
  };

  const handlePaperTradeSuccess = (tradeId: string) => {
    setSuccessMessage(`Paper trade executed successfully! Trade ID: ${tradeId}`);
  };

  const handlePaperTradeError = (error: Error) => {
    setErrorMessage(error.message);
  };

  const handleQuickOrder = async (symbol: string, tt: 'B' | 'S') => {
    if (!kotakApi.getSessionId()) {
      setErrorMessage('Connect Kotak Neo first (from header) to place live orders.');
      return;
    }

    const action = tt === 'B' ? 'BUY' : 'SELL';

    // Check if market is open
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hours = ist.getHours();
    const mins = ist.getMinutes();
    const isWeekday = ist.getDay() >= 1 && ist.getDay() <= 5;
    const isMarketOpen = isWeekday && ((hours === 9 && mins >= 15) || (hours > 9 && hours < 15) || (hours === 15 && mins <= 30));

    let price = '0';
    let orderType = 'MKT';
    let isAmo = false;

    if (!isMarketOpen) {
      isAmo = true;
      orderType = 'L';
      const inputPrice = window.prompt(`Market closed — AMO Limit Order for ${symbol}.\n\nEnter price:`);
      if (!inputPrice) return;
      price = inputPrice;
    }

    const confirmed = window.confirm(
      `⚠️ ${isAmo ? 'AMO ' : ''}LIVE ORDER\n\n${action} ${symbol}\nQty: 1 | ${isAmo ? 'AMO Limit' : 'Market'} ${price !== '0' ? `@ ₹${price}` : ''} | CNC\n\nThis uses REAL money. Continue?`
    );
    if (!confirmed) return;

    try {
      const result = await kotakApi.placeOrder({
        am: isAmo ? 'YES' : 'NO', dq: '0', es: 'nse_cm', mp: '0',
        pc: 'CNC', pf: 'N', pr: price, pt: orderType,
        qt: '1', rt: 'DAY', tp: '0', ts: `${symbol}-EQ`, tt,
      });

      if (result?.stat === 'Ok' || result?.nOrdNo) {
        setSuccessMessage(`${action} order placed for ${symbol}! Order ID: ${result.nOrdNo}`);
      } else {
        setErrorMessage(result?.emsg || `${action} order failed for ${symbol}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Order failed');
    }
  };

  const getTrendBadgeColor = (trend: string) => {
    if (trend.includes('UPTREND')) return 'bg-green-500';
    if (trend.includes('DOWNTREND')) return 'bg-red-500';
    return 'bg-gray-500';
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Swing Trading Scanner</h1>
        <p className="text-muted-foreground">
          Scan the stock universe for high-quality swing trading opportunities
        </p>
      </div>

      {/* Scan Configuration Component */}
      <div className="mb-6">
        <SwingScanner
          userId={userId}
          onScanComplete={handleScanComplete}
          onScanError={handleScanError}
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

      {/* Two Column Layout: Candidates List + Detail View */}
      {scanResults && scanResults.candidates.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Scan Results Table */}
          <Card>
            <CardContent className="p-0">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold">
                  Scan Results ({scanResults.candidatesFound} candidates found)
                </h2>
                <p className="text-sm text-muted-foreground">
                  Scanned {scanResults.scannedCount} stocks
                </p>
              </div>
              <div className="overflow-auto max-h-[800px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Chart</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead className="text-right">R:R</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanResults.candidates.map((candidate) => (
                      <TableRow
                        key={candidate.symbol}
                        className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 ${
                          selectedCandidate?.symbol === candidate.symbol
                            ? 'bg-blue-50 dark:bg-blue-950'
                            : ''
                        }`}
                        onClick={() => handleCandidateClick(candidate)}
                      >
                        <TableCell className="font-medium">{candidate.symbol}</TableCell>
                        <TableCell>
                          {candidateOhlcv.get(candidate.symbol)?.length ? (
                            <div className="w-[140px]">
                              <SwingMiniChart
                                symbol={candidate.symbol}
                                data={candidateOhlcv.get(candidate.symbol)!}
                                entry={candidate.entry}
                                stopLoss={candidate.stopLoss}
                                target={candidate.target}
                                onClick={() => handleCandidateClick(candidate)}
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{candidate.score.toFixed(1)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getTrendBadgeColor(candidate.trend)}>
                            {candidate.trend}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={candidate.riskReward >= 2 ? 'default' : 'secondary'}>
                            {candidate.riskReward.toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700"
                              onClick={() => handleQuickOrder(candidate.symbol, 'B')}
                            >
                              BUY
                            </button>
                            <button
                              className="px-2 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700"
                              onClick={() => handleQuickOrder(candidate.symbol, 'S')}
                            >
                              SELL
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Detail View */}
          <div className="space-y-6">
            {selectedCandidate ? (
              <>
                {/* Recommendation Card with Paper Trade Button */}
                <SwingRecommendationCard
                  candidate={selectedCandidate}
                  userId={userId}
                  onPaperTradeSuccess={handlePaperTradeSuccess}
                  onPaperTradeError={handlePaperTradeError}
                />

                {/* Detailed Analysis Panel */}
                <SwingAnalysisPanel candidate={selectedCandidate} />
              </>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Select a Candidate</p>
                    <p className="text-sm">
                      Click on a stock from the list to view detailed analysis and execute paper trades
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Empty State: No Results */}
      {scanResults && scanResults.candidates.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Candidates Found</p>
              <p className="text-sm">
                No stocks met the minimum score criteria. Try lowering the minimum score or adjusting
                your scan parameters.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Scan Yet State */}
      {!scanResults && !errorMessage && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Ready to Scan</p>
              <p className="text-sm">
                Configure your scan settings above and click &quot;Scan Universe&quot; to find swing
                trading opportunities
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
